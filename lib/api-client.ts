// HRV 지표를 포함한 응답 타입
export interface HRVMetrics {
  lf?: number; // Low Frequency (0.04-0.15Hz)
  hf?: number; // High Frequency (0.15-0.4Hz)
  lfHfRatio?: number; // LF/HF ratio
  sdnn?: number; // Standard Deviation of NN intervals
  rmssd?: number; // Root Mean Square of Successive Differences
  pnn50?: number; // Percentage of successive NN intervals that differ by more than 50ms
}

export interface RPPGResult {
  heartRate: number;
  confidence: number;
  hrv?: HRVMetrics;
  error?: string;
  simulatedData?: boolean; // 시뮬레이션된 데이터인지 여부
}

/**
 * Sends frames to the server for processing with pyVHR
 */
export async function processWithPyVHR(frames: string[]): Promise<RPPGResult> {
  try {
    // 요청 시작 시간
    const requestStartTime = Date.now();

    // 처리 중 최소 표시 시간
    const MIN_PROCESSING_TIME = 2000; // 2초

    // Send frames to the server API endpoint
    const response = await fetch("/api/process-rppg", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ frames }),
    });

    // 최소 표시 시간보다 빨리 응답이 오면 약간의 지연 추가
    const processingTime = Date.now() - requestStartTime;
    if (processingTime < MIN_PROCESSING_TIME) {
      await new Promise((resolve) =>
        setTimeout(resolve, MIN_PROCESSING_TIME - processingTime)
      );
    }

    if (!response.ok) {
      console.error(`Server responded with ${response.status}`);
      // 서버 오류 시 폴백으로 시뮬레이션된 데이터 생성
      return generateFallbackResult(frames.length);
    }

    const result = await response.json();

    // 오류 필드가 포함되어 있거나 필수 필드가 없으면 폴백 결과 사용
    if (result.error || typeof result.heartRate !== "number") {
      console.warn("Server returned invalid result:", result);
      return generateFallbackResult(frames.length);
    }

    return result;
  } catch (error) {
    console.error("Error processing frames:", error);
    // 예외 발생 시 폴백으로 시뮬레이션된 데이터 생성
    return generateFallbackResult(frames.length);
  }
}

/**
 * 서버 처리가 실패했을 때 클라이언트 측에서 대체 결과 생성
 */
function generateFallbackResult(frameCount: number): RPPGResult {
  console.log("Generating fallback result for frames:", frameCount);

  // 프레임 수에 기반하여 약간의 변동성 추가
  const seed = frameCount % 20;
  const heartRate = 65 + seed;
  const confidence = 0.7 + seed / 100;

  return {
    heartRate: heartRate,
    confidence: Math.min(confidence, 0.95),
    hrv: {
      lf: 40.0 + seed * 2,
      hf: 20.0 + seed,
      lfHfRatio: 1.5 + seed / 10,
      sdnn: 35.0 + seed,
      rmssd: 25.0 + seed / 2,
      pnn50: 10.0 + seed / 4,
    },
    simulatedData: true,
    error: "Processing failed, using fallback data",
  };
}
