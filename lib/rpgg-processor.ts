/**
 * Extracts heart rate from RGB signals using frequency analysis
 *
 * @param signals Array of RGB signal arrays [r[], g[], b[]]
 * @param timestamps Array of timestamps for each sample
 * @returns Object containing heart rate and confidence
 */
export function extractHeartRate(
  signals: number[][],
  timestamps: number[]
): { heartRate: number; confidence: number } {
  // Default return if we can't calculate
  const defaultResult = { heartRate: 0, confidence: 0 };

  if (signals[0].length < 60 || !timestamps.length) {
    return defaultResult;
  }

  try {
    // Calculate sampling rate (fps)
    const timeSpan = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000; // in seconds
    const samplingRate = signals[0].length / timeSpan;

    // Use green channel primarily as it typically has the strongest PPG signal
    const greenSignal = signals[1];

    // Normalize the signal
    const normalizedSignal = normalizeSignal(greenSignal);

    // Detrend the signal (remove slow trends)
    const detrendedSignal = detrendSignal(normalizedSignal);

    // Apply bandpass filtering (0.7 Hz to 4 Hz, which is ~40-240 BPM)
    const filteredSignal = bandpassFilter(
      detrendedSignal,
      samplingRate,
      0.7,
      4
    );

    // Perform frequency analysis
    const { dominantFrequency, signalStrength } = performFrequencyAnalysis(
      filteredSignal,
      samplingRate
    );

    // Convert frequency to BPM
    const heartRate = dominantFrequency * 60;

    // Calculate confidence based on signal strength and reasonableness of heart rate
    let confidence = signalStrength;

    // Adjust confidence based on heart rate range
    if (heartRate < 40 || heartRate > 200) {
      confidence *= 0.5;
    }

    return {
      heartRate,
      confidence: Math.min(confidence, 1), // Cap at 1.0
    };
  } catch (error) {
    return defaultResult;
  }
}

/**
 * Normalizes a signal to have zero mean and unit variance
 */
function normalizeSignal(signal: number[]): number[] {
  const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;

  // Calculate standard deviation
  const variance =
    signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    signal.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return signal.map(() => 0);

  // Normalize
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
