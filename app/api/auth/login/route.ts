import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { createToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "이메일을 입력해주세요." },
        { status: 400 }
      );
    }

    // 사용자 찾기
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // 사용자가 존재하지 않으면 비회원 사용자 객체 반환
      return NextResponse.json({
        id: null,
        email: email,
        name: email.split("@")[0],
        company: "",
        isAdmin: false,
        isGuest: true, // 게스트 사용자 표시
      });
    }

    // 비밀번호가 제공된 경우에만 검증
    if (password && user.password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
          { status: 401 }
        );
      }
    }

    // JWT 토큰 생성 (사용자 ID가 있는 경우에만)
    const token = createToken(user.id);

    // 사용자 정보 반환 (비밀번호 제외)
    const { password: _, ...userWithoutPassword } = user;
    const response = NextResponse.json({
      ...userWithoutPassword,
      isGuest: false,
    });
    response.headers.set(
      "Set-Cookie",
      `auth-token=${token}; Path=/; HttpOnly; Max-Age=${
        60 * 60 * 24 * 7
      }; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
    );
    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "로그인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
