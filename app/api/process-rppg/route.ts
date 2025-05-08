import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Edge API 구성 - 서버리스 함수의 타임아웃을 늘리기 위한 설정
export const runtime = "nodejs";
export const maxDuration = 60; // 최대 실행 시간 (초)

// This is a server-side route handler that will process the frames using pyVHR
export async function POST(request: Request) {
  try {
    const { frames } = await request.json();

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return NextResponse.json(
        { error: "Invalid or missing frames data" },
        { status: 400 }
      );
    }

    console.log(`Received ${frames.length} frames for processing`);

    // Create a temporary directory to store frames
    const sessionId = uuidv4();
    // Vercel 환경에서는 /tmp 디렉토리를 사용
    const tempDir =
      process.env.VERCEL === "1"
        ? path.join("/tmp", sessionId)
        : path.join(process.cwd(), "tmp", sessionId);

    try {
      await fs.mkdir(tempDir, { recursive: true });

      // Save frames as images
      for (let i = 0; i < frames.length; i++) {
        const base64Data = frames[i].replace(/^data:image\/jpeg;base64,/, "");
        const filePath = path.join(
          tempDir,
          `frame_${i.toString().padStart(5, "0")}.jpg`
        );
        await fs.writeFile(filePath, base64Data, "base64");
      }

      // 항상 실제 pyVHR 처리 시도
      const result = await runPyVHR(tempDir);

      // Clean up temporary files
      await fs.rm(tempDir, { recursive: true, force: true }).catch((err) => {
        console.warn("Failed to clean up temp directory:", err);
      });

      return NextResponse.json(result);
    } catch (error) {
      console.error("Error processing frames:", error);

      // Clean up on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("Error cleaning up temp files:", cleanupError);
      }

      // 에러 발생 시에도 시뮬레이션 결과 제공
      console.log("Error occurred, returning simulated result");
      return NextResponse.json(createSimulatedResult(`처리 오류: ${error}`));
    }
  } catch (error) {
    console.error("Error in process-rppg API route:", error);

    // 모든 예외 상황에서 시뮬레이션된 결과 반환
    return NextResponse.json(createSimulatedResult(`API 오류: ${error}`));
  }
}

/**
 * Runs the pyVHR processing on the saved frames
 */
