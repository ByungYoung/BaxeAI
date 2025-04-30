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
}

/**
 * Sends frames to the server for processing with pyVHR
 */
export async function processWithPyVHR(frames: string[]): Promise<RPPGResult> {
  try {
    // Send frames to the server API endpoint
    const response = await fetch("/api/process-rppg", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ frames }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error sending frames to server:", error);
    throw error;
  }
}
