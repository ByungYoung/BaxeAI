import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import prisma from "./prisma";

// JWT_SECRET 환경 변수 체크
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn(
    "JWT_SECRET 환경 변수가 설정되지 않았습니다. 개발 모드에서 기본값을 사용합니다."
  );
}
const SECRET_KEY = JWT_SECRET || "secure-development-jwt-secret-key";

// 토큰 생성
export function createToken(userId: string): string {
  return jwt.sign({ userId }, SECRET_KEY, {
    expiresIn: "7d", // 7일 유효
  });
}

// 토큰 검증
export async function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { userId: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

// 현재 로그인한 사용자 가져오기
export async function getCurrentUser() {
  const cookiesStore = await cookies();
  const token = cookiesStore.get("auth-token")?.value;

  if (!token) {
    return null;
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user) {
    return null;
  }

  // 비밀번호를 제외한 사용자 정보 반환
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// 로그아웃
export async function logout() {
  const cookiesStore = await cookies();
  cookiesStore.delete("auth-token");
}

// 인증 미들웨어
export async function authMiddleware(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;

  if (!token) {
    return null;
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return null;
  }

  return decoded.userId;
}
