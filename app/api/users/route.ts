import { NextRequest, NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

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

    return await withDb(async (db) => {
      // 이미 존재하는 사용자인지 확인
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      // 이미 존재하면 기존 사용자 정보 반환
      if (existingUser) {
        return NextResponse.json(existingUser);
      }

      // 새 사용자 생성
      const userId = createId();
      const now = new Date();
      
      const [newUser] = await db
        .insert(users)
        .values({
          id: userId,
          email,
          name,
          company,
          isAdmin: false,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      return NextResponse.json(newUser, { status: 201 });
    });
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

    return await withDb(async (db) => {
      let query = db.select().from(users);
      
      // 이메일로 필터링
      if (email) {
        query = query.where(eq(users.email, email));
      }
      
      // 최신순으로 정렬
      query = query.orderBy(desc(users.createdAt));
      
      const usersList = await query;
      return NextResponse.json(usersList);
    });
  } catch (error) {
    console.error("사용자 조회 중 오류 발생:", error);
    return NextResponse.json(
      { error: "사용자 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
