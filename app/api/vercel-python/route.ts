import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { db } from "@/lib/db";
import { measurementResults } from "@/lib/db/schema";
import { createId } from "@paralleldrive/cuid2";

export async function POST(req: NextRequest) {
  const body = await req.text();
  let parsedInput: any = {};
  try {
    parsedInput = JSON.parse(body);
  } catch (e) {
    return NextResponse.json(
      { error: "입력 데이터가 올바른 JSON이 아닙니다." },
      { status: 400 }
    );
  }

  return new Promise((resolve) => {
    const py = spawn("python3", ["api/python/heartrate.py"], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let data = "";
    let error = "";

    py.stdout.on("data", (chunk) => {
      data += chunk.toString();
    });
    py.stderr.on("data", (chunk) => {
      error += chunk.toString();
    });

    py.on("close", async (code) => {
      if (code === 0) {
        let result: any = {};
        try {
          result = JSON.parse(data);
        } catch (e) {
          resolve(
            new NextResponse(
              JSON.stringify({ error: "Python 결과 파싱 오류", raw: data }),
              { status: 500 }
            )
          );
          return;
        }
        // drizzle-orm으로 DB 저장
        try {
          const dbResult = await db
            .insert(measurementResults)
            .values({
              id: createId(),
              userId: parsedInput.userId ?? null,
              heartRate: result.heartRate ?? 0,
              confidence: result.confidence ?? 0,
              createdAt: new Date(),
              email: parsedInput.email ?? null,
            })
            .returning();
          resolve(
            new NextResponse(JSON.stringify({ ...result, db: dbResult?.[0] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        } catch (dbError: any) {
          resolve(
            new NextResponse(
              JSON.stringify({ ...result, dbError: dbError.message }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      } else {
        resolve(
          new NextResponse(JSON.stringify({ error, code }), { status: 500 })
        );
      }
    });

    py.stdin.write(body);
    py.stdin.end();
  });
}

// 서버 상태 확인용 GET 엔드포인트
export async function GET(req: NextRequest) {
  try {
    const apiUrl = process.env.VERCEL
      ? `/api/python/heartrate` // 배포 환경
      : `${req.nextUrl.origin}/api/python/heartrate`; // 로컬 개발 환경

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`상태 확인 실패: ${response.status}`);
    }

    const result = await response.json();

    return NextResponse.json({
      ...result,
      api_status: "connected",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        message: `Python 서버에 연결할 수 없습니다: ${error.message}`,
        api_status: "disconnected",
      },
      { status: 200 } // 프론트엔드에서 처리할 수 있도록 200 반환
    );
  }
}
