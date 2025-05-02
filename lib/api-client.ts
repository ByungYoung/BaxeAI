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
  const randomRMSSD = 20 + Math.random() * 40; // 20-60ms 범위
  const randomLF = 0.4 + Math.random() * 0.3; // 0.4-0.7 범위
  const randomHF = 0.3 + Math.random() * 0.3; // 0.3-0.6 범위
  const lfHfRatio = randomLF / randomHF;

  return {
    heartRate: randomHeartRate,
    confidence: 0.3, // 낮은 신뢰도
    simulatedData: true, // 시뮬레이션 데이터 표시
    error: errorMessage,
    hrv: {
      lf: randomLF,
      hf: randomHF,
      lfHfRatio: parseFloat(lfHfRatio.toFixed(2)),
      sdnn: parseFloat((35.0 + Math.random() * 15).toFixed(2)),
      rmssd: parseFloat(randomRMSSD.toFixed(2)),
      pnn50: parseFloat((20.0 + Math.random() * 15).toFixed(2)),
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

    // 서버 응답 처리
    let response: Response;
    try {
      // 두 Promise 중 먼저 완료되는 것을 기다림
      response = (await Promise.race([
        fetchPromise,
        timeoutPromise,
      ])) as Response;
    } catch (fetchError: any) {
      // 최소 표시 시간 보장
      const processingTime = Date.now() - requestStartTime;
      if (processingTime < MIN_PROCESSING_TIME) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_PROCESSING_TIME - processingTime)
        );
      }
      return generateFallbackResult(
        fetchError.message || "네트워크 통신 오류가 발생했습니다."
      );
    }

    // 최소 표시 시간보다 빨리 응답이 오면 약간의 지연 추가
    const processingTime = Date.now() - requestStartTime;
    if (processingTime < MIN_PROCESSING_TIME) {
      await new Promise((resolve) =>
        setTimeout(resolve, MIN_PROCESSING_TIME - processingTime)
      );
    }

    if (!response.ok) {
      console.warn(`서버 오류 발생 (상태 코드: ${response.status})`);

      // 모든 서버 오류(4XX, 5XX)에 대해 폴백 결과 생성
      return generateFallbackResult(
        `서버 오류 (${response.status}). 모의 데이터로 대체되었습니다.`
      );
    }

    // 응답 파싱 시도
    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      return generateFallbackResult(
        "서버 응답을 해석할 수 없습니다. 모의 데이터로 대체되었습니다."
      );
    }

    // 오류 필드가 포함되어 있거나 필수 필드가 없으면 오류 발생
    if (result.error || typeof result.heartRate !== "number") {
      console.warn("서버가 유효하지 않은 결과 반환:", result);

      // 결과에 오류가 있으면 대체 결과 생성
      return generateFallbackResult(
        result.error || "서버가 유효하지 않은 심박수 데이터를 반환했습니다."
      );
    }

    // HRV 데이터가 누락된 경우 보완
    if (!result.hrv) {
      result.hrv = {
        lf: 0.5,
        hf: 0.5,
        lfHfRatio: 1.0,
        sdnn: 40.0,
        rmssd: 30.0,
        pnn50: 25.0,
      };
    }

    return result;
  } catch (error: any) {
    // 모든 예외 상황에 대해 대체 결과 생성
    return generateFallbackResult(
      error.message || "알 수 없는 오류가 발생했습니다."
    );
  }
}