async function runPyVHR(
  framesDir: string
): Promise<{ heartRate: number; confidence: number; hrv?: any }> {
  // Vercel 환경 감지 로직 변경 - 실행 시도
  if (process.env.VERCEL === "1") {
    console.log("runPyVHR: Vercel 환경에서 Python 스크립트 실행 시도");
    // Vercel 환경에서는 /tmp 디렉토리의 python3을 시도
    const pythonPaths = [
      "/var/task/python/bin/python3",   // Vercel의 Python 런타임 경로 (lambda layers)
      "/var/lang/bin/python3",          // AWS Lambda Python 3
      "/opt/python/bin/python3",        // 다른 가능한 경로
      "/tmp/python/bin/python3",        // 사용자 정의 설치 경로
      "python3",                        // 환경 변수 PATH에 있는 python3
      "python"                          // 환경 변수 PATH에 있는 python
    ];
    
    return new Promise((resolve, reject) => {
      // Path to Python script that uses pyVHR
      const pythonScript = path.join(process.cwd(), "scripts", "process_rppg.py");

      // 15초 타임아웃 설정 (Vercel에서는 조금 더 길게)
      const timeout = setTimeout(() => {
        console.error("Python 스크립트 실행 시간 초과 (Vercel)");
        resolve(createSimulatedResult("스크립트 실행 시간 초과 (Vercel)"));
      }, 15000);

      // 스크립트 존재 여부 먼저 확인
      fs.access(pythonScript)
        .then(() => {
          // 먼저 Vercel 환경에서 Python 실행 가능한지 로그 출력
          console.log(`Python 스크립트 경로: ${pythonScript}`);
          console.log(`프레임 디렉토리 경로: ${framesDir}`);
          
          // Vercel 환경에 맞춘 Python 경로 시도
          findWorkingPython(
            pythonPaths,
            0,
            pythonScript,
            framesDir,
            (result) => {
              clearTimeout(timeout);
              resolve(result);
            },
            (error) => {
              clearTimeout(timeout);
              console.error("Vercel에서 Python 처리 실패, 시뮬레이션 결과 사용:", error.message);
              resolve(createSimulatedResult(error.message));
            }
          );
        })
        .catch((err) => {
          clearTimeout(timeout);
          console.error(
            `Python script not found at ${pythonScript}. Error: ${err.message}`
          );
          resolve(createSimulatedResult(`스크립트를 찾을 수 없음: ${err.message}`));
        });
    });
  }
  
  // 로컬 환경 처리 (기존 코드 유지)
  return new Promise((resolve, reject) => {
    // Path to Python script that uses pyVHR
    const pythonScript = path.join(process.cwd(), "scripts", "process_rppg.py");

    // 10초 타임아웃 설정
    const timeout = setTimeout(() => {
      console.error("Python 스크립트 실행 시간 초과");
      resolve(createSimulatedResult("스크립트 실행 시간 초과"));
    }, 10000);

    // 스크립트 존재 여부 먼저 확인
    fs.access(pythonScript)
      .then(() => {
        // Path to Python executable options - try multiple paths for Vercel compatibility
        const pythonPaths = [
          path.join(process.cwd(), "venv", "bin", "python3"), // Local venv python3 (Mac/Linux)
          path.join(process.cwd(), "venv", "bin", "python"),  // Local venv python (Mac/Linux)
          path.join(process.cwd(), "venv", "Scripts", "python.exe"), // Local venv (Windows)
          "/usr/local/bin/python3", // Homebrew Python3 (Mac)
          "/usr/bin/python3", // Standard Python3 path
          "python3", // System Python3
          "/usr/bin/python", // Standard Linux path
          "python", // System Python
          "/var/lang/bin/python", // AWS Lambda Python
        ];

        // 첫 번째 실행 가능한 Python을 찾아서 사용
        findWorkingPython(
          pythonPaths,
          0,
          pythonScript,
          framesDir,
          (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          (error) => {
            clearTimeout(timeout);
            console.error("Python 처리 실패, 시뮬레이션 결과 사용:", error.message);
            resolve(createSimulatedResult(error.message));
          }
        );
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.error(
          `Python script not found at ${pythonScript}. Error: ${err.message}`
        );
        resolve(createSimulatedResult(`스크립트를 찾을 수 없음: ${err.message}`));
      });
  });
}

/**
 * 시뮬레이션된 결과를 생성합니다.
 */
function createSimulatedResult(errorReason?: string): {
  heartRate: number;
  confidence: number;
  hrv?: any;
  simulatedData?: boolean;
  error?: string;
} {
  const randomHeartRate = Math.floor(65 + Math.random() * 20); // 65-85 BPM 범위
  const randomRMSSD = 20 + Math.random() * 40; // 20-60ms 범위
  const randomLF = 0.4 + Math.random() * 0.3; // 0.4-0.7 범위
  const randomHF = 0.3 + Math.random() * 0.3; // 0.3-0.6 범위
  const lfHfRatio = randomLF / randomHF;

  return {
    heartRate: randomHeartRate,
    confidence: 0.7 + Math.random() * 0.2, // 0.7-0.9 사이 신뢰도
    hrv: {
      lf: randomLF,
      hf: randomHF,
      lfHfRatio: parseFloat(lfHfRatio.toFixed(2)),
      sdnn: parseFloat((35.0 + Math.random() * 15).toFixed(2)),
      rmssd: parseFloat(randomRMSSD.toFixed(2)),
      pnn50: parseFloat((20.0 + Math.random() * 15).toFixed(2)),
      // 기존 형식도 유지
      timeMetrics: {
        sdnn: parseFloat((35.0 + Math.random() * 15).toFixed(2)),
        rmssd: parseFloat(randomRMSSD.toFixed(2)),
        pnn50: parseFloat((20.0 + Math.random() * 15).toFixed(2)),
      },
      frequencyMetrics: {
        lfPower: randomLF * 1000,
        hfPower: randomHF * 1000,
        lfHfRatio: parseFloat(lfHfRatio.toFixed(2)),
      },
    },
    simulatedData: true,
    error: errorReason,
  };
}

/**
 * Recursively try Python paths until a working one is found
 */
function findWorkingPython(
  pythonPaths: string[],
  index: number,
  scriptPath: string,
  framesDir: string,
  resolve: (value: any) => void,
  reject: (reason: Error) => void
) {
  if (index >= pythonPaths.length) {
    console.error("No working Python interpreter found");
    reject(new Error("No working Python interpreter found"));
    return;
  }

  const pythonPath = pythonPaths[index];

  try {
    // 파일 시스템에 Python이 있는지 먼저 확인한 다음 실행
    if (pythonPath.includes(process.cwd())) {
      fs.access(pythonPath)
        .then(() => {
          executePython(pythonPath, scriptPath, framesDir, resolve, reject);
        })
        .catch(() => {
          findWorkingPython(
            pythonPaths,
            index + 1,
            scriptPath,
            framesDir,
            resolve,
            reject
          );
        });
    } else {
      // 시스템 경로의 Python인 경우 바로 실행 시도
      const testProcess = spawn(pythonPath, ["--version"]);

      testProcess.on("error", (err) => {
        findWorkingPython(
          pythonPaths,
          index + 1,
          scriptPath,
          framesDir,
          resolve,
          reject
        );
      });

      testProcess.on("close", (code) => {
        if (code === 0) {
          executePython(pythonPath, scriptPath, framesDir, resolve, reject);
        } else {
          findWorkingPython(
            pythonPaths,
            index + 1,
            scriptPath,
            framesDir,
            resolve,
            reject
          );
        }
      });
    }
  } catch (error) {
    console.error(`Error checking Python at ${pythonPath}: ${error}`);
    findWorkingPython(
      pythonPaths,
      index + 1,
      scriptPath,
      framesDir,
      resolve,
      reject
    );
  }
}

/**
 * Execute the Python script with the specified Python interpreter
 */
function executePython(
  pythonCommand: string,
  scriptPath: string,
  framesDir: string,
  resolve: (value: {
    heartRate: number;
    confidence: number;
    hrv?: any;
  }) => void,
  reject: (reason: Error) => void
) {
  // Spawn Python process
  const pythonProcess = spawn(pythonCommand, [scriptPath, framesDir]);

  let resultData = "";
  let errorData = "";

  pythonProcess.stdout.on("data", (data) => {
    resultData += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    errorData += data.toString();
    console.error(`Python stderr: ${data.toString()}`);
  });

  pythonProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`Python process exited with code ${code}`);
      console.error(`Python stderr: ${errorData}`);
      reject(
        new Error(`Python process failed with code ${code}: ${errorData}`)
      );
      return;
    }

    try {
      const result = JSON.parse(resultData);
      resolve(result);
    } catch (error) {
      console.error(`Failed to parse Python output: ${resultData}`);
      reject(new Error(`Failed to parse Python output: ${resultData}`));
    }
  });
}
