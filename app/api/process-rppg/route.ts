import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { processFrames, createSimulatedResult } from "@/lib/rpgg-processor";

// Edge API 구성 - 서버리스 함수의 타임아웃을 늘리기 위한 설정
export const runtime = "nodejs";
export const maxDuration = 60; // 최대 실행 시간 (초)

// This is a server-side route handler that will process the frames using rPPG
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

    // 개발 환경에서는 Python 스크립트 사용, 프로덕션(Vercel)에서는 JavaScript 구현 사용
    let result;
    if (process.env.VERCEL === "1") {
      // Vercel 환경에서는 JavaScript 구현 사용
      console.log("Vercel 환경에서 JavaScript rPPG 처리 사용");
      result = await processFrames(frames);
    } else {
      try {
        // 개발 환경에서는 Python 스크립트 시도 후 실패 시 JavaScript로 폴백
        // 임시 디렉토리 생성 및 파일 작업
        const sessionId = uuidv4();
        const tempDir = path.join(process.cwd(), "tmp", sessionId);

        await fs.mkdir(tempDir, { recursive: true });

        // 프레임을 이미지로 저장
        for (let i = 0; i < frames.length; i++) {
          const base64Data = frames[i].replace(/^data:image\/jpeg;base64,/, "");
          const filePath = path.join(
            tempDir,
            `frame_${i.toString().padStart(5, "0")}.jpg`
          );
          await fs.writeFile(filePath, base64Data, "base64");
        }

        // Python 스크립트로 처리 시도
        try {
          result = await runPyVHR(tempDir);
        } catch (pyError) {
          console.warn("Python 처리 실패, JavaScript 구현으로 폴백:", pyError);
          result = await processFrames(frames);
        }

        // 임시 파일 정리
        await fs.rm(tempDir, { recursive: true, force: true }).catch((err) => {
          console.warn("Failed to clean up temp directory:", err);
        });
      } catch (error) {
        console.error("Error processing frames:", error);
        // 오류 발생 시 JavaScript 구현으로 폴백
        result = await processFrames(frames);
      }
    }

    return NextResponse.json(result);
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
  // 로컬 환경 처리
  return new Promise((resolve, reject) => {
    // Path to Python script that uses pyVHR
    const pythonScript = path.join(process.cwd(), "scripts", "process_rppg.py");

    // 10초 타임아웃 설정
    const timeout = setTimeout(() => {
      console.error("Python 스크립트 실행 시간 초과");
      reject(new Error("스크립트 실행 시간 초과"));
    }, 15000); // 15초로 연장 (처리량이 많은 경우를 위해)

    // 스크립트 존재 여부 먼저 확인
    fs.access(pythonScript)
      .then(() => {
        // Path to Python executable options - try multiple paths for compatibility
        const pythonPaths = [
          path.join(process.cwd(), "venv", "bin", "python3"), // Local venv python3 (Mac/Linux)
          path.join(process.cwd(), "venv", "bin", "python"), // Local venv python (Mac/Linux)
          path.join(process.cwd(), "venv", "Scripts", "python.exe"), // Local venv (Windows)
          "/usr/local/bin/python3", // Homebrew Python3 (Mac)
          "/usr/bin/python3", // Standard Python3 path
          "python3", // System Python3
          "/usr/bin/python", // Standard Linux path
          "python", // System Python
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
            reject(error);
          }
        );
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(new Error(`스크립트를 찾을 수 없음: ${err.message}`));
      });
  });
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

      testProcess.on("error", () => {
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
