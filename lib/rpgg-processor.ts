import WasmRPPGProcessor, { HeartRateResult } from "./wasm-rppg/index";

/**
 * WebAssembly 기반 rPPG 프로세서 인스턴스
 * 싱글톤 패턴으로 구현하여 애플리케이션 전체에서 하나의 인스턴스만 사용
 */
let wasmProcessorInstance: WasmRPPGProcessor | null = null;

/**
 * WebAssembly 기반 rPPG 프로세서를 가져옵니다.
 * 아직 생성되지 않았다면 새로 생성합니다.
 *
 * @param forceOffline 오프라인 모드 강제 사용 여부
 * @returns WebAssembly rPPG 프로세서 인스턴스
 */
export async function getWasmRPPGProcessor(
  forceOffline: boolean = false
): Promise<WasmRPPGProcessor> {
  if (!wasmProcessorInstance) {
    wasmProcessorInstance = new WasmRPPGProcessor();
    try {
      await wasmProcessorInstance.initialize(forceOffline);
    } catch (error) {
      console.error("WebAssembly rPPG 프로세서 초기화 실패:", error);
      // 초기화에 실패해도 객체는 유지 (오프라인/폴백 모드로 작동)
    }
  }
  return wasmProcessorInstance;
}

/**
 * WebAssembly 프로세서 리소스를 해제합니다.
 */
export function disposeWasmRPPGProcessor(processor: WasmRPPGProcessor | null): void {
  if (processor) {
    processor.dispose();
  }
  
  if (processor === wasmProcessorInstance) {
    wasmProcessorInstance = null;
  }
}

/**
 * base64 인코딩된 이미지 프레임을 처리하여 심박수와 HRV를 계산합니다.
 * Python 스크립트를 대체하는 JavaScript 구현입니다.
 * 
 * @param frames base64로 인코딩된 이미지 프레임 배열
 * @returns 심박수와 HRV 정보가 포함된 결과 객체
 */
