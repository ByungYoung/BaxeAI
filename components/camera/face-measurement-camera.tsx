'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraUI } from './camera-ui';

// 측정 결과 콜백 타입 정의
export interface FaceMeasurementCameraProps {
  onFramesCapture?: (frames: string[]) => void;
  onFrameCaptured?: (imageData: ImageData) => void;
  active?: boolean; // 외부에서 활성화 여부 제어
  canvasRef?: React.RefObject<HTMLCanvasElement>; // 외부 캔버스 참조 추가
  videoRef?: React.RefObject<HTMLVideoElement | null>; // null을 허용하도록 수정
  isProcessing?: boolean;
  processText?: string;
  measurementTime?: number;
  className?: string;
}

/**
 * 얼굴 측정용 카메라 컴포넌트
 * RPPGCamera의 개선된 버전으로, 컴포넌트 구조와 React Hooks 사용을 최적화함
 */
export const FaceMeasurementCamera = ({
  onFramesCapture,
  onFrameCaptured,
  active,
  canvasRef: externalCanvasRef,
  videoRef: externalVideoRef,
  isProcessing = false,
  processText = '처리 중...',
  measurementTime = 30,
  className = '',
}: FaceMeasurementCameraProps) => {
  // 모바일 디바이스 감지
  const isMobile = useIsMobile();

  // 참조
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  // 타입 호환성을 위해 as unknown as 사용하여 타입 캐스팅
  const actualCanvasRef = (externalCanvasRef ||
    internalCanvasRef) as React.RefObject<HTMLCanvasElement>;
  const framesRef = useRef<string[]>([]);

  // 타이머 참조
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceDetectionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visibilityChangeRef = useRef<() => void>(() => {});
  const orientationChangeRef = useRef<() => void>(() => {});

  // 디바이스 타입 변경 감지를 위한 ref
  const prevDeviceTypeRef = useRef<string | null>(isMobile ? '모바일' : '데스크톱');

  // 상태 변수
  const [status, setStatus] = useState<'idle' | 'countdown' | 'recording' | 'processing'>('idle');
  const [cameraActive, setCameraActive] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [remainingTime, setRemainingTime] = useState(measurementTime);
  const [progress, setProgress] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState("시작하려면 '측정 시작' 버튼을 클릭하세요");
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionQuality, setDetectionQuality] = useState<'good' | 'poor' | 'none'>('none');
  const [showQualityAlert, setShowQualityAlert] = useState(false);
  const [qualityChecks, setQualityChecks] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraConstraints, setCameraConstraints] = useState({
    video: {
      width: isMobile ? { ideal: 320 } : { ideal: 640 },
      height: isMobile ? { ideal: 240 } : { ideal: 480 },
      facingMode: 'user',
      frameRate: isMobile ? { ideal: 15, max: 20 } : { ideal: 30 },
    },
  });

  // 모든 타이머 정리
  const clearAllTimers = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (recordingTimerRef.current !== null) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (captureIntervalRef.current !== null) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  }, []);

  // 프레임 캡처
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !actualCanvasRef.current || !cameraActive) return;

    const video = videoRef.current;
    const canvas = actualCanvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.videoWidth === 0 || video.videoHeight === 0) return;

    try {
      // 모바일에서는 더 낮은 해상도 사용
      const scaleFactor = isMobile ? 0.5 : 0.67;
      canvas.width = Math.floor(video.videoWidth * scaleFactor);
      canvas.height = Math.floor(video.videoHeight * scaleFactor);

      // 비디오 프레임을 캔버스에 그리기
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 모바일에서는 더 높은 압축률 적용
      const imageQuality = isMobile ? 0.3 : 0.5;
      const frameData = canvas.toDataURL('image/jpeg', imageQuality);

      // 프레임 배열에 추가 및 카운트 증가
      framesRef.current.push(frameData);
      setFrameCount(prev => prev + 1);

      // 메모리 사용량 모니터링 (모바일에서 메모리 문제 방지)
      if (isMobile && framesRef.current.length > 300) {
        console.warn('프레임 수가 300개를 초과하여 일부 프레임을 삭제합니다');
        // 첫 30%의 프레임만 유지하고 나머지는 제거
        framesRef.current = framesRef.current.slice(0, Math.floor(framesRef.current.length * 0.3));
      }
    } catch (_e) {
      // 오류 무시
    }
  }, [actualCanvasRef, cameraActive, isMobile, videoRef]);

  // 녹화 중지 및 처리
  const stopRecordingAndProcess = useCallback(() => {
    // 모든 타이머 정리
    clearAllTimers();

    // 녹화 중지
    setStatus('processing');
    setStatusMessage(processText);

    // 캡처된 프레임이 충분하지 않은 경우 - 최소 요구사항을 5개로 낮춤
    if (framesRef.current.length < 5) {
      setStatusMessage('오류: 충분한 프레임이 캡처되지 않았습니다. 다시 시도해주세요.');
      setStatus('idle');
      return;
    }

    // 외부 프레임 처리 콜백 호출
    if (onFramesCapture) {
      let framesToProcess = [...framesRef.current];

      // 모바일에서는 프레임 수를 줄여 메모리 사용량 감소
      if (isMobile && framesToProcess.length > 150) {
        const stride = Math.ceil(framesToProcess.length / 150);
        framesToProcess = framesToProcess.filter((_, i) => i % stride === 0);
      }

      onFramesCapture(framesToProcess);

      // 메모리 해제
      framesRef.current = [];
    } else {
      // 콜백이 없는 경우 바로 idle 상태로 복귀
      setStatus('idle');
    }
  }, [clearAllTimers, isMobile, onFramesCapture, processText]);

  // 카운트다운 인터벌 참조 (컴포넌트 최상위 레벨에서 선언)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 녹화 시작 함수는 startCountdown에 통합되었습니다  // 카운트다운 시작 - 안정성 개선 버전
  function startCountdown() {
    console.log('카운트다운 시작');

    // 중복 실행 방지를 위한 플래그
    let isCountdownRunning = true;

    // 먼저 모든 타이머를 정리
    clearAllTimers();

    // 상태 초기화
    setStatus('countdown');
    setCountdown(5);
    setProgress(0);
    setFrameCount(0);
    framesRef.current = [];
    setStatusMessage('측정 준비 중...');
    setShowQualityAlert(false);
    setQualityChecks(0);

    // 현재 카운트다운 값
    let currentCount = 5;

    // 타임스탬프 기록 (디버깅용)
    const startTime = Date.now();
    console.log('카운트다운 시작 시간:', new Date(startTime).toISOString());

    // 단일 인터벌을 사용한 카운트다운 구현
    countdownIntervalRef.current = setInterval(() => {
      // 안전 체크: 카운트다운이 중지됐거나 컴포넌트가 언마운트된 경우
      if (!isCountdownRunning) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        return;
      }

      // 카운트 감소
      currentCount -= 1;
      console.log(`카운트다운: ${currentCount}초 남음 (${Date.now() - startTime}ms 경과)`);

      // 상태 업데이트
      setCountdown(currentCount);

      // 카운트다운 완료 시
      if (currentCount <= 0) {
        console.log('카운트다운 완료, 녹화 시작 (' + (Date.now() - startTime) + 'ms 소요)');

        // 타이머 정리
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }

        // 녹화 시작
        setStatus('recording');
        setRemainingTime(measurementTime);
        setStatusMessage('측정 중...');
        framesRef.current = []; // 프레임 배열 초기화
        setFrameCount(0); // 프레임 카운트 초기화

        // 모바일에서는 더 낮은 프레임 레이트 사용
        const captureInterval = isMobile ? 200 : 100; // 모바일에서는 5 FPS, 데스크톱은 10 FPS
        captureIntervalRef.current = setInterval(captureFrame, captureInterval);

        // 측정 타이머 시작
        startMeasurementTimer();
      }
    }, 1000);

    // 컴포넌트 언마운트 시 정리 함수
    return () => {
      console.log('카운트다운 정리');
      isCountdownRunning = false;
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }

  // 측정 타이머 시작 (별도 함수로 분리)
  function startMeasurementTimer() {
    setRemainingTime(measurementTime);
    console.log('측정 타이머 시작, 측정 시간:', measurementTime);

    // 기존의 타이머 정리
    if (recordingTimerRef.current) {
      console.log('기존 측정 타이머 정리');
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // 직접 타이머 변수 추적 (참조로 관리)
    const timerState = { timeRemaining: measurementTime };

    // 시작 시간 기록 (디버깅용)
    const startTime = Date.now();
    console.log('측정 시작 시간:', new Date(startTime).toISOString());

    recordingTimerRef.current = setInterval(() => {
      // 타이머 변수 직접 감소
      timerState.timeRemaining -= 1;

      const elapsedSecs = measurementTime - timerState.timeRemaining;
      const elapsedMs = Date.now() - startTime;
      console.log(
        `남은 시간: ${timerState.timeRemaining}초 (경과: ${elapsedSecs}s / ${elapsedMs}ms)`
      );

      // 상태 업데이트 (함수형 업데이트로 클로저 문제 방지)
      setRemainingTime(timerState.timeRemaining);
      setProgress(((measurementTime - timerState.timeRemaining) / measurementTime) * 100);

      // 시간이 다 되면 측정 중지
      if (timerState.timeRemaining <= 0) {
        console.log(`측정 시간 종료 (${Date.now() - startTime}ms 소요), 처리 시작`);

        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        stopRecordingAndProcess();
      }
    }, 1000);
  }

  // 외부 처리용 단일 프레임 캡처
  const captureFrameForExternal = useCallback(() => {
    if (!videoRef.current || !actualCanvasRef.current || !cameraActive) return;

    const video = videoRef.current;
    const canvas = actualCanvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.videoWidth === 0 || video.videoHeight === 0) return;

    try {
      // 캔버스 크기 설정
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // 비디오 프레임을 캔버스에 그리기
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 이미지 데이터 추출
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      // 외부 콜백에 이미지 데이터 전달
      if (onFrameCaptured) {
        onFrameCaptured(imageData);
      }
    } catch (_e) {
      // 오류 무시
    }
  }, [actualCanvasRef, cameraActive, onFrameCaptured, videoRef]);

  // 카메라 중지 - 안정성 향상
  const stopCamera = useCallback(() => {
    console.log('카메라 중지 함수 호출 (타임스탬프:', new Date().toISOString(), ')');

    // 중지 작업이 진행 중인지 추적하기 위한 플래그
    let isStoppingCamera = true;

    // 안전을 위한 재진입 방지
    if (!videoRef.current?.srcObject && !faceDetectionRef.current) {
      console.log('카메라가 이미 중지된 상태, 추가 작업 없음');
      return;
    }

    // 진행 중인 모든 작업 상태 확인
    console.log('카메라 상태: ' + (videoRef.current?.srcObject ? '활성' : '비활성'));
    console.log('얼굴 감지: ' + (faceDetectionRef.current ? '활성' : '비활성'));
    console.log('카운트다운: ' + (countdownTimerRef.current ? '활성' : '비활성'));
    console.log('녹화 타이머: ' + (recordingTimerRef.current ? '활성' : '비활성'));
    console.log('캡처 인터벌: ' + (captureIntervalRef.current ? '활성' : '비활성'));

    // 모든 타이머 정리
    clearAllTimers();

    // 카메라 스트림과 트랙 중지 - 안전하게 처리
    if (videoRef.current?.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        console.log(`미디어 트랙 ${tracks.length}개 중지 중`);

        // 각 트랙을 개별적으로 중지
        tracks.forEach(track => {
          try {
            console.log(
              `카메라 트랙 중지: ${track.kind}, ${track.label || 'label 없음'}, 활성: ${track.enabled}`
            );
            track.stop();
          } catch (trackErr) {
            console.warn('트랙 중지 중 오류 발생:', trackErr);
          }
        });

        // 비디오 요소에서 스트림 제거
        videoRef.current.srcObject = null;
        setCameraActive(false);
        console.log('카메라 비활성화 완료');
      } catch (streamErr) {
        console.error('스트림 정리 중 오류 발생:', streamErr);
      }
    } else {
      console.log('중지할 카메라 스트림이 없음');
    }

    // 얼굴 감지 타이머 정리 - 중복 정리 방지 로직 추가
    if (faceDetectionRef.current) {
      console.log('얼굴 감지 타이머 정리');
      clearInterval(faceDetectionRef.current);
      faceDetectionRef.current = null;
    }

    // 이벤트 리스너 정리 - 안전하게
    try {
      console.log('이벤트 리스너 정리');
      document.removeEventListener('visibilitychange', visibilityChangeRef.current);
      window.removeEventListener('orientationchange', orientationChangeRef.current);
    } catch (eventErr) {
      console.warn('이벤트 리스너 정리 중 오류:', eventErr);
    }

    // 상태 리셋 및 완료 로그
    setStatus('idle');
    console.log('카메라 중지 완료');

    // 컴포넌트 언마운트 시 플래그 해제
    return () => {
      isStoppingCamera = false;
    };
  }, [clearAllTimers]);

  // 얼굴 감지 처리
  const detectFace = useCallback(() => {
    if (!videoRef.current || !faceCanvasRef.current || !cameraActive) return;

    const video = videoRef.current;
    const canvas = faceCanvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.videoWidth === 0 || video.videoHeight === 0) return;

    // 캔버스 크기 설정
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 비디오 프레임을 캔버스에 그리기
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 모바일에서는 더 작은 샘플 크기 사용
    const sampleSize = isMobile ? 20 : 50;

    // 빛 상태를 확인하기 위한 간단한 로직
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 가운데 영역의 평균 밝기 계산
    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);

    let totalBrightness = 0;
    let pixelCount = 0;

    for (let y = centerY - sampleSize; y < centerY + sampleSize; y++) {
      for (let x = centerX - sampleSize; x < centerX + sampleSize; x++) {
        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
          const i = (y * canvas.width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r + g + b) / 3;
          totalBrightness += brightness;
          pixelCount++;
        }
      }
    }

    const avgBrightness = totalBrightness / pixelCount;

    // 얼굴 감지 시뮬레이션 (실제로는 여기서 얼굴 감지 API 사용)
    const faceFound = avgBrightness > 30; // 최소 밝기 기준
    const qualityGood = avgBrightness > 100; // 좋은 밝기 기준

    console.log('얼굴 감지 결과:', { 평균밝기: avgBrightness.toFixed(1), 감지여부: faceFound });

    // 상태 업데이트 - 이전 상태와 다를 때만 업데이트하여 불필요한 렌더링 방지
    setFaceDetected(prevState => {
      if (prevState !== faceFound) {
        console.log('얼굴 감지 상태 변경:', faceFound ? '감지됨' : '감지되지 않음');
      }
      return faceFound;
    });

    const newQuality = qualityGood ? 'good' : faceFound ? 'poor' : 'none';
    setDetectionQuality(prevQuality => {
      if (prevQuality !== newQuality) {
        console.log('감지 품질 변경:', prevQuality, '->', newQuality);
      }
      return newQuality;
    });

    // 감지 결과에 따라 시각적 피드백 제공
    context.lineWidth = 3;

    if (faceFound) {
      // 얼굴 영역 주변에 사각형 그리기 (시뮬레이션)
      const faceSize = Math.min(canvas.width, canvas.height) * 0.6;
      const faceX = centerX - faceSize / 2;
      const faceY = centerY - faceSize / 2;

      if (qualityGood) {
        context.strokeStyle = 'rgba(0, 255, 0, 0.8)'; // 좋음 - 초록색
        context.fillStyle = 'rgba(0, 255, 0, 0.2)';
      } else {
        context.strokeStyle = 'rgba(255, 165, 0, 0.8)'; // 나쁨 - 주황색
        context.fillStyle = 'rgba(255, 165, 0, 0.2)';
      }

      context.beginPath();
      context.rect(faceX, faceY, faceSize, faceSize);
      context.stroke();
      context.fill();

      // 텍스트 표시
      context.font = '16px sans-serif';
      context.fillStyle = qualityGood ? 'rgb(0, 200, 0)' : 'rgb(255, 165, 0)';
      context.fillText(qualityGood ? '측정 품질: 좋음' : '측정 품질: 개선 필요', 10, 30);
    } else {
      context.strokeStyle = 'rgba(255, 0, 0, 0.8)'; // 감지 안됨 - 빨간색
      context.fillStyle = 'rgba(255, 0, 0, 0.2)';

      // 경고 메시지
      context.font = '18px sans-serif';
      context.fillStyle = 'rgb(255, 50, 50)';
      context.fillText('얼굴이 감지되지 않습니다', 10, 30);

      // 화면 중앙에 얼굴 윤곽 가이드 표시
      const guideSize = Math.min(canvas.width, canvas.height) * 0.6;
      const guideX = centerX - guideSize / 2;
      const guideY = centerY - guideSize / 2;

      context.beginPath();
      context.rect(guideX, guideY, guideSize, guideSize);
      context.stroke();
      context.setLineDash([5, 5]);
      context.strokeRect(guideX, guideY, guideSize, guideSize);
      context.setLineDash([]);
    }

    // 측정 중인 경우 품질 확인 및 알림
    if (status === 'recording') {
      setQualityChecks(prev => prev + 1);
      if (qualityChecks > 10 && !qualityGood && !showQualityAlert) {
        setShowQualityAlert(true);
      }
    } else {
      setQualityChecks(0);
      setShowQualityAlert(false);
    }
  }, [cameraActive, isMobile, qualityChecks, showQualityAlert, status]);

  // 카메라 초기화
  const startCamera = useCallback(async () => {
    try {
      // 기존 카메라 스트림이 있다면 정리
      if (videoRef.current?.srcObject) {
        console.log('기존 카메라 스트림 정리');
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('카메라 트랙 중지:', track.label);
        });
        videoRef.current.srcObject = null;
      }

      console.log('카메라 초기화 시작');
      setCameraError(null);

      try {
        console.log('카메라 접근 시도:', cameraConstraints);
        const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints);
        console.log('카메라 스트림 획득 성공');

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            console.log(
              '비디오 메타데이터 로드됨, 해상도:',
              videoRef.current?.videoWidth,
              'x',
              videoRef.current?.videoHeight
            );
          };

          setCameraActive(true);
          setStatusMessage("카메라가 초기화되었습니다. '측정 시작' 버튼을 클릭하세요.");

          // 기존 얼굴 감지 타이머 정리
          if (faceDetectionRef.current) {
            clearInterval(faceDetectionRef.current);
            faceDetectionRef.current = null;
          }

          // 얼굴 감지 타이머 시작 (모바일에서는 주기 증가)
          const detectionInterval = isMobile ? 500 : 200; // 모바일에서는 0.5초에 한 번
          console.log('얼굴 감지 타이머 시작, 간격:', detectionInterval, 'ms');
          faceDetectionRef.current = setInterval(detectFace, detectionInterval);
        }
      } catch (initialError) {
        console.warn('기본 설정으로 카메라 접근 실패, 대체 설정 시도:', initialError);

        // 기본 설정 실패 시 더 낮은 해상도로 시도
        try {
          const fallbackConstraints = {
            video: {
              width: { ideal: 240 },
              height: { ideal: 180 },
              facingMode: 'user',
              frameRate: { ideal: 10, max: 15 },
            },
          };

          const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setCameraActive(true);
            setStatusMessage(
              "카메라가 초기화되었습니다 (저해상도 모드). '측정 시작' 버튼을 클릭하세요."
            );

            faceDetectionRef.current = setInterval(detectFace, 500);
          }
        } catch (fallbackError) {
          throw fallbackError; // 모든 시도 실패
        }
      }

      // 페이지 가시성 변경(백그라운드로 전환 등) 이벤트 처리기 등록
      const handleVisibilityChange = () => {
        if (document.hidden && status === 'recording') {
          stopRecordingAndProcess();
        }
      };

      // 화면 방향 변경 이벤트 처리기 등록
      const handleOrientationChange = () => {
        console.log('화면 방향 변경 감지');

        // 측정 진행 중인 경우 카메라 재시작하지 않음
        if (status === 'recording' || status === 'countdown') {
          console.log('측정 진행 중: 방향 변경 무시');
          return;
        }

        // 방향 변경 시 카메라 연결 상태 확인
        if (cameraActive) {
          if (!videoRef.current?.srcObject) {
            console.log('방향 변경 후 카메라 연결 끊김 감지, 연결 유지 시도');

            // 연결 유지 확인만 하고 카메라는 재시작하지 않음
            // 심각한 연결 문제가 있을 때만 로그 기록
            console.log('카메라 연결 상태 확인 중');
          } else {
            console.log('방향 변경 후 카메라 연결 유지 중');
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('orientationchange', handleOrientationChange);

      visibilityChangeRef.current = handleVisibilityChange;
      orientationChangeRef.current = handleOrientationChange;
    } catch (_err) {
      setCameraError(
        '카메라에 접근할 수 없습니다. 권한을 확인하거나 다른 브라우저로 시도해보세요.'
      );
      setStatusMessage('카메라 접근 오류. 카메라 권한이 부여되었는지 확인하세요.');
    }
  }, [cameraConstraints, detectFace, isMobile, status, stopCamera, stopRecordingAndProcess]);

  // 앱 초기화
  const resetApp = useCallback(() => {
    clearAllTimers();
    framesRef.current = [];
    setFrameCount(0);
    setStatus('idle');
    setStatusMessage("카메라가 초기화되었습니다. '측정 시작' 버튼을 클릭하세요.");
    setShowQualityAlert(false);
    setQualityChecks(0);

    // startCamera 함수를 직접 호출하지 않고 내부 로직 구현
    setTimeout(() => {
      if (!videoRef.current?.srcObject) {
        navigator.mediaDevices
          .getUserMedia(cameraConstraints)
          .then(stream => {
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              setCameraActive(true);
            }
          })
          .catch(err => {
            console.error('카메라 초기화 오류:', err);
            setCameraError('카메라에 접근할 수 없습니다.');
          });
      }
    }, 500);
  }, [clearAllTimers, cameraConstraints, videoRef, setCameraError]);

  // 측정 시작 버튼 클릭 처리
  const handleStartClick = () => {
    if (status === 'idle') {
      // 얼굴 감지 여부에 상관없이 측정 시작
      startCountdown();
    } else if (status === 'recording') {
      stopRecordingAndProcess();
    }
  };

  // 측정 반복 대화상자 처리
  const handleContinue = () => {
    setShowContinueDialog(false);
    startCountdown(); // 측정 다시 시작
  };

  const handleCancel = () => {
    setShowContinueDialog(false);
    setStatus('idle');

    // startCamera 함수를 직접 호출하지 않고 내부 로직 구현
    if (!videoRef.current?.srcObject) {
      navigator.mediaDevices
        .getUserMedia(cameraConstraints)
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setCameraActive(true);
            setStatusMessage("카메라가 초기화되었습니다. '측정 시작' 버튼을 클릭하세요.");
          }
        })
        .catch(err => {
          console.error('카메라 초기화 오류:', err);
          setCameraError('카메라에 접근할 수 없습니다.');
        });
    }
  };

  // active 속성이 제공되면 해당 값에 따라 컴포넌트 동작 제어
  useEffect(() => {
    // active prop이 변경된 경우에만 로직 실행
    if (active === undefined) return;

    console.log('active prop 변경 감지:', active);

    // 카메라가 이미 원하는 상태인지 확인
    const isCameraCurrentlyActive = !!videoRef.current?.srcObject;

    if (active && !isCameraCurrentlyActive) {
      console.log('카메라 활성화 요청 처리');
      try {
        // 카메라 초기화 (한번만 실행되도록 체크)
        navigator.mediaDevices
          .getUserMedia(cameraConstraints)
          .then(stream => {
            if (!videoRef.current) {
              console.log('비디오 요소가 없음, 스트림 정리');
              stream.getTracks().forEach(track => track.stop());
              return;
            }

            // 이미 초기화되었는지 재확인 (비동기 처리 중 변경 가능성)
            if (videoRef.current.srcObject) {
              console.log('비디오 요소가 이미 스트림을 가지고 있음, 새 스트림 정리');
              stream.getTracks().forEach(track => track.stop());
              return;
            }

            console.log('카메라 스트림 설정 완료');
            videoRef.current.srcObject = stream;
            setCameraActive(true);
            setStatusMessage("카메라가 초기화되었습니다. '측정 시작' 버튼을 클릭하세요.");

            // 얼굴 감지 타이머 - 기존 타이머가 없을 때만 시작
            if (!faceDetectionRef.current) {
              const detectionInterval = isMobile ? 500 : 200;
              console.log('얼굴 감지 타이머 시작 (active prop 변경)');
              faceDetectionRef.current = setInterval(detectFace, detectionInterval);
            }
          })
          .catch(err => {
            console.error('카메라 초기화 오류:', err);
            setCameraError('카메라에 접근할 수 없습니다.');
          });
      } catch (err) {
        console.error('카메라 초기화 중 오류 발생:', err);
        setCameraError('카메라 초기화 중 오류가 발생했습니다.');
      }

      // 프레임 캡처 모드 설정
      if (onFrameCaptured && !captureIntervalRef.current) {
        console.log('프레임 캡처 모드 설정');
        setStatus('recording');
        captureIntervalRef.current = setInterval(captureFrameForExternal, 100);
      }
    } else if (!active && isCameraCurrentlyActive) {
      console.log('카메라 비활성화 요청 처리');

      // 측정 중이면 중지
      if (status === 'recording' || status === 'countdown') {
        console.log('측정 중지 후 카메라 비활성화');
        stopRecordingAndProcess();
      }

      // 카메라 및 리소스 정리
      if (videoRef.current?.srcObject) {
        console.log('카메라 스트림 정리');
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          console.log(`미디어 트랙 중지: ${track.kind}`);
          track.stop();
        });
        videoRef.current.srcObject = null;
        setCameraActive(false);
      }

      // 얼굴 감지 타이머 정리
      if (faceDetectionRef.current) {
        console.log('얼굴 감지 타이머 정리');
        clearInterval(faceDetectionRef.current);
        faceDetectionRef.current = null;
      }

      // 캡처 타이머 정리
      if (captureIntervalRef.current) {
        console.log('캡처 타이머 정리');
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
    }
  }, [
    active,
    captureFrameForExternal,
    onFrameCaptured,
    cameraConstraints,
    detectFace,
    status,
    videoRef,
    stopRecordingAndProcess,
  ]);

  // 외부 처리 상태 변경 감지
  useEffect(() => {
    if (status === 'processing' && !isProcessing) {
      // 처리가 완료되면 대화상자 표시
      setShowContinueDialog(true);
    }
  }, [isProcessing, status]);

  // 카메라 초기화 상태 추적을 위한 ref (컴포넌트 최상위 레벨에서 선언)
  const cameraInitializedRef = useRef(false);

  // 컴포넌트 마운트/언마운트 시 처리
  useEffect(() => {
    console.log('컴포넌트 마운트: 카메라 초기화 준비');

    // iOS 브라우저 대응을 위한 딜레이 추가
    const initTimeout = setTimeout(() => {
      // 중복 초기화 방지
      if (cameraInitializedRef.current) {
        console.log('카메라가 이미 초기화됨, 추가 초기화 건너뜀');
        return;
      }

      console.log('카메라 초기화 시작 (컴포넌트 마운트)');
      try {
        if (!videoRef.current?.srcObject) {
          navigator.mediaDevices
            .getUserMedia(cameraConstraints)
            .then(stream => {
              if (videoRef.current) {
                // 중복 초기화 방지 확인
                if (videoRef.current.srcObject) {
                  console.log('카메라가 이미 초기화됨, 새 스트림 사용하지 않음');
                  // 새 스트림은 사용하지 않고 정리
                  stream.getTracks().forEach(track => track.stop());
                  return;
                }

                videoRef.current.srcObject = stream;
                setCameraActive(true);
                cameraInitializedRef.current = true;
                setStatusMessage("카메라가 초기화되었습니다. '측정 시작' 버튼을 클릭하세요.");
                console.log('카메라 초기화 완료 (컴포넌트 마운트)');

                // 얼굴 감지 타이머 시작 - 기존 타이머 확인 후 시작
                if (!faceDetectionRef.current) {
                  const detectionInterval = isMobile ? 500 : 200;
                  console.log('얼굴 감지 타이머 시작');
                  faceDetectionRef.current = setInterval(detectFace, detectionInterval);
                }
              }
            })
            .catch(err => {
              console.error('카메라 초기화 오류:', err);
              setCameraError('카메라에 접근할 수 없습니다.');
            });
        } else {
          console.log('카메라가 이미 활성화됨, 초기화 건너뜀');
          setCameraActive(true);
        }
      } catch (err) {
        console.error('카메라 초기화 중 오류 발생:', err);
        setCameraError('카메라 초기화 중 오류가 발생했습니다.');
      }
    }, 500);

    return () => {
      console.log('컴포넌트 언마운트: 카메라 및 타이머 정리');
      clearTimeout(initTimeout);
      clearAllTimers();

      // stopCamera 함수를 인라인으로 구현
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        console.log('카메라 트랙 정리 (컴포넌트 언마운트)');
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      // 얼굴 감지 타이머 정리
      if (faceDetectionRef.current) {
        clearInterval(faceDetectionRef.current);
        faceDetectionRef.current = null;
      }

      // 이벤트 리스너 정리
      document.removeEventListener('visibilitychange', visibilityChangeRef.current);
      window.removeEventListener('orientationchange', orientationChangeRef.current);
    };
  }, []); // 의도적으로 빈 배열 사용 - 컴포넌트 마운트 시 한 번만 실행

  // 디바이스 타입을 별도 상태로 유지하여 불필요한 변경 방지
  const [deviceTypeState, setDeviceTypeState] = useState(isMobile ? '모바일' : '데스크톱');

  // 단일 컨텍스트에서 디바이스 타입과 카메라 설정 관리
  useEffect(() => {
    // 디바이스 타입 감지 및 초기 설정
    const initialDeviceType = isMobile ? '모바일' : '데스크톱';
    prevDeviceTypeRef.current = initialDeviceType;
    console.log('디바이스 타입 초기화:', initialDeviceType);

    // 고정된 카메라 설정 구성
    const fixedConstraints = {
      video: {
        // 해상도 및 프레임 레이트 설정 (모바일/데스크톱 구분)
        width: isMobile ? { ideal: 320 } : { ideal: 640 },
        height: isMobile ? { ideal: 240 } : { ideal: 480 },
        facingMode: 'user',
        frameRate: isMobile ? { ideal: 15, max: 20 } : { ideal: 30 },
      },
    };

    // 카메라 설정 업데이트
    setCameraConstraints(fixedConstraints);
    console.log('카메라 설정 초기화 완료:', initialDeviceType);

    // 디바이스 정보 상태 저장
    setDeviceTypeState(initialDeviceType);
  }, []); // 의도적으로 빈 배열 사용 - 컴포넌트 마운트 시 한 번만 실행

  // 디바이스 타입 감지 로직 완전 비활성화
  const ignoreDeviceChanges = true; // 항상 모든 디바이스 타입 변경을 무시
  // 초기 렌더링 추적을 위한 ref (컴포넌트 최상위 레벨에서 선언)
  const initialRenderRef = useRef(true);

  // 디바이스 타입 변경 모니터링 (디버그 목적으로만 유지)
  useEffect(() => {
    // 초기 마운트시에만 현재 디바이스 타입 로깅
    if (initialRenderRef.current) {
      console.log('초기 디바이스 타입:', isMobile ? '모바일' : '데스크톱');
      initialRenderRef.current = false;
      return;
    }

    // 변경 감지 - 로그만 남기고 아무 액션 없음
    const currentType = isMobile ? '모바일' : '데스크톱';
    if (prevDeviceTypeRef.current !== currentType) {
      console.log(
        '[정보] 디바이스 타입 변경 감지됨 (액션 없음):',
        prevDeviceTypeRef.current,
        '->',
        currentType
      );
      // 디바이스 타입이 변경되더라도 카메라 설정 유지
    }
  }, [isMobile]);

  // 외부에서 활성화/비활성화를 제어하는 경우에는 UI 컨트롤 숨기기
  if (active !== undefined) {
    return (
      <div className={className}>
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <canvas ref={actualCanvasRef} className="absolute top-0 left-0 w-full h-full opacity-0" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <CameraUI
        cameraActive={cameraActive}
        status={status}
        cameraError={cameraError}
        videoRef={videoRef}
        actualCanvasRef={actualCanvasRef}
        faceCanvasRef={faceCanvasRef as React.RefObject<HTMLCanvasElement>}
        countdown={countdown}
        processText={processText}
        progress={progress}
        remainingTime={remainingTime}
        isMobile={isMobile}
        frameCount={frameCount}
        statusMessage={statusMessage}
        showQualityAlert={showQualityAlert}
        onResetClick={resetApp}
        onStartClick={handleStartClick}
        setCameraError={setCameraError}
        startCamera={startCamera}
      />

      {/* 측정 반복 확인 대화상자 */}
      <AlertDialog open={showContinueDialog} onOpenChange={setShowContinueDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>측정 완료</AlertDialogTitle>
            <AlertDialogDescription>
              측정이 완료되었습니다. 계속 반복하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>아니오</AlertDialogCancel>
            <AlertDialogAction onClick={handleContinue}>예</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FaceMeasurementCamera;
