import { HeartPulse } from "lucide-react"
import RPPGCamera from "@/components/rpgg-camera"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <HeartPulse className="h-8 w-8 text-red-500" />
            <h1 className="text-3xl font-bold">pyVHR Heart Rate Monitor</h1>
          </div>
          <p className="text-muted-foreground">Advanced rPPG using pyVHR on the server</p>
        </div>

        <RPPGCamera />

        <div className="text-sm text-muted-foreground text-center">
          <p>For best results:</p>
          <ul className="list-disc list-inside">
            <li>Ensure good, consistent lighting on your face</li>
            <li>Try to remain still during measurement</li>
            <li>Position your face clearly in the frame</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
