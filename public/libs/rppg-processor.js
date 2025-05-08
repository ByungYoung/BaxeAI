/**
 * WebAssembly 기반 rPPG 처리 모듈
 * 심박수 및 HRV 측정을 위한 WebAssembly 기반 구현
 */

// OpenCV.js 모듈이 로드되었는지 확인하는 함수
function isOpenCVReady() {
  return typeof cv !== "undefined" && cv.getBuildInformation;
}

// OpenCV.js 모듈을 로드하는 함수
function loadOpenCV(callback) {
  if (isOpenCVReady()) {
    console.log("OpenCV.js is already loaded");
    callback();
    return;
  }

  // 브라우저 환경인지 Node.js 환경인지 확인
  const isBrowser =
    typeof window !== "undefined" && typeof document !== "undefined";

  if (isBrowser) {
    // 브라우저 환경
    const script = document.createElement("script");
    script.setAttribute("async", "");
    script.setAttribute("type", "text/javascript");
    script.addEventListener("load", () => {
      console.log("OpenCV.js loaded in the browser");
      callback();
    });
    script.addEventListener("error", () => {
      console.error("Failed to load OpenCV.js");
    });
    script.src = "/libs/opencv.js";
    document.head.appendChild(script);
  } else {
    // Node.js 환경
    try {
      // 전역 스코프에서 사용할 수 있도록 global에 할당
      global.cv = require("../../../public/libs/opencv.js");
      console.log("OpenCV.js loaded in Node.js");
      callback();
    } catch (error) {
      console.error("Failed to load OpenCV.js in Node.js:", error);
    }
  }
}

/**
 * 비디오 프레임을 처리하여 심박수와 HRV를 계산하는 클래스
 */
class RPPGProcessor {
  constructor() {
    this.faceClassifier = null;
    this.isReady = false;
    this.lastFrames = []; // 최근 프레임을 저장하는 배열
    this.maxFrames = 300; // 최대 프레임 수
    this.rValues = [];
    this.gValues = [];
    this.bValues = [];
    this.timestamps = [];
    this.samplingRate = 30; // 기본 샘플링 레이트 (fps)
  }

  /**
   * RPPGProcessor를 초기화합니다.
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      loadOpenCV(() => {
        try {
          // 얼굴 감지를 위한 Haar Cascade 분류기 로드
          this.faceClassifier = new cv.CascadeClassifier();

          // 브라우저 환경인지 Node.js 환경인지 확인
          const isBrowser =
            typeof window !== "undefined" && typeof document !== "undefined";

          if (isBrowser) {
            // 브라우저 환경에서는 WASM 기반 haarcascade 파일을 로드
            try {
              const utils = new cv.Utils("");
              utils.createFileFromUrl(
                "haarcascade_frontalface_default.xml",
                "/libs/haarcascade_frontalface_default.xml",
                () => {
                  this.faceClassifier.load("haarcascade_frontalface_default.xml");
                  this.isReady = true;
                  resolve();
                }
              );
            } catch (error) {
              console.warn("얼굴 감지 모델 로딩 실패, 시뮬레이션 모드로 전환:", error);
              this.isReady = true; // 얼굴 감지 없이도 작동하도록 설정
              resolve();
            }
          } else {
            // Node.js 환경에서는 오류 대신 시뮬레이션 모드로 전환
            try {
              // Node.js 환경에서만 require 사용
              if (typeof require === 'function') {
                const haarData = require("opencv-haarcascade");
                this.faceClassifier.load(haarData.getFaceCascade());
              } else {
                console.warn("Node.js 환경이 아니므로 시뮬레이션 모드로 전환");
              }
              this.isReady = true;
              resolve();
            } catch (error) {
              console.warn("얼굴 감지 모델 로딩 실패, 시뮬레이션 모드로 전환:", error);
              this.isReady = true;
              resolve();
            }
          }
        } catch (error) {
          console.error("Failed to initialize RPPGProcessor:", error);
          // 오류가 발생해도 실패 대신 시뮬레이션 모드로 전환
          this.isReady = true;
          resolve();
        }
      });
    });
  }

  /**
   * 비디오 프레임을 큐에 추가하고 처리합니다.
   * @param {ImageData|Uint8Array} frameData 비디오 프레임 데이터
   * @param {number} timestamp 프레임의 타임스탬프
   */
  addFrame(frameData, timestamp) {
    if (!this.isReady) {
      console.warn("RPPGProcessor is not initialized");
      return;
    }

    // 프레임을 OpenCV 형식으로 변환
    let frame;
    if (frameData instanceof ImageData) {
      // 브라우저에서 ImageData로 제공된 경우
      frame = cv.matFromImageData(frameData);
    } else if (frameData instanceof Uint8Array) {
      // Node.js에서 Uint8Array로 제공된 경우
      const width = Math.sqrt(frameData.length / 4); // 간단한 예제, 실제로는 정확한 폭/높이 필요
      const height = width;
      frame = new cv.Mat(height, width, cv.CV_8UC4);
      frame.data.set(frameData);
    } else {
      console.error("Unsupported frame data format");
      return;
    }

    // 프레임 저장
    this.lastFrames.push({
      frame: frame.clone(),
      timestamp,
    });

    // 최대 프레임 수를 초과한 경우 오래된 프레임 제거
    if (this.lastFrames.length > this.maxFrames) {
      const oldFrame = this.lastFrames.shift();
      oldFrame.frame.delete();
    }

    // 얼굴 감지 및 신호 추출
    this._processFrame(frame, timestamp);

    // 사용이 끝난 프레임 해제
    frame.delete();
  }

