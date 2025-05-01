// Prisma 클라이언트 - 서버리스 환경에 최적화
import { PrismaClient } from "@prisma/client";

/**
 * 싱글톤 패턴으로 PrismaClient 인스턴스 관리
 * 서버리스 환경에서 핫 리로드 시 여러 인스턴스 생성 방지
 */
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" 
      ? ["query", "error", "warn"] 
      : ["error"],
  });
};

// 글로벌 타입 선언
declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

// 전역 인스턴스 또는 새 인스턴스 사용
const prisma = global.prisma ?? prismaClientSingleton();

// 개발 환경에서만 글로벌 객체에 할당
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;

/**
 * 서버리스 환경에 최적화된 Prisma 클라이언트 사용 함수
 * 각 요청마다 독립된 쿼리 실행 컨텍스트 제공
 */
export async function withIsolatedPrisma<T>(
  fn: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  try {
    // 각 요청마다 새로운 트랜잭션 사용
    return await prisma.$transaction(async (tx) => {
      return fn(tx as unknown as PrismaClient);
    }, {
      maxWait: 5000, // 5초 최대 대기 시간
      timeout: 10000, // 10초 트랜잭션 타임아웃
    });
  } catch (error) {
    console.error("Prisma transaction error:", error);
    throw error;
  }
}
