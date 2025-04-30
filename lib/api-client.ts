/**
 * Sends frames to the server for processing with pyVHR
 */
export async function processWithPyVHR(frames: string[]): Promise<{ heartRate: number; confidence: number }> {
  try {
    // Send frames to the server API endpoint
    const response = await fetch("/api/process-rppg", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ frames }),
    })

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error sending frames to server:", error)
    throw error
  }
}
