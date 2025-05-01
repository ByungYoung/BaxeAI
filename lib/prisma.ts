// 서버리스 환경에 최적화된 Prisma 클라이언트 설정
import { PrismaClient } from "@prisma/client";

// 개발 환경에서 다중 인스턴스 생성 방지를 위한 전역 변수
const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

// 더 안정적인 연결 관리를 위한 Prisma 옵션 설정
const prismaClientOptions = {
  log: process.env.NODE_ENV === "development" 
    ? ["query", "error", "warn"] 
    : ["error"],
};

// 사용할 Prisma 클라이언트 인스턴스 결정
export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions);

// 개발 환경에서만 인스턴스를 전역적으로 저장
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// 기본 Prisma 클라이언트 익스포트
export default prisma;

/**
 * 서버리스 환경에서 안전한 Prisma 클라이언트 사용을 위한 유틸리티 함수
 * 각 요청마다 안전하게 쿼리를 처리하고 연결을 관리
 */
export async function withIsolatedPrisma<T>(
  fn: (client: PrismaClient) => Promise<T>
): Promise<T> {
  // 모든 환경에서 동일하게 처리
  try {
    // 주요 변경점: Prisma 클라이언트 인스턴스를 직접 전달하고 트랜잭션 사용 안함
    // 심플한 접근 방식이 서버리스 환경에서 더 안정적
    return await fn(prisma);
  } catch (error) {
    console.error("Prisma client error:", error);
    throw error;
  }
}
