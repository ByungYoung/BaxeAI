import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createToken } from "@/lib/auth";
import { withIsolatedPrisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { email, password, name, company } = await request.json();

    // 필수 필드 검사
    if (!email) {
      return NextResponse.json(
        { error: "이메일을 입력해주세요." },
        { status: 400 }
      );
    }

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "올바른 이메일 형식이 아닙니다." },
        { status: 400 }
      );
    }

    // withIsolatedPrisma 함수로 데이터베이스 작업 래핑
    return await withIsolatedPrisma(async (db) => {
      // 이미 가입된 이메일인지 확인
      const existingUser = await db.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "이미 가입된 이메일입니다." },
          { status: 400 }
        );
      }

      // 비밀번호 암호화 (비밀번호가 제공된 경우에만)
      let hashedPassword = null;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      // 사용자 생성
      const user = await db.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || email.split("@")[0],
          company: company || "",
          isAdmin: false,
        },
      });

      // JWT 토큰 생성
      const token = createToken(user.id);

      // 사용자 정보 반환 (비밀번호 제외)
      const { password: _, ...userWithoutPassword } = user;

      const response = NextResponse.json(userWithoutPassword);
      response.headers.set(
        "Set-Cookie",
        `auth-token=${token}; Path=/; HttpOnly; Max-Age=${
          60 * 60 * 24 * 7
        }; SameSite=Lax${
          process.env.NODE_ENV === "production" ? "; Secure" : ""
        }`
      );
      return response;
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "회원가입 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