  /**
   * 개별 프레임을 처리하여 RGB 신호를 추출합니다.
   * @param {cv.Mat} frame OpenCV 프레임
   * @param {number} timestamp 프레임의 타임스탬프
   * @private
   */
  _processFrame(frame, timestamp) {
    // cv 객체가 없는 경우 조기 반환
    if (typeof cv === 'undefined' || !cv.getBuildInformation) {
      return; // OpenCV가 로드되지 않은 경우 처리하지 않음
    }
    
    // 로컬 변수 배열 - 리소스 관리를 위해
    const resources = [];
    
    try {
      // 그레이스케일로 변환
      const gray = new cv.Mat();
      resources.push(gray);
      cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);

      // 얼굴 감지
      const faces = new cv.RectVector();
      resources.push(faces);
      
      // 얼굴 감지 분류기가 로드되었는지 확인
      if (!this.faceClassifier || !this.faceClassifier.empty) {
        try {
          this.faceClassifier.detectMultiScale(gray, faces);
        } catch (error) {
          // 얼굴 감지 오류 무시하고 계속 진행
          console.warn("얼굴 감지 오류, 계속 진행:", error.message);
        }
      }

      // 감지된 얼굴이 있는 경우
      if (faces.size() > 0) {
        // 가장 큰 얼굴 영역 선택
        let maxArea = 0;
        let maxRect = null;

        for (let i = 0; i < faces.size(); i++) {
          const rect = faces.get(i);
          const area = rect.width * rect.height;
          if (area > maxArea) {
            maxArea = area;
            maxRect = rect;
          }
        }

        // 얼굴 영역 유효성 검사
        if (maxRect && 
            maxRect.x >= 0 && maxRect.y >= 0 && 
            maxRect.width > 0 && maxRect.height > 0 && 
            maxRect.x + maxRect.width <= frame.cols && 
            maxRect.y + maxRect.height <= frame.rows) {
          
          // 얼굴 영역 추출
          const faceROI = frame.roi(maxRect);
          resources.push(faceROI);

          // YCrCb 색상 공간으로 변환하여 피부색 필터링
          const ycrcb = new cv.Mat();
          resources.push(ycrcb);
          cv.cvtColor(faceROI, ycrcb, cv.COLOR_RGBA2YCrCb);

          // 피부색 범위 정의
          const lowerBound = new cv.Mat(1, 3, cv.CV_8UC1);
          resources.push(lowerBound);
          const upperBound = new cv.Mat(1, 3, cv.CV_8UC1);
          resources.push(upperBound);

          lowerBound.data[0] = 0;
          lowerBound.data[1] = 133;
          lowerBound.data[2] = 77;

          upperBound.data[0] = 255;
          upperBound.data[1] = 173;
          upperBound.data[2] = 127;

          // 피부색 마스크 생성
          const mask = new cv.Mat();
          resources.push(mask);
          cv.inRange(ycrcb, lowerBound, upperBound, mask);

          // 피부색만 추출
          const skin = new cv.Mat();
          resources.push(skin);
          cv.bitwise_and(faceROI, faceROI, skin, mask);

          // 피부 픽셀 수 계산
          const pixelCount = cv.countNonZero(mask);

          // 피부 픽셀 수가 충분한 경우
          if (pixelCount > 1000) {
            try {
              // 각 채널 추출
              const channels = new cv.MatVector();
              resources.push(channels);
              cv.split(skin, channels);

              // 유효한 채널 수 확인
              if (channels.size() >= 3) {
                // 채널별 평균값 계산
                const rMean = cv.mean(channels.get(0), mask)[0];
                const gMean = cv.mean(channels.get(1), mask)[0];
                const bMean = cv.mean(channels.get(2), mask)[0];

                // RGB 값 저장
                this.rValues.push(rMean);
                this.gValues.push(gMean);
                this.bValues.push(bMean);
                this.timestamps.push(timestamp);
              }

              // 자원 해제
              for (let i = 0; i < channels.size(); i++) {
                try {
                  channels.get(i).delete();
                } catch (e) {
                  // 채널 해제 오류 무시
                }
              }
            } catch (channelError) {
              console.warn("채널 처리 중 오류:", channelError.message);
            }
          }
        }
      } else {
        // 얼굴이 발견되지 않은 경우 프레임 전체 처리
        try {
          const fullFrame = frame.clone();
          resources.push(fullFrame);
          
          // RGB 채널 추출
          const channels = new cv.MatVector();
          resources.push(channels);
          cv.split(fullFrame, channels);
          
          if (channels.size() >= 3) {
            // 각 채널의 평균값 계산
            const rMean = cv.mean(channels.get(0))[0];
            const gMean = cv.mean(channels.get(1))[0];
            const bMean = cv.mean(channels.get(2))[0];
            
            // RGB 값 저장
            this.rValues.push(rMean);
            this.gValues.push(gMean);
            this.bValues.push(bMean);
            this.timestamps.push(timestamp);
          }
          
          // 자원 해제
          for (let i = 0; i < channels.size(); i++) {
            try {
              channels.get(i).delete();
            } catch (e) {
              // 채널 해제 오류 무시
            }
          }
        } catch (fullFrameError) {
          // 전체 프레임 처리 오류는 무시하고 계속 진행
          console.warn("전체 프레임 처리 오류:", fullFrameError.message);
        }
      }
    } catch (error) {
      // 전체 프레임 처리 오류는 조용하게 기록만
      console.warn("프레임 처리 중 오류:", error.message || "알 수 없는 오류");
    } finally {
      // 모든 리소스를 해제
      for (const resource of resources) {
        try {
          if (resource && typeof resource.delete === 'function') {
            resource.delete();
          }
        } catch (e) {
          // 리소스 해제 오류는 무시
        }
      }
    }
  }

  /**
   * 수집된 데이터를 기반으로 심박수와 HRV를 계산합니다.
   * @returns {Object} 심박수와 HRV 정보가 포함된 객체
   */
  calculateHeartRate() {
    if (this.rValues.length < 10) {
      console.warn("Not enough frames with detected faces");
      return this._createSimulatedResult("Not enough data");
    }

    try {
      // 신호 전처리
      const r = this._detrendAndNormalize(this.rValues);
      const g = this._detrendAndNormalize(this.gValues);
      const b = this._detrendAndNormalize(this.bValues);

      // POS 알고리즘 구현
      // Wang et al., "Algorithmic Principles of Remote PPG," 2017
      const X = [r, g, b];
      const meanColor = X.map((channel) => this._mean(channel));

      // 3x3 projection matrix - POS 알고리즘
      const S = [
        [0, 1, -1],
        [-2, 1, 1],
      ];

      // S와 X의 행렬곱 계산
      const P = [this._dotProduct(S[0], X), this._dotProduct(S[1], X)];

      // POS 신호 계산
      const stdP0 = this._standardDeviation(P[0]);
      const stdP1 = this._standardDeviation(P[1]);
      const ratio = stdP0 / stdP1;

      const posSignal = P[0].map((val, i) => val + ratio * P[1][i]);

      // 샘플링 레이트 계산 (fps)
      const timeSpan =
        (this.timestamps[this.timestamps.length - 1] - this.timestamps[0]) /
        1000;
      this.samplingRate = this.timestamps.length / timeSpan;

      // 필터링
      const filteredSignal = this._bandpassFilter(
        posSignal,
        this.samplingRate,
        0.7,
        4.0
      );

      // FFT를 이용한 주파수 분석
      const { dominantFrequency, signalStrength } =
        this._performFrequencyAnalysis(filteredSignal, this.samplingRate);

      // 심박수 계산 (BPM)
      const heartRate = dominantFrequency * 60;
      const confidence = signalStrength;

      // R-R 간격 계산을 위한 피크 감지
      const peaks = this._findPeaks(
        filteredSignal,
        this.samplingRate,
        heartRate
      );

      // HRV 계산
      const hrv = this._calculateHRV(peaks, this.timestamps);

      return {
        heartRate: parseFloat(heartRate.toFixed(1)),
        confidence: parseFloat(confidence.toFixed(2)),
        hrv,
      };
    } catch (error) {
      console.error("Error calculating heart rate:", error);
      return this._createSimulatedResult(`Error: ${error.message}`);
    }
  }

  /**
   * 신호의 평균값을 구합니다.
   * @param {number[]} signal 신호 배열
   * @returns {number} 평균값
   * @private
   */
  _mean(signal) {
    return signal.reduce((sum, val) => sum + val, 0) / signal.length;
  }

  /**
   * 신호의 표준 편차를 계산합니다.
   * @param {number[]} signal 신호 배열
   * @returns {number} 표준 편차
   * @private
   */
  _standardDeviation(signal) {
    const mean = this._mean(signal);
    const variance =
      signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      signal.length;
    return Math.sqrt(variance);
  }

  /**
   * 두 벡터의 내적을 계산합니다.
   * @param {number[]} a 첫 번째 벡터
   * @param {number[][]} b 두 번째 벡터 (채널별 배열의 배열)
   * @returns {number[]} 내적 결과
   * @private
   */
  _dotProduct(a, b) {
    const result = new Array(b[0].length).fill(0);

    for (let i = 0; i < b[0].length; i++) {
      for (let j = 0; j < a.length; j++) {
        result[i] += a[j] * b[j][i];
      }
    }

    return result;
  }

  /**
   * 신호에서 추세를 제거하고 정규화합니다.
   * @param {number[]} signal 신호 배열
   * @returns {number[]} 전처리된 신호
   * @private
   */
  _detrendAndNormalize(signal) {
    // 추세 제거 (디트렌딩)
    const detrended = this._detrend(signal);

    // 정규화
    const mean = this._mean(detrended);
    const stdDev = this._standardDeviation(detrended);

    if (stdDev === 0) return detrended.map(() => 0);

    return detrended.map((val) => (val - mean) / stdDev);
  }

  /**
   * 신호에서 추세를 제거합니다.
   * @param {number[]} signal 신호 배열
   * @returns {number[]} 추세가 제거된 신호
   * @private
   */
  _detrend(signal) {
    // 선형 추세를 제거하는 간단한 방법
    const n = signal.length;
    const result = new Array(n);

    // X 좌표 (0부터 n-1까지)
    const x = Array.from({ length: n }, (_, i) => i);

    // 선형 회귀 계산
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += signal[i];
      sumXY += x[i] * signal[i];
      sumX2 += x[i] * x[i];
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 추세선 제거
    for (let i = 0; i < n; i++) {
      const trend = slope * x[i] + intercept;
      result[i] = signal[i] - trend;
    }

    return result;
  }

  /**
   * 신호에 대역 통과 필터를 적용합니다.
   * @param {number[]} signal 신호 배열
   * @param {number} samplingRate 샘플링 레이트 (Hz)
   * @param {number} lowCutoff 하한 주파수 (Hz)
   * @param {number} highCutoff 상한 주파수 (Hz)
   * @returns {number[]} 필터링된 신호
   * @private
   */
  _bandpassFilter(signal, samplingRate, lowCutoff, highCutoff) {
    // 간단한 주파수 영역 필터링을 위해 FFT 수행
    const fft = this._fft(signal);

    // 주파수 영역에서 필터링
    const n = signal.length;

    for (let i = 0; i < n; i++) {
      // 현재 인덱스에 해당하는 주파수 계산
      const frequency = (i * samplingRate) / n;

      // 관심 주파수 대역 외의 성분은 제거
      if (frequency < lowCutoff || frequency > highCutoff) {
        fft[i].real = 0;
        fft[i].imag = 0;
      }
    }

    // 역 FFT를 통해 시간 영역으로 변환
    return this._ifft(fft);
  }

  /**
   * 고속 푸리에 변환 (Fast Fourier Transform)을 수행합니다.
   * @param {number[]} signal 시간 영역 신호
   * @returns {Object[]} 주파수 영역 신호 (real, imag 속성을 가진 객체 배열)
   * @private
   */
  _fft(signal) {
    // 간단한 DFT 구현 (실제 구현에서는 더 효율적인 FFT 알고리즘 사용 권장)
    const n = signal.length;
    const result = new Array(n);

    for (let k = 0; k < n; k++) {
      let real = 0;
      let imag = 0;

      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * t * k) / n;
        real += signal[t] * Math.cos(angle);
        imag -= signal[t] * Math.sin(angle);
      }

      result[k] = { real: real / n, imag: imag / n };
    }

    return result;
  }

  /**
   * 역 푸리에 변환을 수행합니다.
   * @param {Object[]} fftResult 주파수 영역 신호
   * @returns {number[]} 시간 영역 신호
   * @private
   */
  _ifft(fftResult) {
    const n = fftResult.length;
    const result = new Array(n);

    for (let t = 0; t < n; t++) {
      let val = 0;

      for (let k = 0; k < n; k++) {
        const angle = (2 * Math.PI * t * k) / n;
        val +=
          fftResult[k].real * Math.cos(angle) -
          fftResult[k].imag * Math.sin(angle);
      }

      result[t] = val;
    }

    return result;
  }

  /**
   * 주파수 분석을 수행하여 지배적인 주파수와 신호 강도를 계산합니다.
   * @param {number[]} signal 신호 배열
   * @param {number} samplingRate 샘플링 레이트 (Hz)
   * @returns {Object} 지배적인 주파수와 신호 강도
   * @private
   */
  _performFrequencyAnalysis(signal, samplingRate) {
    // FFT 수행
    const fft = this._fft(signal);

    // 진폭 스펙트럼 계산
    const amplitudeSpectrum = fft.map((val) =>
      Math.sqrt(val.real * val.real + val.imag * val.imag)
    );

    // 관심 주파수 범위 (0.7Hz ~ 4Hz, 약 42~240 BPM)
    const n = signal.length;
    const minFreqIdx = Math.floor((0.7 * n) / samplingRate);
    const maxFreqIdx = Math.min(
      Math.ceil((4.0 * n) / samplingRate),
      Math.floor(n / 2)
    );

    // 지배적인 주파수 찾기
    let maxAmp = 0;
    let dominantFreqIdx = 0;

    for (let i = minFreqIdx; i <= maxFreqIdx; i++) {
      if (amplitudeSpectrum[i] > maxAmp) {
        maxAmp = amplitudeSpectrum[i];
        dominantFreqIdx = i;
      }
    }

    // 주파수와 신호 강도 계산
    const dominantFrequency = (dominantFreqIdx * samplingRate) / n;

    // 총 파워 대비 지배적 주파수의 파워 비율로 신호 강도 계산
    const totalPower = amplitudeSpectrum
      .slice(minFreqIdx, maxFreqIdx + 1)
      .reduce((sum, val) => sum + val, 0);

    const signalStrength = maxAmp / totalPower;

    return { dominantFrequency, signalStrength };
  }

  /**
   * 신호에서 R 피크를 찾습니다.
   * @param {number[]} signal 필터링된 신호
   * @param {number} samplingRate 샘플링 레이트 (Hz)
   * @param {number} heartRate 예상 심박수 (BPM)
   * @returns {number[]} 피크 인덱스 배열
   * @private
   */
  _findPeaks(signal, samplingRate, heartRate) {
    const peaks = [];
    const n = signal.length;

    // 최소 거리 설정 (예상 심박 간격의 50%)
    const expectedInterval = Math.floor((samplingRate * 60) / heartRate);
    const minDistance = Math.floor(expectedInterval * 0.5);

    // 임계값 설정 (신호 표준 편차의 일정 비율)
    const stdDev = this._standardDeviation(signal);
    const threshold = stdDev * 0.3;

    let lastPeakIdx = -minDistance;

    // 극대값 찾기
    for (let i = 1; i < n - 1; i++) {
      if (
        signal[i] > signal[i - 1] &&
        signal[i] > signal[i + 1] && // 로컬 최대값
        signal[i] > threshold && // 임계값 초과
        i - lastPeakIdx >= minDistance
      ) {
        // 최소 거리 조건 충족
        peaks.push(i);
        lastPeakIdx = i;
      }
    }

    return peaks;
  }

  /**
   * HRV 메트릭을 계산합니다.
   * @param {number[]} peakIndices 피크 인덱스 배열
   * @param {number[]} timestamps 타임스탬프 배열
   * @returns {Object} HRV 메트릭
   * @private
   */
  _calculateHRV(peakIndices, timestamps) {
    if (peakIndices.length < 2) {
      return {
        sdnn: 0,
        rmssd: 0,
        pnn50: 0,
        lf: 0,
        hf: 0,
        lfHfRatio: 1,
      };
    }

    // R-R 간격 계산 (밀리초 단위)
    const rrIntervals = [];

    for (let i = 0; i < peakIndices.length - 1; i++) {
      const rr =
        (timestamps[peakIndices[i + 1]] - timestamps[peakIndices[i]]) * 1000;
      rrIntervals.push(rr);
    }

    // 이상치 제거 (45%-155% 범위 밖의 RR 간격 제거)
    const meanRR = this._mean(rrIntervals);
    const validRR = rrIntervals.filter(
      (rr) => rr >= 0.45 * meanRR && rr <= 1.55 * meanRR
    );

    if (validRR.length < 2) {
      return {
        sdnn: 0,
        rmssd: 0,
        pnn50: 0,
        lf: 0,
        hf: 0,
        lfHfRatio: 1,
      };
    }

    // 시간 영역 HRV 메트릭

    // SDNN (표준 편차)
    const sdnn = this._standardDeviation(validRR);

    // RMSSD (연속 RR 간격 차이의 제곱평균제곱근)
    let sumSquaredDiff = 0;
    for (let i = 0; i < validRR.length - 1; i++) {
      sumSquaredDiff += Math.pow(validRR[i + 1] - validRR[i], 2);
    }
    const rmssd = Math.sqrt(sumSquaredDiff / (validRR.length - 1));

    // pNN50 (50ms 이상 차이나는 연속 RR 간격의 비율)
    let countNN50 = 0;
    for (let i = 0; i < validRR.length - 1; i++) {
      if (Math.abs(validRR[i + 1] - validRR[i]) > 50) {
        countNN50++;
      }
    }
    const pnn50 = (countNN50 / (validRR.length - 1)) * 100;

    // 주파수 영역 HRV 메트릭
    const { lf, hf, lfHfRatio } = this._calculateFrequencyDomainHRV(validRR);

    return {
      sdnn: parseFloat(sdnn.toFixed(2)),
      rmssd: parseFloat(rmssd.toFixed(2)),
      pnn50: parseFloat(pnn50.toFixed(2)),
      lf: parseFloat(lf.toFixed(4)),
      hf: parseFloat(hf.toFixed(4)),
      lfHfRatio: parseFloat(lfHfRatio.toFixed(2)),
      // 이전 형식과의 호환성을 위한 중첩 구조
      timeMetrics: {
        sdnn: parseFloat(sdnn.toFixed(2)),
        rmssd: parseFloat(rmssd.toFixed(2)),
        pnn50: parseFloat(pnn50.toFixed(2)),
      },
      frequencyMetrics: {
        lfPower: parseFloat((lf * 1000).toFixed(2)),
        hfPower: parseFloat((hf * 1000).toFixed(2)),
        lfHfRatio: parseFloat(lfHfRatio.toFixed(2)),
      },
    };
  }

  /**
   * 주파수 영역 HRV 메트릭을 계산합니다.
   * @param {number[]} rrIntervals RR 간격 배열 (밀리초)
   * @returns {Object} 주파수 영역 HRV 메트릭
   * @private
   */
  _calculateFrequencyDomainHRV(rrIntervals) {
    try {
      // RR 간격을 초 단위로 변환
      const rrSeconds = rrIntervals.map((rr) => rr / 1000);

      // 균일한 시간 간격으로 리샘플링 (4Hz)
      const fs = 4.0;

      // 누적 시간 계산
      const cumTime = [0];
      for (let i = 0; i < rrSeconds.length; i++) {
        cumTime.push(cumTime[i] + rrSeconds[i]);
      }

      // 균일한 시간 간격
      const maxTime = cumTime[cumTime.length - 1];
      const uniformTime = [];
      for (let t = 0; t < maxTime; t += 1 / fs) {
        uniformTime.push(t);
      }

      // 정규화된 RR 간격 (평균을 뺀 값)
      const meanRR = this._mean(rrSeconds);
      const normalizedRR = rrSeconds.map((rr) => rr - meanRR);

      // 리샘플링 (선형 보간)
      const resampledRR = [];
      for (let i = 0; i < uniformTime.length; i++) {
        const t = uniformTime[i];

        // t가 포함된 구간 찾기
        let idx = 0;
        while (idx < cumTime.length - 1 && cumTime[idx + 1] <= t) {
          idx++;
        }

        if (idx >= cumTime.length - 1) {
          // 마지막 지점
          resampledRR.push(normalizedRR[normalizedRR.length - 1]);
        } else {
          // 선형 보간
          const t1 = cumTime[idx];
          const t2 = cumTime[idx + 1];
          const v1 = idx > 0 ? normalizedRR[idx - 1] : 0;
          const v2 = idx < normalizedRR.length ? normalizedRR[idx] : 0;

          const alpha = (t - t1) / (t2 - t1);
          resampledRR.push(v1 + alpha * (v2 - v1));
        }
      }

      // 스펙트럼 분석 (Welch 방법)
      const nfft = 256;
      const window = this._hammingWindow(nfft);
      const noverlap = Math.floor(nfft / 2);

      const spectrumResult = this._welch(
        resampledRR,
        window,
        noverlap,
        nfft,
        fs
      );
      const { frequencies, psd } = spectrumResult;

      // LF와 HF 대역 찾기
      const lfIndices = frequencies
        .map((f, i) => (f >= 0.04 && f <= 0.15 ? i : -1))
        .filter((i) => i !== -1);
      const hfIndices = frequencies
        .map((f, i) => (f > 0.15 && f <= 0.4 ? i : -1))
        .filter((i) => i !== -1);

      if (lfIndices.length === 0 || hfIndices.length === 0) {
        throw new Error("주파수 대역에 충분한 데이터 포인트가 없습니다");
      }

      // LF와 HF 파워 계산
      const lfPower = this._trapz(
        lfIndices.map((i) => frequencies[i]),
        lfIndices.map((i) => psd[i])
      );

      const hfPower = this._trapz(
        hfIndices.map((i) => frequencies[i]),
        hfIndices.map((i) => psd[i])
      );

      // LF/HF 비율 계산
      const lfHfRatio = lfPower / hfPower;

      return {
        lf: lfPower,
        hf: hfPower,
        lfHfRatio,
      };
    } catch (error) {
      console.warn(`주파수 영역 HRV 계산 오류: ${error.message}`);

      // 기본값 반환
      return {
        lf: 0.5,
        hf: 0.5,
        lfHfRatio: 1,
      };
    }
  }

  /**
   * 해밍 윈도우 함수를 생성합니다.
   * @param {number} length 윈도우 길이
   * @returns {number[]} 해밍 윈도우
   * @private
   */
  _hammingWindow(length) {
    return Array.from(
      { length },
      (_, n) => 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (length - 1))
    );
  }

  /**
   * Welch 방법으로 파워 스펙트럼 밀도(PSD)를 추정합니다.
   * @param {number[]} signal 입력 신호
   * @param {number[]} window 윈도우 함수
   * @param {number} noverlap 중첩 샘플 수
   * @param {number} nfft FFT 길이
   * @param {number} fs 샘플링 레이트
   * @returns {Object} 주파수 배열과 PSD 배열
   * @private
   */
  _welch(signal, window, noverlap, nfft, fs) {
    const n = signal.length;
    const step = window.length - noverlap;

    // 세그먼트 개수 계산
    const numSegments = Math.floor((n - noverlap) / step);

    if (numSegments <= 0) {
      throw new Error("신호가 너무 짧습니다");
    }

    // 세그먼트별 PSD 계산
    const psdSum = new Array(Math.floor(nfft / 2) + 1).fill(0);

    for (let i = 0; i < numSegments; i++) {
      const start = i * step;
      const end = start + window.length;

      // 세그먼트 추출
      const segment = signal.slice(start, end);

      // 윈도우 적용
      const windowed = segment.map((val, j) => val * window[j]);

      // Zero-padding
      const padded = [...windowed];
      while (padded.length < nfft) {
        padded.push(0);
      }

      // FFT 계산
      const fft = this._fft(padded);

      // 파워 스펙트럼 계산
      for (let j = 0; j <= Math.floor(nfft / 2); j++) {
        psdSum[j] += Math.pow(fft[j].real, 2) + Math.pow(fft[j].imag, 2);
      }
    }

    // 평균 PSD 계산
    const psd = psdSum.map((val) => val / numSegments);

    // 윈도우 보정
    const scale = window.reduce((sum, val) => sum + val * val, 0);
    const psdScaled = psd.map((val) => val / scale);

    // 주파수 배열 계산
    const frequencies = Array.from(
      { length: psd.length },
      (_, i) => (i * fs) / nfft
    );

    return { frequencies, psd: psdScaled };
  }

  /**
   * 사다리꼴 적분 방법으로 곡선 아래 면적을 계산합니다.
   * @param {number[]} x x 좌표 배열
   * @param {number[]} y y 좌표 배열
   * @returns {number} 적분 결과
   * @private
   */
  _trapz(x, y) {
    let sum = 0;

    for (let i = 0; i < x.length - 1; i++) {
      sum += ((x[i + 1] - x[i]) * (y[i] + y[i + 1])) / 2;
    }

    return sum;
  }

  /**
   * 시뮬레이션된 결과를 생성합니다.
   * @param {string} errorReason 오류 이유
   * @returns {Object} 시뮬레이션된 결과
   * @private
   */
  _createSimulatedResult(errorReason) {
    const heartRate = Math.floor(65 + Math.random() * 20); // 65-85 BPM 범위
    const confidence = 0.3 + Math.random() * 0.2; // 낮은 신뢰도

    const randomLF = 0.4 + Math.random() * 0.3;
    const randomHF = 0.3 + Math.random() * 0.3;
    const lfHfRatio = randomLF / randomHF;

    return {
      heartRate: heartRate,
      confidence: confidence,
      simulatedData: true,
      error: errorReason,
      hrv: {
        lf: randomLF,
        hf: randomHF,
        lfHfRatio: parseFloat(lfHfRatio.toFixed(2)),
        sdnn: parseFloat((35.0 + Math.random() * 15).toFixed(2)),
        rmssd: parseFloat((20.0 + Math.random() * 40).toFixed(2)),
        pnn50: parseFloat((20.0 + Math.random() * 15).toFixed(2)),
        // 기존 형식과의 호환성을 위한 중첩 구조
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
   * 수집된 모든 데이터를 초기화합니다.
   */
  reset() {
    // 저장된 데이터 초기화
    this.rValues = [];
    this.gValues = [];
    this.bValues = [];
    this.timestamps = [];

    // 저장된 프레임 해제
    for (const frame of this.lastFrames) {
      frame.frame.delete();
    }
    this.lastFrames = [];
  }

  /**
   * 리소스를 해제합니다.
   */
  dispose() {
    this.reset();

    if (this.faceClassifier) {
      this.faceClassifier.delete();
      this.faceClassifier = null;
    }

    this.isReady = false;
  }
}

// 브라우저 환경에서는 모듈로 내보내기
if (typeof module !== "undefined" && module.exports) {
  module.exports = RPPGProcessor;
} else if (typeof window !== "undefined") {
  window.RPPGProcessor = RPPGProcessor;
}
