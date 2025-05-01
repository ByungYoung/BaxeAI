import { NextRequest, NextResponse } from "next/server";
import { withIsolatedPrisma } from "@/lib/prisma";

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

    // withIsolatedPrisma를 사용하여 데이터베이스 작업 수행
    return await withIsolatedPrisma(async (db) => {
      // 사용자 처리 로직
      let finalUserId = userId;
      let userInfo = null;

      // 이메일이 제공된 경우, 항상 이를 우선적으로 처리
      if (userEmail) {
        // 이메일로 사용자 찾기
        const existingUser = await db.user.findUnique({
          where: { email: userEmail },
        });

        if (existingUser) {
          // 기존 사용자 ID 사용
          finalUserId = existingUser.id;
          userInfo = existingUser;

          // 선택적으로 사용자 정보 업데이트 (이름이나 회사 정보가 변경된 경우)
          if (
            (userName && userName !== existingUser.name) ||
            (userCompany && userCompany !== existingUser.company)
          ) {
            await db.user.update({
              where: { id: existingUser.id },
              data: {
                name: userName || existingUser.name,
                company: userCompany || existingUser.company,
              },
            });
          }
        } else {
          // 이메일이 있지만 사용자가 없으면 새 사용자 생성
          const tempPassword = Math.random().toString(36).slice(-8); // 임시 비밀번호
          const newUser = await db.user.create({
            data: {
              email: userEmail,
              name: userName || userEmail.split("@")[0],
              company: userCompany || "미지정",
              password: tempPassword, // 임시 비밀번호 설정
            },
          });
          finalUserId = newUser.id;
          userInfo = newUser;
          console.log(`새 사용자 생성: ${userEmail}`);
        }
      }
      // userId만 있고 이메일이 없는 경우 (비정상적인 경우지만 처리)
      else if (finalUserId) {
        // userId로 사용자 정보 확인
        const user = await db.user.findUnique({
          where: { id: finalUserId },
        });

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
        let anonymousUser = await db.user.findUnique({
          where: { email: anonymousEmail },
        });

        if (!anonymousUser) {
          anonymousUser = await db.user.create({
            data: {
              email: anonymousEmail,
              name: "익명 사용자",
              company: "미지정",
              password: "anonymous", // 임시 비밀번호
            },
          });
        }

        finalUserId = anonymousUser.id;
        userInfo = anonymousUser;
      }

      // 측정 결과 저장
      const newResult = await db.measurementResult.create({
        data: {
          userId: finalUserId,
          email: userEmail || userInfo.email, // userEmail 값을 우선적으로 사용
          heartRate,
          confidence,
          rmssd: rmssd || null,
          sdnn: sdnn || null,
          lf: lf || null,
          hf: hf || null,
          lfHfRatio: lfHfRatio || null,
          pnn50: pnn50 || null,
          mood: mood || null, // 기분 상태 저장
        },
        include: {
          user: true,
        },
      });

      // 응답에 사용자 정보를 명시적으로 포함
      return NextResponse.json(
        {
          ...newResult,
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

    return await withIsolatedPrisma(async (db) => {
      let whereClause = {};
      if (userId && !isAdmin) {
        // 일반 사용자는 자신의 데이터만 볼 수 있음
        whereClause = { userId };
      }

      const results = await db.measurementResult.findMany({
        where: whereClause,
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
        orderBy: {
          timestamp: "desc",
        },
      });

      return NextResponse.json(results);
    });
  } catch (error) {
    console.error("측정 결과 조회 중 오류 발생:", error);
    return NextResponse.json(
      { error: "측정 결과 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
