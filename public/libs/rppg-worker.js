// rppg-worker.js - WebAssembly 기반 rPPG 프로세서를 위한 웹 워커

// OpenCV.js와 rPPG 프로세서 스크립트 가져오기
importScripts("/libs/opencv.js");
importScripts("/libs/rppg-processor.js");

// 프로세서 인스턴스
let processor = null;
let isInitialized = false;
let processingInterval = null;

// 메시지 핸들러
self.addEventListener("message", async (e) => {
  const { command, data } = e.data;

  switch (command) {
    case "init":
      try {
        // OpenCV가 로드될 때까지 대기
        await waitForOpenCV();

        // 프로세서 초기화
        processor = new RPPGProcessor();
        await processor.initialize();

        isInitialized = true;
        self.postMessage({ type: "initialized", success: true });
      } catch (error) {
        console.error("Worker initialization failed:", error);
        self.postMessage({
          type: "initialized",
          success: false,
          error: error.message,
        });
      }
      break;

    case "addFrame":
      if (!isInitialized) {
        self.postMessage({
          type: "error",
          message: "Processor not initialized",
        });
        return;
      }

      try {
        const { imageData, timestamp } = data;
        processor.addFrame(imageData, timestamp);
        self.postMessage({ type: "frameProcessed" });
      } catch (error) {
        console.error("Error processing frame:", error);
        self.postMessage({ type: "error", message: error.message });
      }
      break;

    case "startProcessing":
      if (!isInitialized) {
        self.postMessage({
          type: "error",
          message: "Processor not initialized",
        });
        return;
      }

      // 주기적으로 심박수 계산 및 결과 전송
      const intervalMs = data?.intervalMs || 1000;

      clearInterval(processingInterval);
      processingInterval = setInterval(() => {
        try {
          const result = processor.calculateHeartRate();
          self.postMessage({ type: "result", data: result });
        } catch (error) {
          console.error("Error calculating heart rate:", error);
          self.postMessage({
            type: "error",
            message: error.message,
          });
        }
      }, intervalMs);

      self.postMessage({ type: "processingStarted" });
      break;

    case "stopProcessing":
      clearInterval(processingInterval);
      processingInterval = null;
      self.postMessage({ type: "processingStopped" });
      break;

    case "reset":
      if (processor) {
        processor.reset();
      }
      clearInterval(processingInterval);
      processingInterval = null;
      self.postMessage({ type: "reset" });
      break;

    case "dispose":
      if (processor) {
        processor.dispose();
        processor = null;
        isInitialized = false;
      }
      clearInterval(processingInterval);
      processingInterval = null;
      self.postMessage({ type: "disposed" });
      break;

    default:
      self.postMessage({
        type: "error",
        message: `Unknown command: ${command}`,
      });
  }
});

// OpenCV가 로드될 때까지 기다리는 함수
function waitForOpenCV() {
  return new Promise((resolve, reject) => {
    // CV가 이미 로드된 경우
    if (typeof cv !== "undefined" && cv.getBuildInformation) {
      resolve();
      return;
    }

    // CV가 로드되는 것을 기다림
    const waitForCv = () => {
      if (typeof cv !== "undefined" && cv.getBuildInformation) {
        resolve();
      } else {
        setTimeout(waitForCv, 30);
      }
    };

    // 30초 타임아웃 설정
    const timeout = setTimeout(() => {
      reject(new Error("OpenCV.js loading timeout"));
    }, 30000);

    waitForCv();
  });
}
