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

    // Vercel 환경 감지
    const isVercel = process.env.VERCEL === "1";

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
      await fs.rm(tempDir, { recursive: true, force: true });

      return NextResponse.json(result);
    } catch (error) {
      console.error("Error processing frames:", error);

      // Clean up on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("Error cleaning up temp files:", cleanupError);
      }

      throw error;
    }
  } catch (error) {
    console.error("Error in process-rppg API route:", error);
    return NextResponse.json(
      { error: "Failed to process video frames" },
      { status: 500 }
    );
  }
}

/**
 * Runs the pyVHR processing on the saved frames
 */
async function runPyVHR(
  framesDir: string
): Promise<{ heartRate: number; confidence: number; hrv?: any }> {
  return new Promise((resolve, reject) => {
    // Path to Python script that uses pyVHR
    const pythonScript = path.join(process.cwd(), "scripts", "process_rppg.py");

    // 스크립트 존재 여부 먼저 확인
    fs.access(pythonScript)
      .then(() => {
        // Path to Python executable options - try multiple paths for Vercel compatibility
        const pythonPaths = [
          path.join(process.cwd(), "venv", "bin", "python"), // Local venv (Mac/Linux)
          path.join(process.cwd(), "venv", "Scripts", "python.exe"), // Local venv (Windows)
          "/var/lang/bin/python", // AWS Lambda Python
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
          resolve,
          reject
        );
      })
      .catch((err) => {
        console.error(
          `Python script not found at ${pythonScript}. Error: ${err.message}`
        );
        reject(new Error(`Python script not found at ${pythonScript}`));
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
