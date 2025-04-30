import { NextResponse } from "next/server"
import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"

// This is a server-side route handler that will process the frames using pyVHR
export async function POST(request: Request) {
  try {
    const { frames } = await request.json()

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return NextResponse.json({ error: "Invalid or missing frames data" }, { status: 400 })
    }

    // Create a temporary directory to store frames
    const sessionId = uuidv4()
    const tempDir = path.join(process.cwd(), "tmp", sessionId)

    try {
      await fs.mkdir(tempDir, { recursive: true })

      // Save frames as images
      for (let i = 0; i < frames.length; i++) {
        const base64Data = frames[i].replace(/^data:image\/jpeg;base64,/, "")
        const filePath = path.join(tempDir, `frame_${i.toString().padStart(5, "0")}.jpg`)
        await fs.writeFile(filePath, base64Data, "base64")
      }

      // Call Python script with pyVHR
      const result = await runPyVHR(tempDir)

      // Clean up temporary files
      await fs.rm(tempDir, { recursive: true, force: true })

      return NextResponse.json(result)
    } catch (error) {
      console.error("Error processing frames:", error)

      // Clean up on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.error("Error cleaning up temp files:", cleanupError)
      }

      throw error
    }
  } catch (error) {
    console.error("Error in process-rppg API route:", error)
    return NextResponse.json({ error: "Failed to process video frames" }, { status: 500 })
  }
}

/**
 * Runs the pyVHR processing on the saved frames
 */
async function runPyVHR(framesDir: string): Promise<{ heartRate: number; confidence: number }> {
  return new Promise((resolve, reject) => {
    // Path to Python script that uses pyVHR
    const pythonScript = path.join(process.cwd(), "scripts", "process_rppg.py")

    // Spawn Python process
    const pythonProcess = spawn("python", [pythonScript, framesDir])

    let resultData = ""
    let errorData = ""

    pythonProcess.stdout.on("data", (data) => {
      resultData += data.toString()
    })

    pythonProcess.stderr.on("data", (data) => {
      errorData += data.toString()
    })

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`)
        console.error(`Python stderr: ${errorData}`)
        reject(new Error(`Python process failed with code ${code}`))
        return
      }

      try {
        const result = JSON.parse(resultData)
        resolve(result)
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${resultData}`))
      }
    })
  })
}
