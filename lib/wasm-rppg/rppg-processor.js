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

  // 환경 감지 (브라우저, 웹 워커, Node.js)
  const isBrowser =
    typeof window !== "undefined" && typeof document !== "undefined";
  const isWorker =
    typeof self !== "undefined" && typeof importScripts === "function";
  const isNode =
    typeof process !== "undefined" && process.versions && process.versions.node;

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
  } else if (isWorker) {
    // 웹 워커 환경
    try {
      importScripts("/libs/opencv.js");
      console.log("OpenCV.js loaded in web worker");
      setTimeout(callback, 100); // 약간의 지연을 두어 OpenCV.js가 완전히 로드되도록 함
    } catch (error) {
      console.error("Failed to load OpenCV.js in web worker:", error);
    }
  } else if (isNode) {
    // Node.js 환경
    try {
      // 전역 스코프에서 사용할 수 있도록 global에 할당
      global.cv = require("../../../public/libs/opencv.js");
      console.log("OpenCV.js loaded in Node.js");
      callback();
    } catch (error) {
      console.error("Failed to load OpenCV.js in Node.js:", error);
    }
  } else {
    console.error("Unknown environment, cannot load OpenCV.js");
  }
}

// 외부 파일 로드를 위한 유틸리티 클래스
class Utils {
  constructor(errorOutputId) {
    this.errorOutputId = errorOutputId;
  }

  createFileFromUrl(path, url, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";

    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = new Uint8Array(xhr.response);
        try {
          cv.FS_createDataFile("/", path, data, true, false, false);
          console.log(`Successfully loaded ${path}`);
          if (callback) callback();
        } catch (err) {
          console.error(`Error creating file ${path}: ${err}`);
          if (callback) callback(err);
        }
      } else {
        console.error(`Failed to load ${url} status: ${xhr.status}`);
        if (callback) callback(new Error(`Failed to load ${url}`));
      }
    };

    xhr.onerror = () => {
      console.error(`Network error when loading ${url}`);
      if (callback) callback(new Error(`Network error when loading ${url}`));
    };

    xhr.send();
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

          // 환경 감지
          const isBrowser =
            typeof window !== "undefined" && typeof document !== "undefined";
          const isWorker =
            typeof self !== "undefined" && typeof importScripts === "function";
          const isNode =
            typeof process !== "undefined" &&
            process.versions &&
            process.versions.node;

          if (isBrowser || isWorker) {
            // 브라우저/웹 워커 환경에서는 WASM 기반 haarcascade 파일을 로드
            const utils = new Utils("");
            utils.createFileFromUrl(
              "haarcascade_frontalface_default.xml",
              "/libs/haarcascade_frontalface_default.xml",
              (err) => {
                if (!err) {
                  try {
                    this.faceClassifier.load(
                      "haarcascade_frontalface_default.xml"
                    );
                    console.log("Face classifier loaded successfully");
                    this.isReady = true;
                    resolve();
                  } catch (loadErr) {
                    console.warn(
                      "Failed to load face classifier, continuing without face detection:",
                      loadErr
                    );
                    this.isReady = true;
                    resolve();
                  }
                } else {
                  // 파일 로드 실패 시 에도 계속 진행
                  console.warn(
                    "Failed to load haar cascade file, continuing without face detection"
                  );
                  this.isReady = true;
                  resolve();
                }
              }
            );
          } else if (isNode) {
            // Node.js 환경에서는 require를 사용하여 로드
            try {
              const fs = require("fs");
              const path = require("path");
              const haarPath = path.resolve(
                __dirname,
                "../../../public/libs/haarcascade_frontalface_default.xml"
              );

              if (fs.existsSync(haarPath)) {
                const data = fs.readFileSync(haarPath);
                const uint8Array = new Uint8Array(data);

                cv.FS_createDataFile(
                  "/",
                  "haarcascade_frontalface_default.xml",
                  uint8Array,
                  true,
                  false,
                  false
                );
                this.faceClassifier.load("haarcascade_frontalface_default.xml");
                this.isReady = true;
                resolve();
              } else {
                console.warn(`Haar cascade file not found at: ${haarPath}`);
                this.isReady = true;
                resolve();
              }
            } catch (err) {
              console.warn("Failed to load haar cascade in Node.js:", err);
              this.isReady = true;
              resolve();
            }
          } else {
            // 알 수 없는 환경에서도 계속 진행
            console.warn(
              "Unknown environment, continuing without face detection"
            );
            this.isReady = true;
            resolve();
          }
        } catch (error) {
          console.error("Failed to initialize RPPGProcessor:", error);
          reject(error);
        }
      });
    });
  }

  // ...existing code...
}

// 환경별 내보내기
if (typeof module !== "undefined" && module.exports) {
  // Node.js 환경
  module.exports = RPPGProcessor;
} else if (typeof window !== "undefined") {
  // 브라우저 환경
  window.RPPGProcessor = RPPGProcessor;
  window.Utils = Utils;
} else if (typeof self !== "undefined") {
  // 웹 워커 환경
  self.RPPGProcessor = RPPGProcessor;
  self.Utils = Utils;
}
