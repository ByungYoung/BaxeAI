"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Camera, HeartPulse } from "lucide-react";
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

// 측정 결과 콜백 타입 정의
export interface RPPGCameraProps {
  onFramesCapture?: (frames: string[]) => void;
  onFrameCaptured?: (imageData: ImageData) => void; // 단일 프레임 캡처 콜백 추가
  active?: boolean; // 외부에서 활성화 여부 제어
  canvasRef?: React.RefObject<HTMLCanvasElement>; // 외부 캔버스 참조 추가
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
  isProcessing = false,
  processText = "처리 중...",
  measurementTime = 30,
  className = "",
}: RPPGCameraProps) => {
  // 참조
  const videoRef = useRef<HTMLVideoElement>(null);
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
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

  // 카메라 초기화
  const startCamera = async () => {
    try {
      if (videoRef.current?.srcObject) {
        return; // 이미 카메라가 활성화된 경우
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setStatusMessage(
          "카메라가 초기화되었습니다. '측정 시작' 버튼을 클릭하세요."
        );
      }
    } catch (err) {
      console.error("카메라 접근 오류:", err);
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
  };

  // 측정 시작 버튼 클릭 처리
  const handleStartClick = () => {
    if (status === "idle") {
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

    // 프레임 캡처 시작 - 50ms 간격으로 캡처 (20 FPS)로 수정
    captureIntervalRef.current = setInterval(captureFrame, 50);

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
      const framesToProcess = [...framesRef.current]; // 프레임 복사본 전달
      onFramesCapture(framesToProcess);
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
      // 캔버스 크기 설정
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // 비디오 프레임을 캔버스에 그리기
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 캔버스 이미지를 데이터 URL로 변환 (JPEG 형식, 품질 0.7)
      const frameData = canvas.toDataURL("image/jpeg", 0.7);

      // 프레임 배열에 추가 및 카운트 증가
      framesRef.current.push(frameData);
      setFrameCount((prev) => prev + 1);
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

  // 컴포넌트 마운트 시 카메라 초기화
  useEffect(() => {
    startCamera();

    return () => {
      clearAllTimers();
      stopCamera();
    };
  }, []);

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

            {/* 카메라 비활성화 시 검은 화면 */}
            {!cameraActive && <div className="absolute inset-0 bg-black"></div>}

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

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm">
              <p className="font-medium">{statusMessage}</p>
              <p className="text-muted-foreground">
                {frameCount > 0 ? `캡처된 프레임: ${frameCount}` : ""}
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
                disabled={isButtonDisabled}
              >
                {getButtonText()}
              </Button>
            </div>
          </div>
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
