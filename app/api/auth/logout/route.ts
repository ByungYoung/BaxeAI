import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    // 인증 쿠키 삭제 (비동기적으로 처리)
    const cookieStore = await cookies();
    cookieStore.set("auth-token", "", {
      path: "/",
      httpOnly: true,
      maxAge: 0,
      sameSite: "lax",
    });

    const response = NextResponse.json({ success: true });
    response.headers.set(
      "Set-Cookie",
      "auth-token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax"
    );
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "로그아웃 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
