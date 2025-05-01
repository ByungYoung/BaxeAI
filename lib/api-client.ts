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
      throw new Error(`Server responded with ${response.status}`);
    }

    const result = await response.json();

    // 오류 필드가 포함되어 있거나 필수 필드가 없으면 오류 발생
    if (result.error || typeof result.heartRate !== "number") {
      console.warn("Server returned invalid result:", result);
      throw new Error("Invalid result from server");
    }

    return result;
  } catch (error) {
    console.error("Error processing frames:", error);
    throw error;
  }
}
