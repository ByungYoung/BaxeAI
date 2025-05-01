import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 새로운 사용자 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, company } = body;

    if (!email || !company) {
      return NextResponse.json(
        { error: "이메일과 소속은 필수 항목입니다." },
        { status: 400 }
      );
    }

    // 이미 존재하는 사용자인지 확인
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    // 이미 존재하면 기존 사용자 정보 반환
    if (existingUser) {
      return NextResponse.json(existingUser);
    }

    // 새 사용자 생성
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        company,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("사용자 생성 중 오류 발생:", error);
    return NextResponse.json(
      { error: "사용자 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 사용자 목록 조회 - 이메일로 필터링 기능 추가
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get("email");

    // 검색 조건
    let whereClause = {};
    if (email) {
      whereClause = { email };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("사용자 조회 중 오류 발생:", error);
    return NextResponse.json(
      { error: "사용자 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
