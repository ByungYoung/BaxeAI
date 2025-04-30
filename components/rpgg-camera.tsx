"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Camera, HeartPulse } from "lucide-react";
import { processWithPyVHR, HRVMetrics } from "@/lib/api-client";

// 측정 시간 설정 (초)
const RECORDING_DURATION = 30; // 30초 측정
const COUNTDOWN_DURATION = 5; // 5초 카운트다운

export default function RPPGCamera() {
  // 참조
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<string[]>([]); // 프레임 데이터를 참조로 관리

  // 상태 변수
  const [status, setStatus] = useState<
    "idle" | "countdown" | "recording" | "processing"
  >("idle");
  const [cameraActive, setCameraActive] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_DURATION);
  const [remainingTime, setRemainingTime] = useState(RECORDING_DURATION);
  const [progress, setProgress] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    "시작하려면 '측정 시작' 버튼을 클릭하세요"
  );

  // 측정 결과
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [hrvMetrics, setHrvMetrics] = useState<HRVMetrics | null>(null);

  // 타이머 참조
  const countdownTimerRef = useRef<NodeJS.Timeout>();
  const recordingTimerRef = useRef<NodeJS.Timeout>();
  const captureIntervalRef = useRef<NodeJS.Timeout>();

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
    setCountdown(COUNTDOWN_DURATION);
    setProgress(0);
    setFrameCount(0);
    setHeartRate(null);
    setConfidence(0);
    setHrvMetrics(null);
    framesRef.current = [];
    setStatusMessage("측정 준비 중...");

    // 카운트다운 타이머 설정
    let count = COUNTDOWN_DURATION;
    countdownTimerRef.current = setInterval(() => {
      count--;
      setCountdown(count);

      if (count <= 0) {
        clearInterval(countdownTimerRef.current);
        startRecording();
      }
    }, 1000);
  };

  // 녹화 시작
  const startRecording = () => {
    setStatus("recording");
    setRemainingTime(RECORDING_DURATION);
    setStatusMessage("측정 중...");
    framesRef.current = []; // 프레임 배열 초기화
    setFrameCount(0); // 프레임 카운트 초기화

    // 프레임 캡처 시작 - 100ms 간격으로 캡처 (10 FPS)
    captureIntervalRef.current = setInterval(captureFrame, 100);

    // 녹화 타이머 시작
    let timeLeft = RECORDING_DURATION;
    recordingTimerRef.current = setInterval(() => {
      timeLeft--;
      setRemainingTime(timeLeft);
      setProgress(((RECORDING_DURATION - timeLeft) / RECORDING_DURATION) * 100);

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
    setStatusMessage("처리 중...");
    stopCamera(); // 처리 중에는 카메라 끄기

    // 현재까지 캡처된 프레임 수 확인
    console.log(`총 캡처된 프레임 수: ${framesRef.current.length}`);

    // 캡처된 프레임이 충분하지 않은 경우
    if (framesRef.current.length < 10) {
      console.error("처리할 충분한 프레임이 없습니다.");
      setStatusMessage(
        "오류: 충분한 프레임이 캡처되지 않았습니다. 다시 시도해주세요."
      );
      setStatus("idle");
      startCamera();
      return;
    }

    // 서버에 프레임 전송 및 처리
    processFrames();
  };

  // 프레임 캡처
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
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

  // 서버에서 프레임 처리
  const processFrames = async () => {
    const framesToProcess = [...framesRef.current]; // 현재 프레임의 복사본 사용
    console.log(`처리 시작: ${framesToProcess.length}개 프레임`);

    try {
      // 최소 2초간 "처리 중" 상태를 보여주기 위한 지연
      const processingStart = Date.now();
      const result = await processWithPyVHR(framesToProcess);
      const processingTime = Date.now() - processingStart;

      if (processingTime < 2000) {
        await new Promise((resolve) =>
          setTimeout(resolve, 2000 - processingTime)
        );
      }

      // 결과 설정
      setHeartRate(result.heartRate);
      setConfidence(result.confidence);

      if (result.hrv) {
        setHrvMetrics(result.hrv);
      }

      setStatusMessage("측정 완료");
    } catch (error) {
      console.error("프레임 처리 오류:", error);
      setStatusMessage(
        `오류가 발생했습니다: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    } finally {
      setStatus("idle");
      startCamera();
    }
  };

  // 모든 타이머 정리
  const clearAllTimers = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
  };

  // 앱 초기화
  const resetApp = () => {
    clearAllTimers();
    framesRef.current = [];
    setFrameCount(0);
    setHeartRate(null);
    setConfidence(0);
    setHrvMetrics(null);
    setStatus("idle");
    setStatusMessage(
      "카메라가 초기화되었습니다. '측정 시작' 버튼을 클릭하세요."
    );
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

  return (
    <div className="space-y-4">
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
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full opacity-0"
            />

            {/* 카메라 비활성화 시 검은 화면 */}
            {!cameraActive && <div className="absolute inset-0 bg-black"></div>}

            {/* 심박수 표시 */}
            {heartRate && status === "idle" && (
              <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-2 rounded-full flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-red-500" />
                <span className="font-mono text-lg">
                  {Math.round(heartRate)} BPM
                </span>
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
                  <p>처리 중...</p>
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
                {confidence > 0
                  ? ` | 신뢰도: ${(confidence * 100).toFixed(0)}%`
                  : ""}
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

      {/* 심박수 결과 카드 */}
      {heartRate && status === "idle" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">심박수</h3>
                <p className="text-muted-foreground text-sm">
                  {confidence > 0.7
                    ? "측정값 안정적"
                    : "낮은 신뢰도 - 측정이 부정확할 수 있습니다"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <HeartPulse className="h-6 w-6 text-red-500" />
                <span className="text-3xl font-bold">
                  {Math.round(heartRate)}
                </span>
                <span className="text-muted-foreground">BPM</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* HRV 지표 카드 */}
      {hrvMetrics && status === "idle" && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">심박 변이도(HRV) 지표</h3>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* 주파수 영역 지표 */}
              <div className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground">LF (저주파)</div>
                <div className="font-mono text-lg">
                  {hrvMetrics.lf !== undefined
                    ? hrvMetrics.lf.toFixed(2)
                    : "N/A"}
                </div>
                <div className="text-xs text-muted-foreground">ms²</div>
              </div>

              <div className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground">HF (고주파)</div>
                <div className="font-mono text-lg">
                  {hrvMetrics.hf !== undefined
                    ? hrvMetrics.hf.toFixed(2)
                    : "N/A"}
                </div>
                <div className="text-xs text-muted-foreground">ms²</div>
              </div>

              <div className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground">LF/HF 비율</div>
                <div className="font-mono text-lg">
                  {hrvMetrics.lfHfRatio !== undefined
                    ? hrvMetrics.lfHfRatio.toFixed(2)
                    : "N/A"}
                </div>
              </div>

              {/* 시간 영역 지표 */}
              <div className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground">SDNN</div>
                <div className="font-mono text-lg">
                  {hrvMetrics.sdnn !== undefined
                    ? hrvMetrics.sdnn.toFixed(2)
                    : "N/A"}
                </div>
                <div className="text-xs text-muted-foreground">ms</div>
              </div>

              <div className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground">RMSSD</div>
                <div className="font-mono text-lg">
                  {hrvMetrics.rmssd !== undefined
                    ? hrvMetrics.rmssd.toFixed(2)
                    : "N/A"}
                </div>
                <div className="text-xs text-muted-foreground">ms</div>
              </div>

              <div className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground">pNN50</div>
                <div className="font-mono text-lg">
                  {hrvMetrics.pnn50 !== undefined
                    ? hrvMetrics.pnn50.toFixed(2)
                    : "N/A"}
                </div>
                <div className="text-xs text-muted-foreground">%</div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              LF (0.04-0.15Hz): 심장의 교감신경 및 부교감신경 활동을 나타냅니다.
              <br />
              HF (0.15-0.4Hz): 주로 부교감신경(미주신경) 활동을 나타냅니다.
              <br />
              LF/HF: 자율신경계 균형을 나타내며, 일반적으로 교감신경/부교감신경
              활동의 비율을 반영합니다.
              <br />
              SDNN: 모든 심박 간격의 표준 편차로, 전반적인 HRV 변동성을
              나타냅니다.
              <br />
              RMSSD: 연속적인 심박간 간격 차이의 제곱 평균 제곱근으로,
              부교감신경 활동을 반영합니다.
              <br />
              pNN50: 50ms 이상 차이나는 연속된 심박간 간격의 비율로, 부교감신경
              활동을 나타냅니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
