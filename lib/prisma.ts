// prisma.ts - Prisma 클라이언트 싱글톤 패턴 적용
import { createClient } from "@prisma/client";

// 전역 객체 타입 확장
declare global {
  var prisma: ReturnType<typeof createClient> | undefined;
}

// 글로벌 싱글톤 prisma 인스턴스 생성
const prisma = global.prisma || createClient();

// 개발 환경에서만 전역 변수에 할당 (핫 리로딩 방지)
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

// 두 가지 방식으로 내보내기 (기본 및 명명 내보내기)
export { prisma };
export default prisma;
