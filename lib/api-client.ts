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

// 서버 응답이 실패할 경우 사용할 모의 결과 생성 함수
function generateFallbackResult(errorMessage: string): RPPGResult {
  const randomHeartRate = Math.floor(65 + Math.random() * 20); // 65-85 BPM 범위

  return {
    heartRate: randomHeartRate,
    confidence: 0.3, // 낮은 신뢰도
    simulatedData: true, // 시뮬레이션 데이터 표시
    error: errorMessage,
    hrv: {
      lf: 0.5,
      hf: 0.5,
      lfHfRatio: 1.0,
      sdnn: 40.0,
      rmssd: 30.0,
      pnn50: 25.0,
    },
  };
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

    // 최대 요청 시간 설정 (15초)
    const TIMEOUT_MS = 15000;

    // 타임아웃 처리를 위한 Promise
    const timeoutPromise = new Promise<Response>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error("요청 시간이 초과되었습니다. 서버가 응답하지 않습니다.")
        );
      }, TIMEOUT_MS);
    });

    // 실제 요청 Promise
    const fetchPromise = fetch("/api/process-rppg", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ frames }),
    });

    // 두 Promise 중 먼저 완료되는 것을 기다림
    const response = (await Promise.race([
      fetchPromise,
      timeoutPromise,
    ])) as Response;

    // 최소 표시 시간보다 빨리 응답이 오면 약간의 지연 추가
    const processingTime = Date.now() - requestStartTime;
    if (processingTime < MIN_PROCESSING_TIME) {
      await new Promise((resolve) =>
        setTimeout(resolve, MIN_PROCESSING_TIME - processingTime)
      );
    }

    if (!response.ok) {
      console.error(`Server responded with ${response.status}`);

      // 서버 오류(500)가 발생하면 대체 결과 생성
      if (response.status === 500) {
        console.warn("서버 내부 오류 발생, 모의 데이터 생성");
        return generateFallbackResult(
          "서버 처리 오류 발생. 모의 데이터로 대체되었습니다."
        );
      }

      throw new Error(`서버 응답 오류: ${response.status}`);
    }

    const result = await response.json();

    // 오류 필드가 포함되어 있거나 필수 필드가 없으면 오류 발생
    if (result.error || typeof result.heartRate !== "number") {
      console.warn("Server returned invalid result:", result);

      // 결과에 오류가 있으면 대체 결과 생성
      if (result.error) {
        return generateFallbackResult(`서버 응답: ${result.error}`);
      }

      throw new Error("서버 응답이 유효하지 않습니다.");
    }

    return result;
  } catch (error: any) {
    console.error("Error processing frames:", error);

    // 네트워크 오류, 타임아웃 등의 경우 대체 결과 생성
    return generateFallbackResult(
      error.message || "네트워크 오류가 발생했습니다."
    );
  }
}
