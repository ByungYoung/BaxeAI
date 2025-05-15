import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // 명시적으로 쿠키를 무효화하는 응답 생성
    const response = NextResponse.json({
      success: true,
      message: '로그아웃 성공',
    });

    // 인증 토큰 쿠키 삭제 (만료 시간을 과거로 설정)
    response.headers.set(
      'Set-Cookie',
      `auth-token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${
        process.env.NODE_ENV === 'production' ? '; Secure' : ''
      }`
    );

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: '로그아웃 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
