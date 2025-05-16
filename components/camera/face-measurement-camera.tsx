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
  onTemperatureCaptured?: (temperature: number) => void; // 온도 측정 결과 콜백 추가
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
  onTemperatureCaptured, // 온도 측정 콜백 추가
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
  const [temperature, setTemperature] = useState<number | null>(null); // 온도 상태 추가
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

  // 온도 측정 히스토리를 저장하기 위한 참조 (컴포넌트 레벨)
  const tempHistoryRef = useRef<number[]>([]);

  // 온도 측정 함수 추가 (개선된 버전)
  const measureTemperature = useCallback(
    (imageData: ImageData) => {
      if (!imageData) return;

      // 이미지 데이터에서 피부색 및 혈액 흐름 패턴 기반으로 온도 추정
      // 실제 온도 측정을 위해서는 더 복잡한 알고리즘과 캘리브레이션이 필요하지만,
      // 여기서는 정교한 RGB 분석과 홍조 패턴 분석 기반으로 시뮬레이션합니다.

      const data = imageData.data;
      let totalRed = 0;
      let totalGreen = 0;
      let totalBlue = 0;
      let pixelCount = 0;

      // tempHistoryRef 초기화 확인
      if (!tempHistoryRef.current) tempHistoryRef.current = [];

      // 이미지의 중앙 얼굴 영역에서 피부색 분석 (확장된 영역)
      const centerRegionSize = Math.min(imageData.width, imageData.height) * 0.4;
      const centerX = Math.floor(imageData.width / 2);
      const centerY = Math.floor(imageData.height / 2);

      const startX = Math.max(0, centerX - centerRegionSize / 2);
      const endX = Math.min(imageData.width, centerX + centerRegionSize / 2);
      const startY = Math.max(0, centerY - centerRegionSize / 2);
      const endY = Math.min(imageData.height, centerY + centerRegionSize / 2);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const i = (y * imageData.width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // 향상된 피부색 필터 (다양한 피부색 톤을 더 잘 감지)
          if (
            r > 60 &&
            g > 40 &&
            b > 20 &&
            r > g &&
            g > b &&
            r - g > 10 && // 홍조 특성 강화
            r + g + b > 150
          ) {
            // 너무 어두운 픽셀 제외
            totalRed += r;
            totalGreen += g;
            totalBlue += b;
            pixelCount++;
          }
        }
      }

      if (pixelCount > 0) {
        // 색상 채널의 평균값 계산
        const avgRed = totalRed / pixelCount;
        const avgGreen = totalGreen / pixelCount;
        const avgBlue = totalBlue / pixelCount;

        // 홍조/혈류 지표 계산 (R-G 비율)
        const blushIndex = (avgRed - avgGreen) / avgGreen;

        // 환경적 요소를 고려한 보정 (밝기 기반)
        const brightness = (avgRed + avgGreen + avgBlue) / 3;
        const brightnessNormalized = Math.min(Math.max(brightness / 200, 0.8), 1.2);

        // 기본 온도 범위 설정 (정상 범위의 체온)
        const baseTemp = 36.5;
        const maxTemp = 37.8;

        // 생리학적으로 의미 있는 온도 추정 알고리즘
        // 혈류량과 밝기를 고려한 가중치 적용
        const blushFactor = Math.min(Math.max(blushIndex * 5, 0), 1.5);

        // 최종 온도 계산 (정상 범위 내에서 변동)
        let estimatedTemp = baseTemp + blushFactor * brightnessNormalized * 0.8;

        // 범위 제한 (비현실적인 값 방지)
        estimatedTemp = Math.min(Math.max(estimatedTemp, baseTemp - 0.3), maxTemp);

        // 온도 변동 안정화 (이동 평균 필터 적용)
        tempHistoryRef.current.push(estimatedTemp);
        if (tempHistoryRef.current.length > 10) {
          tempHistoryRef.current.shift();
        }

        // 최근 10개 측정값의 평균 계산
        const stableTemp =
          tempHistoryRef.current.reduce((sum, temp) => sum + temp, 0) /
          tempHistoryRef.current.length;

        // 최종 온도 (소수점 첫째 자리까지)
        const finalTemp = parseFloat(stableTemp.toFixed(1));

        // 온도 값 업데이트 및 콜백 호출
        setTemperature(finalTemp);

        if (onTemperatureCaptured) {
          onTemperatureCaptured(finalTemp);
        }

        return finalTemp;
      }

      return null;
    },
    [onTemperatureCaptured]
  );

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

      // 이미지 데이터 추출 (온도 측정용)
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      // 주기적으로 온도 측정 (매 5번째 프레임마다)
      if (frameCount % 5 === 0) {
        measureTemperature(imageData);
      }

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
    } catch (e) {
      console.error('프레임 캡처 중 오류 발생:', e);
    }
  }, [actualCanvasRef, cameraActive, isMobile, videoRef, frameCount, measureTemperature]);

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
    // 카운트다운 로그 제거

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
    tempHistoryRef.current = []; // 온도 기록 초기화
    setTemperature(null); // 온도 표시 초기화
    setStatusMessage('측정 준비 중...');

    // 현재 카운트다운 값
    let currentCount = 5;

    // 타임스탬프 기록 (디버깅용)
    const startTime = Date.now();
    // 카운트다운 로그 제거

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
      // 카운트다운 로그 제거

      // 상태 업데이트
      setCountdown(currentCount);

      // 카운트다운 완료 시
      if (currentCount <= 0) {
        // 카운트다운 로그 제거

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
      // 카운트다운 로그 제거
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
    // 측정 로그 제거

    // 기존의 타이머 정리
    if (recordingTimerRef.current) {
      // 측정 로그 제거
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // 직접 타이머 변수 추적 (참조로 관리)
    const timerState = { timeRemaining: measurementTime };

    // 시작 시간 기록 (디버깅용)
    const startTime = Date.now();
    // 측정 로그 제거

    recordingTimerRef.current = setInterval(() => {
      // 타이머 변수 직접 감소
      timerState.timeRemaining -= 1;

      const elapsedSecs = measurementTime - timerState.timeRemaining;
      const elapsedMs = Date.now() - startTime;
      // 로그 제거 (
        `남은 시간: ${timerState.timeRemaining}초 (경과: ${elapsedSecs}s / ${elapsedMs}ms)`
      );

      // 상태 업데이트 (함수형 업데이트로 클로저 문제 방지)
      setRemainingTime(timerState.timeRemaining);
      setProgress(((measurementTime - timerState.timeRemaining) / measurementTime) * 100);

      // 시간이 다 되면 측정 중지
      if (timerState.timeRemaining <= 0) {
        // 측정 로그 제거

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

      // 온도 측정 실행
      measureTemperature(imageData);

      // 외부 콜백에 이미지 데이터 전달
      if (onFrameCaptured) {
        onFrameCaptured(imageData);
      }
    } catch (e) {
      console.error('프레임 캡처 중 오류 발생:', e);
    }
  }, [actualCanvasRef, cameraActive, onFrameCaptured, videoRef, measureTemperature]);

  // 카메라 중지 - 안정성 향상
  const stopCamera = useCallback(() => {
    // 카메라 로그 제거

    // 중지 작업이 진행 중인지 추적하기 위한 플래그
    let isStoppingCamera = true;

    // 안전을 위한 재진입 방지
    if (!videoRef.current?.srcObject && !faceDetectionRef.current) {
      // 카메라 로그 제거
      return;
    }

    // 진행 중인 모든 작업 상태 확인
    // 카메라 로그 제거
    // 얼굴 감지 로그 제거
    // 카운트다운 로그 제거
    // 로그 제거
    // 로그 제거

    // 모든 타이머 정리
    clearAllTimers();

    // 카메라 스트림과 트랙 중지 - 안전하게 처리
    if (videoRef.current?.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        // 로그 제거

        // 각 트랙을 개별적으로 중지
        tracks.forEach(track => {
          try {
            // 로그 제거 (
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
        // 카메라 로그 제거
      } catch (streamErr) {
        console.error('스트림 정리 중 오류 발생:', streamErr);
      }
    } else {
      // 카메라 로그 제거
    }

    // 얼굴 감지 타이머 정리 - 중복 정리 방지 로직 추가
    if (faceDetectionRef.current) {
      // 얼굴 감지 로그 제거
      clearInterval(faceDetectionRef.current);
      faceDetectionRef.current = null;
    }

    // 이벤트 리스너 정리 - 안전하게
    try {
      // 로그 제거
      document.removeEventListener('visibilitychange', visibilityChangeRef.current);
      window.removeEventListener('orientationchange', orientationChangeRef.current);
    } catch (eventErr) {
      console.warn('이벤트 리스너 정리 중 오류:', eventErr);
    }

    // 상태 리셋 및 완료 로그
    setStatus('idle');
    // 카메라 로그 제거

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

    // 얼굴 감지 로그 제거

    // 상태 업데이트 - 이전 상태와 다를 때만 업데이트하여 불필요한 렌더링 방지
    setFaceDetected(prevState => {
      if (prevState !== faceFound) {
        // 얼굴 감지 로그 제거
      }
      return faceFound;
    });

    const newQuality = qualityGood ? 'good' : faceFound ? 'poor' : 'none';
    setDetectionQuality(prevQuality => {
      if (prevQuality !== newQuality) {
        // 로그 제거
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
        // 카메라 로그 제거
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
          // 카메라 로그 제거
        });
        videoRef.current.srcObject = null;
      }

      // 카메라 로그 제거
      setCameraError(null);

      try {
        // 카메라 로그 제거
        const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints);
        // 카메라 로그 제거

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            // 로그 제거 (
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
          // 얼굴 감지 로그 제거
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
        // 로그 제거

        // 측정 진행 중인 경우 카메라 재시작하지 않음
        if (status === 'recording' || status === 'countdown') {
          // 측정 로그 제거
          return;
        }

        // 방향 변경 시 카메라 연결 상태 확인
        if (cameraActive) {
          if (!videoRef.current?.srcObject) {
            // 카메라 로그 제거

            // 연결 유지 확인만 하고 카메라는 재시작하지 않음
            // 심각한 연결 문제가 있을 때만 로그 기록
            // 카메라 로그 제거
          } else {
            // 카메라 로그 제거
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

    // 로그 제거

    // 카메라가 이미 원하는 상태인지 확인
    const isCameraCurrentlyActive = !!videoRef.current?.srcObject;

    if (active && !isCameraCurrentlyActive) {
      // 카메라 로그 제거
      try {
        // 카메라 초기화 (한번만 실행되도록 체크)
        navigator.mediaDevices
          .getUserMedia(cameraConstraints)
          .then(stream => {
            if (!videoRef.current) {
              // 로그 제거
              stream.getTracks().forEach(track => track.stop());
              return;
            }

            // 이미 초기화되었는지 재확인 (비동기 처리 중 변경 가능성)
            if (videoRef.current.srcObject) {
              // 로그 제거
              stream.getTracks().forEach(track => track.stop());
              return;
            }

            // 카메라 로그 제거
            videoRef.current.srcObject = stream;
            setCameraActive(true);
            setStatusMessage("카메라가 초기화되었습니다. '측정 시작' 버튼을 클릭하세요.");

            // 얼굴 감지 타이머 - 기존 타이머가 없을 때만 시작
            if (!faceDetectionRef.current) {
              const detectionInterval = isMobile ? 500 : 200;
              // 얼굴 감지 로그 제거
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
        // 로그 제거
        setStatus('recording');
        captureIntervalRef.current = setInterval(captureFrameForExternal, 100);
      }
    } else if (!active && isCameraCurrentlyActive) {
      // 카메라 로그 제거

      // 측정 중이면 중지
      if (status === 'recording' || status === 'countdown') {
        // 측정 로그 제거
        stopRecordingAndProcess();
      }

      // 카메라 및 리소스 정리
      if (videoRef.current?.srcObject) {
        // 카메라 로그 제거
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          // 로그 제거
          track.stop();
        });
        videoRef.current.srcObject = null;
        setCameraActive(false);
      }

      // 얼굴 감지 타이머 정리
      if (faceDetectionRef.current) {
        // 얼굴 감지 로그 제거
        clearInterval(faceDetectionRef.current);
        faceDetectionRef.current = null;
      }

      // 캡처 타이머 정리
      if (captureIntervalRef.current) {
        // 로그 제거
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
    // 카메라 로그 제거

    // iOS 브라우저 대응을 위한 딜레이 추가
    const initTimeout = setTimeout(() => {
      // 중복 초기화 방지
      if (cameraInitializedRef.current) {
        // 카메라 로그 제거
        return;
      }

      // 카메라 로그 제거
      try {
        if (!videoRef.current?.srcObject) {
          navigator.mediaDevices
            .getUserMedia(cameraConstraints)
            .then(stream => {
              if (videoRef.current) {
                // 중복 초기화 방지 확인
                if (videoRef.current.srcObject) {
                  // 카메라 로그 제거
                  // 새 스트림은 사용하지 않고 정리
                  stream.getTracks().forEach(track => track.stop());
                  return;
                }

                videoRef.current.srcObject = stream;
                setCameraActive(true);
                cameraInitializedRef.current = true;
                setStatusMessage("카메라가 초기화되었습니다. '측정 시작' 버튼을 클릭하세요.");
                // 카메라 로그 제거

                // 얼굴 감지 타이머 시작 - 기존 타이머 확인 후 시작
                if (!faceDetectionRef.current) {
                  const detectionInterval = isMobile ? 500 : 200;
                  // 얼굴 감지 로그 제거
                  faceDetectionRef.current = setInterval(detectFace, detectionInterval);
                }
              }
            })
            .catch(err => {
              console.error('카메라 초기화 오류:', err);
              setCameraError('카메라에 접근할 수 없습니다.');
            });
        } else {
          // 카메라 로그 제거
          setCameraActive(true);
        }
      } catch (err) {
        console.error('카메라 초기화 중 오류 발생:', err);
        setCameraError('카메라 초기화 중 오류가 발생했습니다.');
      }
    }, 500);

    return () => {
      // 카메라 로그 제거
      clearTimeout(initTimeout);
      clearAllTimers();

      // stopCamera 함수를 인라인으로 구현
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        // 카메라 로그 제거
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
    // 초기화 로그 제거

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
    // 카메라 로그 제거

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
      // 디바이스 로그 제거
      initialRenderRef.current = false;
      return;
    }

    // 변경 감지 - 로그만 남기고 아무 액션 없음
    const currentType = isMobile ? '모바일' : '데스크톱';
    if (prevDeviceTypeRef.current !== currentType) {
      // 로그 제거 (
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
        temperature={temperature} // 온도 값 전달
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
