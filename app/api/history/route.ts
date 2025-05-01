import { NextRequest, NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { users, measurementResults } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

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

    return await withDb(async (db) => {
      // admin 계정의 id인지 확인
      const [adminUser] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, "admin@xitst.com"), eq(users.isAdmin, true)))
        .limit(1);
      
      // 기본 쿼리 구성
      const query = db
        .select({
          measurementResult: measurementResults,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            company: users.company,
            isAdmin: users.isAdmin,
          },
        })
        .from(measurementResults)
        .leftJoin(users, eq(measurementResults.userId, users.id))
        .orderBy(desc(measurementResults.timestamp));

      // 일반 사용자는 자신의 데이터만 볼 수 있음
      if (!adminUser || userId !== adminUser.id) {
        query.where(eq(measurementResults.userId, userId));
      }

      // 쿼리 실행
      const results = await query;

      // 응답 형식 변환
      const formattedResults = results.map(({ measurementResult, user }) => ({
        ...measurementResult,
        user,
      }));

      return NextResponse.json(formattedResults);
    });
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
