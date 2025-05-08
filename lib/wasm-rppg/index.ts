/**
 * WebAssembly 기반 rPPG 처리 모듈의 TypeScript 인터페이스
 */

export interface HeartRateResult {
  heartRate: number;
  confidence: number;
  hrv?: {
    sdnn: number;
    rmssd: number;
    pnn50: number;
    lf: number;
    hf: number;
    lfHfRatio: number;
    timeMetrics?: {
      sdnn: number;
      rmssd: number;
      pnn50: number;
    };
    frequencyMetrics?: {
      lfPower: number;
      hfPower: number;
      lfHfRatio: number;
    };
  };
  simulatedData?: boolean;
  error?: string;
}

export interface RPPGWorkerMessage {
  type: string;
  data?: any;
  success?: boolean;
  error?: string;
  message?: string;
}

/**
 * WebAssembly 기반 rPPG 프로세서를 관리하는 클래스
 */
export class WasmRPPGProcessor {
  private worker: Worker | null = null;
  private isInitialized: boolean = false;
  private isProcessing: boolean = false;
  private resultListeners: ((result: HeartRateResult) => void)[] = [];
  private errorListeners: ((error: string) => void)[] = [];
  private connectionErrorCount: number = 0;
  private maxRetries: number = 3;
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private simulationTimer: NodeJS.Timeout | null = null;

