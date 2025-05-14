import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { existsSync, writeFileSync, mkdirSync } from "fs";

// 이 엔드포인트는 프론트엔드에서 받은 요청을
// Vercel Python 함수로 포워딩하는 예시입니다
export async function POST(req: NextRequest) {
  try {
    // 요청 데이터 파싱
    const data = await req.json();

    // 필수 데이터 확인
    if (!data.frames || !Array.isArray(data.frames)) {
      return NextResponse.json(
        { error: "프레임 데이터가 제공되지 않았습니다." },
        { status: 400 }
      );
    }

    // Vercel Python 함수 호출
    const apiUrl = process.env.VERCEL
      ? `/api/python/heartrate` // 배포 환경
      : `${req.nextUrl.origin}/api/python/heartrate`; // 로컬 개발 환경

    console.log(`Python API 호출: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Python API 요청 실패: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("rPPG 처리 중 오류:", error);

    // 오류 발생 시 대체 응답
    return NextResponse.json(
      {
        error: `처리 중 오류가 발생했습니다: ${error.message}`,
        heartRate: 0,
        confidence: 0,
        processed: false,
      },
      { status: 500 }
    );
  }
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
