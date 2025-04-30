"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Play, Pause, Camera, HeartPulse } from "lucide-react"
import { processWithPyVHR } from "@/lib/api-client"

export default function RPPGCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [heartRate, setHeartRate] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<number>(0)
  const [statusMessage, setStatusMessage] = useState("Click Start to begin monitoring")
  const [frameCount, setFrameCount] = useState(0)
  const [frames, setFrames] = useState<string[]>([])

  const animationRef = useRef<number>()
  const captureIntervalRef = useRef<NodeJS.Timeout>()

  // Initialize camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setStatusMessage("Camera initialized. Click Start to begin monitoring.")
      }
    } catch (err) {
      console.error("Error accessing camera:", err)
      setStatusMessage("Error accessing camera. Please ensure camera permissions are granted.")
    }
  }

  // Start/stop recording
  const toggleRecording = () => {
    if (isRecording) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current)
      }
      setStatusMessage("Monitoring paused")

      // Process collected frames with pyVHR
      if (frames.length > 0) {
        processFrames()
      }
    } else {
      setFrames([])
      setFrameCount(0)
      setHeartRate(null)
      setConfidence(0)
      setStatusMessage("Capturing frames...")
      startCapturingFrames()
    }
    setIsRecording(!isRecording)
  }

  // Capture frames at regular intervals
  const startCapturingFrames = () => {
    // Capture a frame every 100ms (10 fps) to reduce data size
    captureIntervalRef.current = setInterval(() => {
      captureFrame()
    }, 100)
  }

  // Capture a single frame
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext("2d")

    if (!context || !video.videoWidth) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert canvas to data URL (JPEG format with reduced quality to save bandwidth)
    const frameData = canvas.toDataURL("image/jpeg", 0.7)

    // Add frame to collection
    setFrames((prev) => [...prev, frameData])
    setFrameCount((prev) => prev + 1)

    // Update status message
    if (frameCount % 10 === 0) {
      setStatusMessage(`Captured ${frameCount} frames...`)
    }
  }

  // Process frames with pyVHR on the server
  const processFrames = async () => {
    setIsProcessing(true)
    setStatusMessage("Processing with pyVHR on server...")

    try {
      // Send frames to server for processing
      const result = await processWithPyVHR(frames)

      setHeartRate(result.heartRate)
      setConfidence(result.confidence)
      setStatusMessage("Processing complete")
    } catch (error) {
      console.error("Error processing frames:", error)
      setStatusMessage("Error processing frames. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  // Initialize camera on component mount
  useEffect(() => {
    startCamera()

    return () => {
      // Clean up
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current)
      }

      // Stop camera stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative aspect-video bg-black rounded-md overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full opacity-0" />

            {heartRate && (
              <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-2 rounded-full flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-red-500" />
                <span className="font-mono text-lg">{Math.round(heartRate)} BPM</span>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-2"></div>
                  <p>Processing with pyVHR...</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm">
              <p className="font-medium">{statusMessage}</p>
              <p className="text-muted-foreground">
                {frameCount > 0 ? `Frames captured: ${frameCount}` : ""}
                {confidence > 0 ? ` | Confidence: ${(confidence * 100).toFixed(0)}%` : ""}
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={startCamera}>
                <Camera className="h-4 w-4 mr-2" />
                Reset Camera
              </Button>

              <Button
                onClick={toggleRecording}
                size="sm"
                variant={isRecording ? "destructive" : "default"}
                disabled={isProcessing}
              >
                {isRecording ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Stop & Process
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Capture
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {heartRate && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Heart Rate (pyVHR)</h3>
                <p className="text-muted-foreground text-sm">
                  {confidence > 0.7 ? "Measurement stable" : "Low confidence - results may be inaccurate"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <HeartPulse className="h-6 w-6 text-red-500" />
                <span className="text-3xl font-bold">{Math.round(heartRate)}</span>
                <span className="text-muted-foreground">BPM</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
