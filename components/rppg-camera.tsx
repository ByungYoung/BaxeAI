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
import { getWasmRPPGProcessor, disposeWasmRPPGProcessor, HeartRateResult } from "@/lib/rpgg-processor";

// 측정 결과 콜백 타입 정의
export interface RPPGCameraProps {
  onFramesCapture?: (frames: string[]) => void;
  onFrameCaptured?: (imageData: ImageData) => void; // 단일 프레임 캡처 콜백 추가
  onHeartRateResult?: (result: HeartRateResult) => void; // 심박수 결과 콜백 추가
  active?: boolean; // 외부에서 활성화 여부 제어
  canvasRef?: React.RefObject<HTMLCanvasElement>; // 외부 캔버스 참조 추가
  videoRef?: React.RefObject<HTMLVideoElement | null>; // null을 허용하도록 수정
  isProcessing?: boolean;
  processText?: string;
  measurementTime?: number;
  className?: string;
  useWasm?: boolean; // WebAssembly 기반 처리 사용 여부
}

export const RPPGCamera = ({
  onFramesCapture,
  onFrameCaptured,
  onHeartRateResult,
  active,
  canvasRef: externalCanvasRef,
  videoRef: externalVideoRef,
  isProcessing = false,
  processText = "처리 중...",
  measurementTime = 30,
  className = "",
  useWasm = true,
}: RPPGCameraProps) => {
  const isMobile = useIsMobile();

  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const actualCanvasRef = externalCanvasRef || internalCanvasRef;
  const framesRef = useRef<string[]>([]);
  const rppgProcessorRef = useRef<any>(null);

  const [status, setStatus] = useState<
    "idle" | "countdown" | "recording" | "processing"
  >("idle");
  const [cameraActive, setCameraActive] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [remainingTime, setRemainingTime] = useState(measurementTime);
  const [progress, setProgress] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    "시작하려면 '측정 시작' 버튼을 클릭하세요"
  );
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionQuality, setDetectionQuality] = useState<
    "good" | "poor" | "none"
  >("none");
  const [showQualityAlert, setShowQualityAlert] = useState(false);
  const [qualityChecks, setQualityChecks] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [isUsingWasm, setIsUsingWasm] = useState<boolean>(false);
  const [cameraConstraints, setCameraConstraints] = useState({
    video: {
      width: isMobile ? { ideal: 320 } : { ideal: 640 },
      height: isMobile ? { ideal: 240 } : { ideal: 480 },
      facingMode: "user",
      frameRate: isMobile ? { ideal: 15, max: 20 } : { ideal: 30 },
    },
  });

  const initWasmProcessor = async () => {
    if (useWasm) {
      try {
        // 서버 사이드 렌더링 환경인지 확인
        if (typeof window === 'undefined') {
          console.info('서버 환경에서는 WebAssembly 프로세서를 초기화하지 않습니다.');
          return false;
        }
        
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
        
        // WebAssembly 프로세서 초기화 시도
        let processor = null;
        try {
          // Next.js에서 코드 스플리팅을 적용하여 클라이언트에서만 로드
          processor = await getWasmRPPGProcessor(isOffline);
          console.log('WebAssembly 프로세서 인스턴스 생성: ', processor ? '성공' : '실패');
        } catch (wasmError) {
          console.warn("WebAssembly 프로세서 초기화 중 오류 발생:", wasmError);
          processor = null;
        }

        // 프로세서가 초기화되었는지 확인
        if (processor && processor.isReady && processor.isReady()) {
          // 결과 리스너 등록
          processor.addResultListener((result: HeartRateResult) => {
            if (onHeartRateResult) {
              onHeartRateResult(result);
            }
            setHeartRate(result.heartRate);
          });

          // 오류 리스너 등록
          processor.addErrorListener((error: string) => {
            console.warn("rPPG 처리 오류:", error);
          });

          // 프로세서 참조 저장
          rppgProcessorRef.current = processor;
          return true;
        } else {
          // 초기화 실패 시 - 경고로 변경하고 기본 모드로 자연스럽게 전환
          console.warn("WebAssembly rPPG 프로세서를 사용할 수 없어 기본 처리 모드로 전환합니다");
          return false;
        }
      } catch (error) {
        console.warn("WebAssembly 프로세서 초기화 중 오류 발생:", error);
        return false;
      }
    } else {
      console.info("기본 자바스크립트 처리 모드 사용");
      return false;
    }
  };

  // 컴포넌트가 마운트될 때 WebAssembly 프로세서 초기화
  useEffect(() => {
    async function setupProcessor() {
      const wasInitialized = await initWasmProcessor();
      // setState 호출을 useEffect 내에서 수행하여 렌더링 중 상태 업데이트 방지
      setIsUsingWasm(wasInitialized);
      if (!wasInitialized) {
        setStatusMessage("기본 처리 모드로 측정을 진행합니다.");
      }
    }
    
    setupProcessor();
    
    // 컴포넌트가 언마운트될 때 프로세서 정리
    return () => {
      if (rppgProcessorRef.current) {
        disposeWasmRPPGProcessor(rppgProcessorRef.current);
        rppgProcessorRef.current = null;
      }
    };
  }, []);

  // 카메라 초기화 함수
  const initCamera = async () => {
    try {
      if (!videoRef.current) return;
      
      const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints);
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          videoRef.current.play().catch(err => {
            console.error("비디오 재생 시작 오류:", err);
            setCameraError("카메라 스트림을 시작할 수 없습니다.");
          });
        }
        setCameraActive(true);
      };
    } catch (error) {
      console.error("카메라 접근 오류:", error);
      setCameraError(
        "카메라에 접근할 수 없습니다. 권한을 확인하고 다시 시도해 주세요."
      );
    }
  };

  // 카메라 중지 함수
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  // 측정 시작 함수
  const startMeasurement = () => {
    if (!cameraActive) {
      initCamera();
      return;
    }

    setStatus("countdown");
    setCountdown(5);
    setStatusMessage("측정 준비 중...");

    // 카운트다운 시작
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          startRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 녹화 시작
  const startRecording = () => {
    setStatus("recording");
    setRemainingTime(measurementTime);
    setProgress(0);
    setFrameCount(0);
    framesRef.current = [];

    // 프레임 캡처 타이머 (30fps)
    const captureInterval = setInterval(() => {
      if (videoRef.current && actualCanvasRef.current) {
        const video = videoRef.current;
        const canvas = actualCanvasRef.current;
        
        // 프레임 처리를 위해 더 작은 크기의 캔버스 사용 (메모리 사용량 감소)
        const processScale = isUsingWasm ? (isMobile ? 0.5 : 0.75) : 1.0;
        
        // 캔버스 크기 설정 - WebAssembly 처리 시 크기 축소
        canvas.width = video.videoWidth * processScale;
        canvas.height = video.videoHeight * processScale;
        
        // 비디오 프레임을 캔버스에 그리기
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          // 비디오 프레임 그리기 (크기 조정됨)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // 이미지 데이터 가져오기
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // 단일 프레임 캡처 콜백이 있는 경우 호출
          if (onFrameCaptured) {
            onFrameCaptured(imageData);
          }
          
          // WebAssembly 처리기가 초기화된 경우 프레임 전달
          if (rppgProcessorRef.current && isUsingWasm) {
            try {
              // 메모리 문제 디버깅을 위한 정보 로깅
              if (frameCount % 30 === 0) {  // 매 30프레임마다 로깅
                console.debug(`처리 중인 프레임 크기: ${imageData.width}x${imageData.height}, 데이터 크기: ${imageData.data.byteLength}바이트`);
              }
              
              // 20MB를 초과하는 큰 프레임은 처리하지 않음 (메모리 오류 방지)
              if (imageData.data.byteLength > 20 * 1024 * 1024) {
                console.warn(`프레임이 너무 큼: ${imageData.data.byteLength}바이트, 처리 건너뜀`);
                return;
              }
              
              rppgProcessorRef.current.processFrame(imageData, Date.now());
            } catch (error) {
              console.error("프레임 처리 오류:", error);
            }
          }
          
          // 결과 저장을 위해 원본 크기로 다시 그리기
          if (processScale !== 1.0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
          
          // 프레임 저장 (JPEG 품질 조정으로 메모리 사용량 감소)
          const jpegQuality = isMobile ? 0.7 : 0.8;
          framesRef.current.push(canvas.toDataURL('image/jpeg', jpegQuality));
          setFrameCount(prev => prev + 1);
        }
      }
      
      // 남은 시간 업데이트
      setRemainingTime(prev => {
        const newTime = prev - 0.033; // 30fps에서의 프레임 간격 (약 33ms)
        setProgress(((measurementTime - newTime) / measurementTime) * 100);
        
        // 측정 완료
        if (newTime <= 0) {
          clearInterval(captureInterval);
          completeMeasurement();
          return 0;
        }
        
        return newTime;
      });
    }, 33.33); // 약 30fps
    
    // WebAssembly 처리기 시작
    if (rppgProcessorRef.current && isUsingWasm) {
      try {
        rppgProcessorRef.current.startProcessing(1000); // 초당 한 번 결과 계산
      } catch (error) {
        console.error("처리기 시작 오류:", error);
      }
    }
  };

  // 측정 완료
  const completeMeasurement = () => {
    setStatus("processing");
    setStatusMessage(processText || "처리 중...");
    
    // WebAssembly 처리기 중지
    if (rppgProcessorRef.current && isUsingWasm) {
      try {
        rppgProcessorRef.current.stopProcessing();
      } catch (error) {
        console.error("처리기 중지 오류:", error);
      }
    }
    
    // 측정 데이터 처리 - 비동기적으로 처리하여 렌더링 사이클과 분리
    if (onFramesCapture && framesRef.current.length > 0) {
      // setTimeout으로 마이크로태스크 큐에 넣어서 렌더링 사이클 이후에 실행되도록 함
      setTimeout(() => {
        onFramesCapture(framesRef.current);
      }, 0);
    }
  };

  // 측정 중지
  const stopMeasurement = () => {
    setStatus("idle");
    setStatusMessage("시작하려면 '측정 시작' 버튼을 클릭하세요");
    
    // WebAssembly 처리기 리셋
    if (rppgProcessorRef.current) {
      try {
        rppgProcessorRef.current.reset();
      } catch (error) {
        console.error("처리기 리셋 오류:", error);
      }
    }
  };
  
  // 외부에서 활성화 상태 제어
  useEffect(() => {
    if (active === true && status === "idle") {
      startMeasurement();
    } else if (active === false && status !== "idle") {
      stopMeasurement();
    }
  }, [active, status]);

  // 렌더링 반환 부분
  return (
    <div className={`relative ${className}`}>
      {/* 카메라 오류 알림 */}
      {cameraError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>카메라 오류</AlertTitle>
          <AlertDescription>{cameraError}</AlertDescription>
        </Alert>
      )}

      {/* 비디오 컨테이너 */}
      <div className="relative rounded-lg overflow-hidden bg-gray-900 aspect-video">
        {/* 비디오 출력 */}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${
            status === "recording" ? "opacity-100" : "opacity-90"
          }`}
          muted
          playsInline
        />

        {/* 처리용 캔버스 (숨김) */}
        <canvas
          ref={actualCanvasRef}
          className="hidden"
        />

        {/* 얼굴 마스킹용 캔버스 */}
        {faceCanvasRef && (
          <canvas
            ref={faceCanvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
        )}

        {/* 상태 오버레이 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-30 p-6 transition-opacity">
          {/* 카운트다운 표시 */}
          {status === "countdown" && (
            <div className="text-6xl font-bold text-white mb-4">{countdown}</div>
          )}

          {/* 상태 메시지 */}
          <div className="text-center mb-4">
            <p className="text-white text-lg font-medium">{statusMessage}</p>
            
            {/* 측정 중 정보 표시 */}
            {status === "recording" && (
              <div className="flex flex-col items-center gap-2 mt-2">
                <p className="text-white text-sm">
                  남은 시간: {Math.ceil(remainingTime)}초
                </p>
                <p className="text-white text-xs">
                  캡처된 프레임: {frameCount}
                </p>
                {heartRate && (
                  <p className="text-white text-md font-semibold flex items-center">
                    <HeartPulse className="w-5 h-5 mr-1 text-red-400" />
                    {heartRate.toFixed(1)} BPM
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 진행 표시 바 */}
          {status === "recording" && (
            <div className="w-full max-w-md bg-gray-700 rounded-full h-2.5 mb-4">
              <div
                className="bg-green-600 h-2.5 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}

          {/* 컨트롤 버튼 */}
          {!isProcessing && status === "idle" && !cameraActive && (
            <Button
              onClick={startMeasurement}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              카메라 활성화
            </Button>
          )}

          {!isProcessing && status === "idle" && cameraActive && (
            <Button
              onClick={startMeasurement}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              측정 시작
            </Button>
          )}

          {!isProcessing && status === "recording" && (
            <Button
              onClick={stopMeasurement}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Pause className="w-4 h-4" />
              측정 중단
            </Button>
          )}
        </div>
      </div>

      {/* 품질 경고 대화상자 */}
      {showQualityAlert && (
        <Alert 
          variant="warning" 
          className="mt-4 bg-amber-50 border-amber-200"
        >
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-700">측정 품질 저하</AlertTitle>
          <AlertDescription className="text-amber-600">
            얼굴이 {detectionQuality === "none" ? "감지되지 않았습니다" : "잘 보이지 않습니다"}. 
            측정의 정확도를 높이려면 밝은 환경에서 얼굴이 잘 보이도록 카메라를 조정해주세요.
          </AlertDescription>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 border-amber-300 text-amber-700"
            onClick={() => setShowQualityAlert(false)}
          >
            계속 진행
          </Button>
        </Alert>
      )}

      {/* 계속 진행 대화상자 */}
      <AlertDialog open={showContinueDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>측정을 계속하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              얼굴이 감지되지 않거나 잘 보이지 않으면 측정 결과의 정확도가 
              저하될 수 있습니다. 계속 진행하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowContinueDialog(false);
              stopMeasurement();
            }}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowContinueDialog(false);
              startRecording();
            }}>
              계속 진행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// 기본 내보내기 추가
export default RPPGCamera;