  /**
   * 프로세서를 초기화합니다.
   * @param {boolean} forceOffline 오프라인 모드 강제 사용 여부
   * @returns {Promise<void>} 초기화 완료 시 해결되는 Promise
   */
  async initialize(forceOffline: boolean = false): Promise<void> {
    // 이미 초기화된 경우
    if (this.isInitialized) {
      return Promise.resolve();
    }

    // 오프라인 모드가 강제되었거나 네트워크 연결이 없는 경우
    if (
      forceOffline ||
      (typeof navigator !== "undefined" && !navigator.onLine)
    ) {
      console.warn(
        "네트워크 연결 없음 또는 오프라인 모드: 시뮬레이션된 결과를 사용합니다"
      );
      this.isInitialized = true;
      return Promise.resolve();
    }

    // 웹 워커 지원 확인
    if (typeof Worker === "undefined") {
      console.warn(
        "Web Workers가 지원되지 않는 환경: 시뮬레이션된 결과를 사용합니다"
      );
      this.isInitialized = true;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        // Next.js 환경에서 Worker 생성 (동적 import 사용)
        if (typeof window !== "undefined") {
          // 브라우저 환경
          const workerUrl = "/libs/rppg-worker.js";

          // 동적으로 Worker 객체 생성
          const WorkerConstructor =
            typeof window !== "undefined" ? window.Worker : null;
          if (!WorkerConstructor) {
            throw new Error("Worker constructor not available");
          }

          // 웹 워커 생성
          this.worker = new WorkerConstructor(workerUrl);
        } else {
          // 서버 환경인 경우 워커를 생성하지 않음
          // 개발 환경에서만 로그를 출력
          if (process.env.NODE_ENV === 'development') {
            console.info("서버 환경에서는 WebAssembly 기능을 사용할 수 없습니다. 시뮬레이션 모드로 진행합니다.");
          }
          this.isInitialized = true;
          return resolve();
        }

        // 메시지 핸들러 설정
        this.worker.onmessage = (e: MessageEvent<RPPGWorkerMessage>) => {
          const { type, data, success, error, message } = e.data;

          switch (type) {
            case "initialized":
              if (success) {
                this.isInitialized = true;
                this.connectionErrorCount = 0; // 연결 성공 시 오류 카운터 리셋
                resolve();
              } else {
                const errorMsg = error || "Failed to initialize RPPG processor";
                if (
                  this.isNetworkError(errorMsg) &&
                  this.connectionErrorCount < this.maxRetries
                ) {
                  // 네트워크 오류인 경우 재시도
                  this.connectionErrorCount++;
                  console.warn(
                    `네트워크 오류 감지: ${this.connectionErrorCount}번째 재시도...`
                  );

                  // 이전 워커 정리
                  if (this.worker) {
                    this.worker.terminate();
                    this.worker = null;
                  }

                  // 지수 백오프로 재시도
                  const retryDelay = Math.min(
                    1000 * Math.pow(2, this.connectionErrorCount - 1),
                    10000
                  );

                  if (this.retryTimeoutId) {
                    clearTimeout(this.retryTimeoutId);
                  }

                  this.retryTimeoutId = setTimeout(() => {
                    this.initialize().then(resolve).catch(reject);
                  }, retryDelay);
                } else {
                  // 최대 재시도 횟수 초과 또는 다른 오류
                  console.warn(
                    "RPPG 프로세서 초기화 실패: 시뮬레이션 모드로 전환합니다"
                  );
                  this.isInitialized = true; // 시뮬레이션 모드로 작동하도록 설정
                  resolve();
                }
              }
              break;

            case "result":
              // 결과 리스너에게 전달
              this.resultListeners.forEach((listener) => listener(data));
              break;

            case "error":
              // 에러 리스너에게 전달
              const errorMessage = message || "Unknown error";
              this.errorListeners.forEach((listener) => listener(errorMessage));
              break;

            case "frameProcessed":
            case "processingStarted":
            case "processingStopped":
            case "reset":
            case "disposed":
              // 상태 변경만 처리
              break;

            default:
              console.warn("Unknown message type from RPPG worker:", type);
          }
        };

        // 에러 핸들러 설정
        this.worker.onerror = (error) => {
          console.error(`Worker 오류: ${error.message}`);

          if (
            this.isNetworkError(error.message) &&
            this.connectionErrorCount < this.maxRetries
          ) {
            // 네트워크 오류인 경우 재시도
            this.connectionErrorCount++;
            console.warn(
              `네트워크 오류 감지: ${this.connectionErrorCount}번째 재시도...`
            );

            // 이전 워커 정리
            if (this.worker) {
              this.worker.terminate();
              this.worker = null;
            }

            // 재시도
            const retryDelay = Math.min(
              1000 * Math.pow(2, this.connectionErrorCount - 1),
              10000
            );

            if (this.retryTimeoutId) {
              clearTimeout(this.retryTimeoutId);
            }

            this.retryTimeoutId = setTimeout(() => {
              this.initialize().then(resolve).catch(reject);
            }, retryDelay);
          } else {
            // 최대 재시도 횟수 초과 또는 다른 오류
            console.warn("RPPG 워커 오류: 시뮬레이션 모드로 전환합니다");
            this.isInitialized = true; // 시뮬레이션 모드로 작동하도록 설정
            resolve();
          }
        };

        // 초기화 명령 전송
        this.worker.postMessage({ command: "init" });

        // 네트워크 변화 감지 이벤트 리스너 설정
        if (typeof window !== "undefined") {
          window.addEventListener("online", this.handleNetworkChange);
          window.addEventListener("offline", this.handleNetworkChange);
        }
      } catch (error) {
        console.error("RPPG 프로세서 초기화 실패:", error);
        console.warn("시뮬레이션 모드로 전환합니다");
        this.isInitialized = true; // 시뮬레이션 모드로 작동하도록 설정
        resolve();
      }
    });
  }

  /**
   * 네트워크 연결 상태 변화를 처리합니다.
   * @private
   */
  private handleNetworkChange = () => {
    if (typeof navigator !== "undefined") {
      if (navigator.onLine) {
        console.log("네트워크 연결 복원됨");

        // 워커가 없거나 초기화되지 않은 경우 다시 초기화 시도
        if (!this.worker && !this.isProcessing) {
          this.initialize().catch((error) => {
            console.error("네트워크 복원 후 재초기화 실패:", error);
          });
        }
      } else {
        console.warn("네트워크 연결 끊김: 시뮬레이션 모드로 전환");

        // 워커 정리하고 시뮬레이션 모드로 전환
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }
      }
    }
  };

  /**
   * 주어진 오류 메시지가 네트워크 관련 오류인지 확인합니다.
   * @param {string} errorMsg 오류 메시지
   * @returns {boolean} 네트워크 오류 여부
   * @private
   */
  private isNetworkError(errorMsg: string): boolean {
    const networkErrorKeywords = [
      "network",
      "connection",
      "internet",
      "offline",
      "failed to fetch",
      "CORS",
      "timeout",
      "ERR_CONNECTION",
      "ERR_NETWORK",
      "ERR_INTERNET",
    ];

    return networkErrorKeywords.some((keyword) =>
      errorMsg.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * 비디오 프레임을 처리합니다.
   * @param {ImageData} imageData 프레임 이미지 데이터
   * @param {number} timestamp 프레임 타임스탬프 (밀리초)
   */
  processFrame(imageData: ImageData, timestamp: number): void {
    if (!this.isInitialized) {
      throw new Error("RPPG processor not initialized");
    }

    // 워커가 없는 경우(오프라인 모드) 아무것도 하지 않음
    if (!this.worker) {
      return;
    }

    try {
      this.worker.postMessage(
        {
          command: "addFrame",
          data: { imageData, timestamp },
        },
        [imageData.data.buffer]
      ); // 버퍼 전송 최적화
    } catch (error) {
      console.warn("프레임 처리 중 오류:", error);
    }
  }

  /**
   * 심박수 계산 처리를 시작합니다.
   * @param {number} intervalMs 결과 계산 간격 (밀리초)
   */
  startProcessing(intervalMs = 1000): void {
    if (!this.isInitialized) {
      throw new Error("RPPG processor not initialized");
    }

    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    // 워커가 없는 경우(오프라인 모드) 시뮬레이션된 결과 제공
    if (!this.worker) {
      // 시뮬레이션 타이머 설정
      this.simulationTimer = setInterval(() => {
        const simulatedResult = this.createSimulatedResult("오프라인 모드");
        this.resultListeners.forEach((listener) => listener(simulatedResult));
      }, intervalMs);
      return;
    }

    this.worker.postMessage({
      command: "startProcessing",
      data: { intervalMs },
    });
  }

  /**
   * 심박수 계산 처리를 중지합니다.
   */
  stopProcessing(): void {
    this.isProcessing = false;

    // 시뮬레이션 타이머 정리
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }

    if (!this.worker) {
      return;
    }

    this.worker.postMessage({ command: "stopProcessing" });
  }

  /**
   * 프로세서를 리셋합니다.
   */
  reset(): void {
    this.isProcessing = false;

    // 시뮬레이션 타이머 정리
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }

    if (!this.worker) {
      return;
    }

    this.worker.postMessage({ command: "reset" });
  }

  /**
   * 프로세서 자원을 해제합니다.
   */
  dispose(): void {
    this.isInitialized = false;
    this.isProcessing = false;

    // 시뮬레이션 타이머 정리
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }

    // 네트워크 이벤트 리스너 제거
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleNetworkChange);
      window.removeEventListener("offline", this.handleNetworkChange);
    }

    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    if (!this.worker) {
      return;
    }

    this.worker.postMessage({ command: "dispose" });
    this.worker.terminate();
    this.worker = null;

    this.resultListeners = [];
    this.errorListeners = [];
  }

  /**
   * 시뮬레이션된 결과를 생성합니다.
   * @param {string} reason 시뮬레이션 이유
   * @returns {HeartRateResult} 시뮬레이션된 심박수 결과
   * @private
   */
  private createSimulatedResult(reason: string): HeartRateResult {
    const heartRate = Math.floor(65 + Math.random() * 20); // 65-85 BPM 범위
    const confidence = 0.5 + Math.random() * 0.3; // 50-80% 신뢰도 (시뮬레이션이므로 낮음)

    const randomLF = 0.4 + Math.random() * 0.3;
    const randomHF = 0.3 + Math.random() * 0.3;
    const lfHfRatio = randomLF / randomHF;

    return {
      heartRate: heartRate,
      confidence: confidence,
      simulatedData: true,
      error: reason,
      hrv: {
        sdnn: parseFloat((35.0 + Math.random() * 15).toFixed(2)),
        rmssd: parseFloat((20.0 + Math.random() * 40).toFixed(2)),
        pnn50: parseFloat((20.0 + Math.random() * 15).toFixed(2)),
        lf: randomLF,
        hf: randomHF,
        lfHfRatio: parseFloat(lfHfRatio.toFixed(2)),
        timeMetrics: {
          sdnn: parseFloat((35.0 + Math.random() * 15).toFixed(2)),
          rmssd: parseFloat((20.0 + Math.random() * 40).toFixed(2)),
          pnn50: parseFloat((20.0 + Math.random() * 15).toFixed(2)),
        },
        frequencyMetrics: {
          lfPower: randomLF * 1000,
          hfPower: randomHF * 1000,
          lfHfRatio: parseFloat(lfHfRatio.toFixed(2)),
        },
      },
    };
  }

  /**
   * 심박수 결과 리스너를 추가합니다.
   * @param {function} listener 리스너 함수
   */
  addResultListener(listener: (result: HeartRateResult) => void): void {
    this.resultListeners.push(listener);
  }

  /**
   * 심박수 결과 리스너를 제거합니다.
   * @param {function} listener 제거할 리스너 함수
   */
  removeResultListener(listener: (result: HeartRateResult) => void): void {
    this.resultListeners = this.resultListeners.filter((l) => l !== listener);
  }

  /**
   * 에러 리스너를 추가합니다.
   * @param {function} listener 리스너 함수
   */
  addErrorListener(listener: (error: string) => void): void {
    this.errorListeners.push(listener);
  }

  /**
   * 에러 리스너를 제거합니다.
   * @param {function} listener 제거할 리스너 함수
   */
  removeErrorListener(listener: (error: string) => void): void {
    this.errorListeners = this.errorListeners.filter((l) => l !== listener);
  }

  /**
   * 프로세서가 초기화되었는지 확인합니다.
   * @returns {boolean} 초기화 여부
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 현재 처리 중인지 확인합니다.
   * @returns {boolean} 처리 중 여부
   */
  isActive(): boolean {
    return this.isProcessing;
  }

  /**
   * 현재 오프라인 모드로 실행 중인지 확인합니다.
   * @returns {boolean} 오프라인 모드 여부
   */
  isOfflineMode(): boolean {
    return this.isInitialized && !this.worker;
  }
}

export default WasmRPPGProcessor;
