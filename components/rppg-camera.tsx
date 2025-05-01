"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Camera, HeartPulse, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useIsMobile } from "@/hooks/use-mobile";

// 측정 결과 콜백 타입 정의
export interface RPPGCameraProps {
  onFramesCapture?: (frames: string[]) => void;
  onFrameCaptured?: (imageData: ImageData) => void; // 단일 프레임 캡처 콜백 추가
  active?: boolean; // 외부에서 활성화 여부 제어
  canvasRef?: React.RefObject<HTMLCanvasElement>; // 외부 캔버스 참조 추가
  videoRef?: React.RefObject<HTMLVideoElement>; // 외부에서 비디오 참조 추가
  isProcessing?: boolean;
  processText?: string;
  measurementTime?: number;
  className?: string;
}

export const RPPGCamera = ({
  // default export 대신 named export로 변경
  onFramesCapture,
  onFrameCaptured,
  active,
  canvasRef: externalCanvasRef,
  videoRef: externalVideoRef,
  isProcessing = false,
  processText = "처리 중...",
  measurementTime = 30,
  className = "",
}: RPPGCameraProps) => {
  // 모바일 디바이스 감지
  const isMobile = useIsMobile();

  // 참조
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef; // 외부 참조 또는 내부 참조 사용
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null); // 얼굴 감지 시각화를 위한 캔버스
  const actualCanvasRef = externalCanvasRef || internalCanvasRef; // 외부 참조 또는 내부 참조 사용
  const framesRef = useRef<string[]>([]); // 프레임 데이터를 참조로 관리

  // 상태 변수
  const [status, setStatus] = useState<
    "idle" | "countdown" | "recording" | "processing"
  >("idle");
  const [cameraActive, setCameraActive] = useState(false);
  const [countdown, setCountdown] = useState(5); // 5초 카운트다운
  const [remainingTime, setRemainingTime] = useState(measurementTime);
  const [progress, setProgress] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    "시작하려면 '측정 시작' 버튼을 클릭하세요"
  );
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false); // 얼굴 감지 상태
  const [detectionQuality, setDetectionQuality] = useState<
    "good" | "poor" | "none"
  >("none"); // 감지 품질
  const [showQualityAlert, setShowQualityAlert] = useState(false); // 품질 알림 표시 여부
  const [qualityChecks, setQualityChecks] = useState(0); // 품질 검사 횟수
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraConstraints, setCameraConstraints] = useState({
    video: {
      width: isMobile ? { ideal: 320 } : { ideal: 640 },
      height: isMobile ? { ideal: 240 } : { ideal: 480 },
      facingMode: "user",
      frameRate: isMobile ? { ideal: 15, max: 20 } : { ideal: 30 },
    },
  });

  // active 속성이 제공되면 해당 값에 따라 컴포넌트 동작 제어
  useEffect(() => {
    if (active !== undefined) {
      if (active) {
        startCamera();
        if (onFrameCaptured) {
          // 단일 프레임 캡처 모드로 설정
          setStatus("recording");
          captureIntervalRef.current = setInterval(
            captureFrameForExternal,
            100
          );
        }
      } else {
        stopRecordingAndProcess();
        stopCamera();
      }
    }
  }, [active]);

  // 타이머 참조
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const faceDetectionRef = useRef<NodeJS.Timeout | null>(null); // 얼굴 감지 타이머
  const visibilityChangeRef = useRef<() => void>(() => {}); // 페이지 가시성 변경 핸들러
  const orientationChangeRef = useRef<() => void>(() => {}); // 화면 방향 변경 핸들러

  // 외부 처리용 단일 프레임 캡처
  const captureFrameForExternal = () => {
    if (!videoRef.current || !actualCanvasRef.current || !cameraActive) return;

    const video = videoRef.current;
    const canvas = actualCanvasRef.current;
    const context = canvas.getContext("2d");

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
    } catch (e) {
      console.error("프레임 캡처 오류:", e);
    }
  };

  // 얼굴 감지 처리
  const detectFace = () => {
    if (!videoRef.current || !faceCanvasRef.current || !cameraActive) return;

    const video = videoRef.current;
    const canvas = faceCanvasRef.current;
    const context = canvas.getContext("2d");

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

    setFaceDetected(faceFound);
    setDetectionQuality(qualityGood ? "good" : faceFound ? "poor" : "none");

    // 감지 결과에 따라 시각적 피드백 제공
    context.lineWidth = 3;

    if (faceFound) {
      // 얼굴 영역 주변에 사각형 그리기 (시뮬레이션)
      const faceSize = Math.min(canvas.width, canvas.height) * 0.6;
      const faceX = centerX - faceSize / 2;
      const faceY = centerY - faceSize / 2;

      if (qualityGood) {
        context.strokeStyle = "rgba(0, 255, 0, 0.8)"; // 좋음 - 초록색
        context.fillStyle = "rgba(0, 255, 0, 0.2)";
      } else {
        context.strokeStyle = "rgba(255, 165, 0, 0.8)"; // 나쁨 - 주황색
        context.fillStyle = "rgba(255, 165, 0, 0.2)";
      }

      context.beginPath();
      context.rect(faceX, faceY, faceSize, faceSize);
      context.stroke();
      context.fill();

      // 텍스트 표시
      context.font = "16px sans-serif";
      context.fillStyle = qualityGood ? "rgb(0, 200, 0)" : "rgb(255, 165, 0)";
      context.fillText(
        qualityGood ? "측정 품질: 좋음" : "측정 품질: 개선 필요",
        10,
        30
      );
    } else {
      context.strokeStyle = "rgba(255, 0, 0, 0.8)"; // 감지 안됨 - 빨간색
      context.fillStyle = "rgba(255, 0, 0, 0.2)";

      // 경고 메시지
      context.font = "18px sans-serif";
      context.fillStyle = "rgb(255, 50, 50)";
      context.fillText("얼굴이 감지되지 않습니다", 10, 30);

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
    if (status === "recording") {
      setQualityChecks((prev) => prev + 1);
      if (qualityChecks > 10 && !qualityGood && !showQualityAlert) {
        setShowQualityAlert(true);
      }
    } else {
      setQualityChecks(0);
      setShowQualityAlert(false);
    }
  };

  // 카메라 초기화
  const startCamera = async () => {
    try {
      if (videoRef.current?.srcObject) {
        return; // 이미 카메라가 활성화된 경우
      }

      setCameraError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          cameraConstraints
        );

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraActive(true);
          setStatusMessage(
            "카메라가 초기화되었습니다. '측정 시작' 버튼을 클릭하세요."
          );

          // 얼굴 감지 타이머 시작 (모바일에서는 주기 증가)
          const detectionInterval = isMobile ? 500 : 200; // 모바일에서는 0.5초에 한 번
          faceDetectionRef.current = setInterval(detectFace, detectionInterval);
        }
      } catch (initialError) {
        console.warn(
          "기본 설정으로 카메라 접근 실패, 대체 설정 시도:",
          initialError
        );

        // 기본 설정 실패 시 더 낮은 해상도로 시도
        try {
          const fallbackConstraints = {
            video: {
              width: { ideal: 240 },
              height: { ideal: 180 },
              facingMode: "user",
              frameRate: { ideal: 10, max: 15 },
            },
          };

          const stream = await navigator.mediaDevices.getUserMedia(
            fallbackConstraints
          );

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
        if (document.hidden && status === "recording") {
          console.log("페이지가 백그라운드로 전환됨, 측정 중단");
          stopRecordingAndProcess();
        }
      };

      // 화면 방향 변경 이벤트 처리기 등록
      const handleOrientationChange = () => {
        console.log("화면 방향이 변경됨, 카메라 상태 확인");
        if (cameraActive && !videoRef.current?.srcObject) {
          // 방향 변경으로 카메라 연결이 끊어진 경우 재시도
          stopCamera();
          setTimeout(() => startCamera(), 500);
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("orientationchange", handleOrientationChange);

      visibilityChangeRef.current = handleVisibilityChange;
      orientationChangeRef.current = handleOrientationChange;
    } catch (err) {
      console.error("카메라 접근 오류:", err);
      setCameraError(
        "카메라에 접근할 수 없습니다. 권한을 확인하거나 다른 브라우저로 시도해보세요."
      );
      setStatusMessage(
        "카메라 접근 오류. 카메라 권한이 부여되었는지 확인하세요."
      );
    }
  };

  // 카메라 중지
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }

    // 얼굴 감지 타이머 정리
    if (faceDetectionRef.current) {
      clearInterval(faceDetectionRef.current);
      faceDetectionRef.current = null;
    }

    // 이벤트 리스너 정리
    document.removeEventListener(
      "visibilitychange",
      visibilityChangeRef.current
    );
    window.removeEventListener(
      "orientationchange",
      orientationChangeRef.current
    );
  };

  // 측정 시작 버튼 클릭 처리
  const handleStartClick = () => {
    if (status === "idle") {
      // 얼굴 감지 여부에 상관없이 측정 시작
      startCountdown();
    } else if (status === "recording") {
      stopRecordingAndProcess();
    }
  };

  // 카운트다운 시작
  const startCountdown = () => {
    // 상태 초기화
    setStatus("countdown");
    setCountdown(5); // 5초 카운트다운
    setProgress(0);
    setFrameCount(0);
    framesRef.current = [];
    setStatusMessage("측정 준비 중...");
    setShowQualityAlert(false);
    setQualityChecks(0);

    // 카운트다운 타이머 설정
    let count = 5;
    countdownTimerRef.current = setInterval(() => {
      count--;
      setCountdown(count);

      if (count <= 0) {
        clearInterval(countdownTimerRef.current as NodeJS.Timeout);
        startRecording();
      }
    }, 1000);
  };

  // 녹화 시작
  const startRecording = () => {
    setStatus("recording");
    setRemainingTime(measurementTime);
    setStatusMessage("측정 중...");
    framesRef.current = []; // 프레임 배열 초기화
    setFrameCount(0); // 프레임 카운트 초기화

    // 모바일에서는 더 낮은 프레임 레이트 사용
    const captureInterval = isMobile ? 200 : 100; // 모바일에서는 5 FPS, 데스크톱은 10 FPS
    captureIntervalRef.current = setInterval(captureFrame, captureInterval);

    // 녹화 타이머 시작
    let timeLeft = measurementTime;
    recordingTimerRef.current = setInterval(() => {
      timeLeft--;
      setRemainingTime(timeLeft);
      setProgress(((measurementTime - timeLeft) / measurementTime) * 100);

      if (timeLeft <= 0) {
        stopRecordingAndProcess();
      }
    }, 1000);
  };

  // 녹화 중지 및 처리
  const stopRecordingAndProcess = () => {
    // 모든 타이머 정리
    clearAllTimers();

    // 녹화 중지
    setStatus("processing");
    setStatusMessage(processText);

    // 현재까지 캡처된 프레임 수 확인
    console.log(`총 캡처된 프레임 수: ${framesRef.current.length}`);

    // 캡처된 프레임이 충분하지 않은 경우 - 최소 요구사항을 5개로 낮춤
    if (framesRef.current.length < 5) {
      console.error("처리할 충분한 프레임이 없습니다.");
      setStatusMessage(
        "오류: 충분한 프레임이 캡처되지 않았습니다. 다시 시도해주세요."
      );
      setStatus("idle");
      return;
    }

    // 외부 프레임 처리 콜백 호출
    if (onFramesCapture) {
      let framesToProcess = [...framesRef.current];

      // 모바일에서는 프레임 수를 줄여 메모리 사용량 감소
      if (isMobile && framesToProcess.length > 150) {
        const stride = Math.ceil(framesToProcess.length / 150);
        framesToProcess = framesToProcess.filter((_, i) => i % stride === 0);
        console.log(
          `프레임 수 조정: ${framesRef.current.length} -> ${framesToProcess.length}`
        );
      }

      onFramesCapture(framesToProcess);

      // 메모리 해제
      framesRef.current = [];
    } else {
      // 콜백이 없는 경우 바로 idle 상태로 복귀
      setStatus("idle");
    }
  };

  // 프레임 캡처
  const captureFrame = () => {
    if (!videoRef.current || !actualCanvasRef.current || !cameraActive) return;

    const video = videoRef.current;
    const canvas = actualCanvasRef.current;
    const context = canvas.getContext("2d");

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
      const frameData = canvas.toDataURL("image/jpeg", imageQuality);

      // 프레임 배열에 추가 및 카운트 증가
      framesRef.current.push(frameData);
      setFrameCount((prev) => prev + 1);

      // 메모리 사용량 모니터링 (모바일에서 메모리 문제 방지)
      if (isMobile && framesRef.current.length > 300) {
        console.warn("프레임 수가 300개를 초과하여 일부 프레임을 삭제합니다");
        // 첫 30%의 프레임만 유지하고 나머지는 제거
        framesRef.current = framesRef.current.slice(
          0,
          Math.floor(framesRef.current.length * 0.3)
        );
      }
    } catch (e) {
      console.error("프레임 캡처 오류:", e);
    }
  };

  // 모든 타이머 정리
  const clearAllTimers = () => {
    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
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
  };

  // 앱 초기화
  const resetApp = () => {
    clearAllTimers();
    framesRef.current = [];
    setFrameCount(0);
    setStatus("idle");
    setStatusMessage(
      "카메라가 초기화되었습니다. '측정 시작' 버튼을 클릭하세요."
    );
    setShowQualityAlert(false);
    setQualityChecks(0);
    startCamera();
  };

  // 외부 처리 상태 변경 감지
  useEffect(() => {
    if (status === "processing" && !isProcessing) {
      // 처리가 완료되면 대화상자 표시
      setShowContinueDialog(true);
    }
  }, [isProcessing]);

  // 측정 반복 대화상자 처리
  const handleContinue = () => {
    setShowContinueDialog(false);
    startCountdown(); // 측정 다시 시작
  };

  const handleCancel = () => {
    setShowContinueDialog(false);
    setStatus("idle");
    startCamera();
  };

  // 컴포넌트 마운트/언마운트 시 처리
  useEffect(() => {
    // iOS 브라우저 대응을 위한 딜레이 추가
    const initTimeout = setTimeout(() => {
      startCamera();
    }, 500);

    return () => {
      clearTimeout(initTimeout);
      clearAllTimers();
      stopCamera();
    };
  }, []);

  // 모바일/데스크톱 전환 감지하여 설정 변경
  useEffect(() => {
    setCameraConstraints({
      video: {
        width: isMobile ? { ideal: 320 } : { ideal: 640 },
        height: isMobile ? { ideal: 240 } : { ideal: 480 },
        facingMode: "user",
        frameRate: isMobile ? { ideal: 15, max: 20 } : { ideal: 30 },
      },
    });

    // 카메라가 활성화된 상태에서 모드가 변경되면 카메라 재시작
    if (cameraActive) {
      stopCamera();
      setTimeout(() => startCamera(), 500);
    }
  }, [isMobile]);

  // 버튼 텍스트 설정
  const getButtonText = () => {
    switch (status) {
      case "recording":
        return (
          <>
            <Pause className="h-4 w-4 mr-2" />
            측정 중단
          </>
        );
      case "countdown":
      case "processing":
        return (
          <>
            <Play className="h-4 w-4 mr-2" />
            측정 시작
          </>
        );
      default:
        return (
          <>
            <Play className="h-4 w-4 mr-2" />
            측정 시작
          </>
        );
    }
  };

  // 버튼 비활성화 조건
  const isButtonDisabled = status === "countdown" || status === "processing";

  // 외부에서 활성화/비활성화를 제어하는 경우에는 UI 컨트롤 숨기기
  if (active !== undefined) {
    return (
      <div className={className}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas
          ref={actualCanvasRef}
          className="absolute top-0 left-0 w-full h-full opacity-0"
        />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative aspect-video bg-black rounded-md overflow-hidden">
            {/* 비디오 및 캔버스 */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${
                !cameraActive && "hidden"
              }`}
            />
            <canvas
              ref={actualCanvasRef}
              className="absolute top-0 left-0 w-full h-full opacity-0"
            />
            <canvas
              ref={faceCanvasRef}
              className="absolute top-0 left-0 w-full h-full"
            />

            {/* 카메라 비활성화 시 검은 화면 */}
            {!cameraActive && <div className="absolute inset-0 bg-black"></div>}

            {/* 카메라 오류 표시 */}
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-white text-center p-4">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-500" />
                  <h3 className="text-lg font-bold mb-2">카메라 오류</h3>
                  <p className="text-sm">{cameraError}</p>
                  <Button
                    className="mt-4"
                    size="sm"
                    onClick={() => {
                      setCameraError(null);
                      startCamera();
                    }}
                  >
                    다시 시도
                  </Button>
                </div>
              </div>
            )}

            {/* 카운트다운 오버레이 */}
            {status === "countdown" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-white text-center">
                  <div className="text-6xl font-bold mb-2">{countdown}</div>
                  <p className="text-xl">측정 준비...</p>
                </div>
              </div>
            )}

            {/* 처리 중 오버레이 */}
            {status === "processing" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-2"></div>
                  <p>{processText}</p>
                </div>
              </div>
            )}

            {/* 진행 상태 표시 */}
            {status === "recording" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
                <div
                  className="h-full bg-red-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}

            {/* 녹화 시간 표시 */}
            {status === "recording" && (
              <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full">
                <span className="font-mono">{remainingTime}초</span>
              </div>
            )}

            {/* 녹화 중 표시 */}
            {status === "recording" && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/70 text-white px-3 py-1 rounded-full">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                <span>측정 중</span>
              </div>
            )}
          </div>

          {/* 품질 알림 */}
          {showQualityAlert && status === "recording" && (
            <Alert
              variant="default"
              className="mt-2 bg-amber-50 border-amber-300"
            >
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700">측정 품질 낮음</AlertTitle>
              <AlertDescription className="text-amber-600">
                얼굴이 잘 보이도록 조명을 밝게 하고 카메라 위치를 조정하세요.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm">
              <p className="font-medium">{statusMessage}</p>
              <p className="text-muted-foreground">
                {frameCount > 0 ? `캡처된 프레임: ${frameCount}` : ""}
                {isMobile && " (모바일 모드)"}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetApp}
                disabled={isButtonDisabled || status === "recording"}
              >
                <Camera className="h-4 w-4 mr-2" />
                재설정
              </Button>

              <Button
                onClick={handleStartClick}
                size="sm"
                variant={status === "recording" ? "destructive" : "default"}
                disabled={isButtonDisabled || !!cameraError}
              >
                {getButtonText()}
              </Button>
            </div>
          </div>

          {/* 모바일 사용자를 위한 추가 팁 */}
          {isMobile && (
            <Alert
              variant="default"
              className="mt-2 bg-blue-50 border-blue-200"
            >
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">모바일 사용 팁</AlertTitle>
              <AlertDescription className="text-blue-700 text-xs">
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>휴대폰을 고정된 위치에 두세요</li>
                  <li>가능한 밝은 조명 환경에서 측정하세요</li>
                  <li>측정 중 화면 방향을 바꾸지 마세요</li>
                  <li>다른 앱으로 전환하지 말고 측정에 집중하세요</li>
                  <li>배터리 절약 모드를 끄고 측정하세요</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 측정 반복 확인 대화상자 */}
      <AlertDialog
        open={showContinueDialog}
        onOpenChange={setShowContinueDialog}
      >
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

// 기존 default export를 유지하기 위한 호환성 코드
export default RPPGCamera;