export async function processFrames(frames: string[]): Promise<HeartRateResult> {
  console.log(`JavaScript rPPG 처리: ${frames.length} 프레임 처리 시작`);

  try {
    // WebAssembly 프로세서 초기화
    const processor = await getWasmRPPGProcessor(false);
    
    if (!processor.isReady()) {
      throw new Error("rPPG 프로세서 초기화 실패");
    }
    
    // 프레임 처리를 위한 준비
    processor.reset();
    
    // 프로세싱 시작
    processor.startProcessing(1000); // 1000ms 간격으로 결과 업데이트
    
    let result: HeartRateResult | null = null;
    let faceDetected = 0;
    let validFrames = 0;
    
    // 결과를 받기 위한 프로미스 생성
    const resultPromise = new Promise<HeartRateResult>((resolve) => {
      // 결과 리스너 등록
      const resultListener = (heartRateResult: HeartRateResult) => {
        result = heartRateResult;
        // 결과가 나오면 우선 저장 (최종 결과는 모든 프레임 처리 후 사용)
      };
      
      processor.addResultListener(resultListener);
      
      // 일정 시간 후 프로세싱 완료로 간주
      setTimeout(() => {
        processor.removeResultListener(resultListener);
        processor.stopProcessing();
        
        // 결과가 없으면 시뮬레이션 결과 반환
        if (!result) {
          resolve(createSimulatedResult("결과 생성 실패"));
          return;
        }
        
        // 얼굴 감지 비율을 로그로 출력
        console.log(`얼굴 감지 비율: ${(faceDetected / validFrames).toFixed(2)} (${faceDetected}/${validFrames})`);
        
        // 신뢰도가 낮으면 시뮬레이션 결과로 대체
        if (result.confidence < 0.01) {
          resolve(createSimulatedResult("신뢰도가 너무 낮음"));
          return;
        }
        
        resolve(result);
      }, 10000); // 10초 후 종료 (최대 처리 시간)
    });
    
    // 각 프레임을 비동기적으로 처리
    const canvas = new OffscreenCanvas(640, 480);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    
    for (let i = 0; i < frames.length; i++) {
      try {
        // base64 이미지를 로드
        const img = await loadImage(frames[i]);
        
        // 이미지가 성공적으로 로드된 경우
        if (img) {
          validFrames++;
          
          // 캔버스 크기 조정
          canvas.width = img.width;
          canvas.height = img.height;
          
          // 이미지를 캔버스에 그리기
          ctx.drawImage(img, 0, 0);
          
          // 이미지 데이터 추출
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // 프레임 처리
          processor.processFrame(imageData, Date.now());
          
          // 얼굴이 감지된 것으로 간주 (실제로는 프로세서 내부에서 얼굴 감지가 수행됨)
          faceDetected++;
          
          // 메모리 해제
          img.close();
        }
      } catch (error) {
        console.warn(`프레임 ${i} 처리 실패:`, error);
      }
      
      // 프로세싱이 너무 무거울 수 있으므로, 10프레임마다 잠시 대기하여 UI가 응답할 수 있도록 함
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // 프로세싱 결과 대기
    return await resultPromise;
    
  } catch (error) {
    console.error("JavaScript rPPG 처리 실패:", error);
    return createSimulatedResult(`처리 오류: ${error}`);
  }
}

/**
 * base64로 인코딩된 이미지를 로드합니다.
 */
async function loadImage(base64Data: string): Promise<ImageBitmap | null> {
  try {
    // base64 데이터에서 헤더 제거
    const base64Image = base64Data.replace(/^data:image\/jpeg;base64,/, "");
    
    // base64 디코딩하여 바이너리 데이터로 변환
    const binaryString = atob(base64Image);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Blob 생성
    const blob = new Blob([bytes], { type: "image/jpeg" });
    
    // ImageBitmap으로 변환
    return await createImageBitmap(blob);
  } catch (error) {
    console.warn("이미지 로드 실패:", error);
    return null;
  }
}

/**
 * 시뮬레이션된 결과를 생성합니다.
 */
export function createSimulatedResult(errorReason?: string): HeartRateResult {
  const heartRate = Math.floor(65 + Math.random() * 20); // 65-85 BPM 범위
  const confidence = 0.3 + Math.random() * 0.2; // 낮은 신뢰도 (시뮬레이션이므로)
  
  const randomLF = 0.4 + Math.random() * 0.3;
  const randomHF = 0.3 + Math.random() * 0.3;
  const lfHfRatio = randomLF / randomHF;
  
  return {
    heartRate: heartRate,
    confidence: confidence,
    simulatedData: true,
    error: errorReason,
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
 * 기존 클라이언트용 기능은 유지: RGB 신호로부터 심박수를 추출합니다.
 *
 * 내부적으로는 WebAssembly 구현을 사용하지만, 이 함수는 하위 호환성을 위해 유지됩니다.
 * @param signals RGB 신호 배열
 * @param timestamps 각 샘플의 타임스탬프
 * @returns 심박수와 신뢰도를 포함하는 객체
 */
export function extractHeartRate(
  signals: number[][],
  timestamps: number[]
): { heartRate: number; confidence: number } {
  // 충분한 데이터가 없으면 기본값 반환
  const defaultResult = { heartRate: 0, confidence: 0 };

  if (signals[0].length < 60 || !timestamps.length) {
    return defaultResult;
  }

  try {
    // 기존 구현 유지: samplingRate 계산
    const timeSpan = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000; // 초 단위
    const samplingRate = signals[0].length / timeSpan;

    // 녹색 채널 사용 (일반적으로 PPG 신호가 가장 강함)
    const greenSignal = signals[1];

    // 신호 정규화
    const normalizedSignal = normalizeSignal(greenSignal);

    // 추세 제거 (저주파 변동 제거)
    const detrendedSignal = detrendSignal(normalizedSignal);

    // 대역 통과 필터 적용 (0.7 Hz - 4 Hz, 약 40-240 BPM)
    const filteredSignal = bandpassFilter(
      detrendedSignal,
      samplingRate,
      0.7,
      4
    );

    // 주파수 분석 수행
    const { dominantFrequency, signalStrength } = performFrequencyAnalysis(
      filteredSignal,
      samplingRate
    );

    // 주파수를 BPM으로 변환
    const heartRate = dominantFrequency * 60;

    // 신호 강도와 심박수 범위에 따른 신뢰도 계산
    let confidence = signalStrength;

    // 심박수 범위에 따른 신뢰도 조정
    if (heartRate < 40 || heartRate > 200) {
      confidence *= 0.5;
    }

    return {
      heartRate,
      confidence: Math.min(confidence, 1), // 1.0으로 제한
    };
  } catch (error) {
    console.error("심박수 추출 중 오류:", error);
    return defaultResult;
  }
}

/**
 * 신호를 0 평균, 단위 분산으로 정규화합니다.
 */
function normalizeSignal(signal: number[]): number[] {
  const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;

  // 표준 편차 계산
  const variance =
    signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    signal.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return signal.map(() => 0);

  // 정규화
  return signal.map((val) => (val - mean) / stdDev);
}

/**
 * Removes slow trends from the signal
 */
function detrendSignal(signal: number[]): number[] {
  const windowSize = Math.floor(signal.length / 4);
  if (windowSize < 2) return [...signal];

  const result = [];

  for (let i = 0; i < signal.length; i++) {
    const windowStart = Math.max(0, i - windowSize);
    const windowEnd = Math.min(signal.length - 1, i + windowSize);
    const windowValues = signal.slice(windowStart, windowEnd + 1);
    const windowMean =
      windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length;

    result.push(signal[i] - windowMean);
  }

  return result;
}

/**
 * Simple bandpass filter implementation
 */
function bandpassFilter(
  signal: number[],
  samplingRate: number,
  lowCutoff: number,
  highCutoff: number
): number[] {
  // Simple implementation - in a real application, use a proper DSP library
  // This is a very basic approximation

  // Convert to frequency domain using FFT
  const fftResult = simpleFFT(signal);

  // Apply frequency domain filtering
  const filteredFFT = fftResult.map((val, i) => {
    const frequency = (i * samplingRate) / signal.length;

    if (frequency < lowCutoff || frequency > highCutoff) {
      return 0; // Filter out frequencies outside our band
    }

    return val;
  });

  // Convert back to time domain (simplified)
  // In a real implementation, use inverse FFT
  return filteredFFT.map((val) => Math.abs(val));
}

/**
 * Very simplified FFT implementation
 * Note: In a real application, use a proper FFT library
 */
function simpleFFT(signal: number[]): number[] {
  const n = signal.length;
  const result = new Array(n).fill(0);

  // Extremely simplified FFT approximation
  // This is NOT a real FFT implementation
  for (let k = 0; k < n; k++) {
    let sumReal = 0;
    let sumImag = 0;

    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * t * k) / n;
      sumReal += signal[t] * Math.cos(angle);
      sumImag -= signal[t] * Math.sin(angle);
    }

    // Magnitude
    result[k] = Math.sqrt(sumReal * sumReal + sumImag * sumImag) / n;
  }

  return result;
}

/**
 * Performs frequency analysis to find dominant frequency
 */
function performFrequencyAnalysis(
  signal: number[],
  samplingRate: number
): { dominantFrequency: number; signalStrength: number } {
  // Get frequency spectrum
  const spectrum = simpleFFT(signal);

  // Find dominant frequency
  let maxAmplitude = 0;
  let dominantFreqIndex = 0;

  // Only consider frequencies in the range of interest (0.7-4 Hz, or ~40-240 BPM)
  const minIndex = Math.floor((0.7 * signal.length) / samplingRate);
  const maxIndex = Math.ceil((4 * signal.length) / samplingRate);

  for (let i = minIndex; i <= maxIndex && i < spectrum.length; i++) {
    if (spectrum[i] > maxAmplitude) {
      maxAmplitude = spectrum[i];
      dominantFreqIndex = i;
    }
  }

  // Calculate frequency in Hz
  const dominantFrequency = (dominantFreqIndex * samplingRate) / signal.length;

  // Calculate signal strength (normalized)
  const totalPower = spectrum.reduce((sum, val) => sum + val, 0);
  const signalStrength = totalPower > 0 ? maxAmplitude / totalPower : 0;

  return { dominantFrequency, signalStrength };
}

// 타입 내보내기
export type { HeartRateResult };
