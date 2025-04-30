import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 측정 이력 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { error: "userId가 필요합니다." },
        { status: 400 }
      );
    }

    // admin 계정의 id라면 전체 이력 반환
    const adminUser = await prisma.findFirst({
      model: "User",
      where: { email: "admin@xitst.com", isAdmin: true },
    });
    if (adminUser && userId === adminUser.id) {
      // 전체 이력 반환
      const results = await prisma.findMany({
        model: "MeasurementResult",
        orderBy: { timestamp: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              company: true,
              isAdmin: true,
            },
          },
        },
      });
      return NextResponse.json(results);
    }

    // 일반 사용자는 자신의 데이터만 볼 수 있음
    const results = await prisma.findMany({
      model: "MeasurementResult",
      where: { userId },
      orderBy: { timestamp: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            isAdmin: true,
          },
        },
      },
    });
    return NextResponse.json(results);
  } catch (error) {
    console.error("측정 이력 조회 중 오류 발생:", error);
    return NextResponse.json(
      { error: "측정 이력 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST 등 다른 메서드는 허용하지 않음
export async function POST() {
  return NextResponse.json(
    { error: "허용되지 않은 요청입니다." },
    { status: 405 }
  );
}
