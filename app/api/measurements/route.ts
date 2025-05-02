import { NextRequest, NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { users, measurementResults } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// 새로운 측정 결과 저장
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      userEmail,
      userName,
      userCompany,
      heartRate,
      confidence,
      rmssd,
      sdnn,
      lf,
      hf,
      lfHfRatio,
      pnn50,
      mood, // 기분 상태 필드 추가
    } = body;

    // 필수 항목 확인
    if (heartRate === undefined || confidence === undefined) {
      return NextResponse.json(
        { error: "심박수, 신뢰도는 필수 항목입니다." },
        { status: 400 }
      );
    }

    // withDb를 사용하여 데이터베이스 작업 수행
    return await withDb(async (db) => {
      // 사용자 처리 로직
      let finalUserId = userId;
      let userInfo = null;

      // 이메일이 제공된 경우, 항상 이를 우선적으로 처리
      if (userEmail) {
        // 이메일로 사용자 찾기
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, userEmail))
          .limit(1);

        if (existingUser) {
          // 기존 사용자 ID 사용
          finalUserId = existingUser.id;
          userInfo = existingUser;

          // 선택적으로 사용자 정보 업데이트 (이름이나 회사 정보가 변경된 경우)
          if (
            (userName && userName !== existingUser.name) ||
            (userCompany && userCompany !== existingUser.company)
          ) {
            await db
              .update(users)
              .set({
                name: userName || existingUser.name,
                company: userCompany || existingUser.company,
              })
              .where(eq(users.id, existingUser.id));
          }
        } else {
          // 이메일이 있지만 사용자가 없으면 새 사용자 생성
          const tempPassword = Math.random().toString(36).slice(-8); // 임시 비밀번호
          const newUserId = createId();

          const [newUser] = await db
            .insert(users)
            .values({
              id: newUserId,
              email: userEmail,
              name: userName || userEmail.split("@")[0],
              company: userCompany || "미지정",
              password: tempPassword, // 임시 비밀번호 설정
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          finalUserId = newUser.id;
          userInfo = newUser;
        }
      }
      // userId만 있고 이메일이 없는 경우 (비정상적인 경우지만 처리)
      else if (finalUserId) {
        // userId로 사용자 정보 확인
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, finalUserId))
          .limit(1);

        if (!user) {
          // userId가 유효하지 않으면 익명으로 처리
          finalUserId = null;
        } else {
          userInfo = user;
        }
      }

      // 사용자 ID가 없는 경우 익명으로 저장
      if (!finalUserId) {
        // 익명 사용자 ID로 저장 (익명 사용자 생성 또는 기존 익명 사용자 사용)
        const anonymousEmail = "anonymous@user.com";
        let [anonymousUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, anonymousEmail))
          .limit(1);

        if (!anonymousUser) {
          const anonymousUserId = createId();
          [anonymousUser] = await db
            .insert(users)
            .values({
              id: anonymousUserId,
              email: anonymousEmail,
              name: "익명 사용자",
              company: "미지정",
              password: "anonymous", // 임시 비밀번호
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
        }

        finalUserId = anonymousUser.id;
        userInfo = anonymousUser;
      }

      // 측정 결과 저장
      const resultId = createId();
      const [newResult] = await db
        .insert(measurementResults)
        .values({
          id: resultId,
          userId: finalUserId,
          email: userEmail || (userInfo?.email ?? "unknown@email.com"), // null 체크 추가
          heartRate,
          confidence,
          rmssd: rmssd || null,
          sdnn: sdnn || null,
          lf: lf || null,
          hf: hf || null,
          lfHfRatio: lfHfRatio || null,
          pnn50: pnn50 || null,
          mood: mood || null, // 기분 상태 저장
          timestamp: new Date(),
          createdAt: new Date(),
        })
        .returning();

      // 응답에 사용자 정보를 명시적으로 포함
      return NextResponse.json(
        {
          ...newResult,
          user: {
            id: userInfo?.id,
            email: userInfo?.email,
            name: userInfo?.name,
            company: userInfo?.company,
          },
          userEmail: userInfo?.email,
          userName: userInfo?.name,
          userCompany: userInfo?.company,
        },
        { status: 201 }
      );
    });
  } catch (error) {
    console.error("측정 결과 저장 중 오류 발생:", error);
    return NextResponse.json(
      { error: "측정 결과 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 측정 결과 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const isAdmin = searchParams.get("isAdmin") === "true";
    const email = searchParams.get("email");

    return await withDb(async (db) => {
      // 관리자 체크 - 이메일로 관리자인지 확인
      let isAdminUser = isAdmin;
      if (email) {
        const [userInfo] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (userInfo?.isAdmin) {
          isAdminUser = true;
        }
      }

      // 조건 설정
      const conditions = [];

      // 사용자 ID 필터 적용 (관리자가 아닌 경우에만)
      if (userId && !isAdminUser) {
        conditions.push(eq(measurementResults.userId, userId));
      }

      // 특정 사용자만 보기 (관리자가 특정 사용자의 데이터만 보고 싶을 때)
      if (userId && isAdminUser) {
        // 관리자이면서 userId가 있으면 해당 사용자의 데이터만 필터링
        conditions.push(eq(measurementResults.userId, userId));
      }

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

      // 쿼리 실행 (where 조건 적용)
      const results =
        conditions.length > 0
          ? await query.where(and(...conditions))
          : await query;

      // 응답 형식 변환
      const formattedResults = results.map(({ measurementResult, user }) => ({
        ...measurementResult,
        user,
      }));

      return NextResponse.json(formattedResults);
    });
  } catch (error) {
    console.error("측정 결과 조회 중 오류 발생:", error);
    return NextResponse.json(
      { error: "측정 결과 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
