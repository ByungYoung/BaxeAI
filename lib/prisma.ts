// Prisma 클라이언트 - 서버리스 환경에 최적화
import { PrismaClient } from "@prisma/client";

// 서버리스 환경에 최적화된 Prisma 옵션
const prismaClientOptions = {
  // PostgreSQL의 prepared statement 문제 해결을 위한 설정
  datasources: {
    db: {
      url: process.env.POSTGRES_PRISMA_URL,
    },
  },
  // 필요한 로그만 표시
  log: ["error"],
};

// 각 요청마다 새로운 Prisma 인스턴스를 생성
export function createPrismaClient() {
  return new PrismaClient(prismaClientOptions);
}

// 요청별 Prisma 클라이언트 관리
let prisma: PrismaClient;

// 개발 환경에서는 전역 인스턴스를 재사용
if (process.env.NODE_ENV === "development") {
  // @ts-ignore
  if (!global.prisma) {
    // @ts-ignore
    global.prisma = new PrismaClient(prismaClientOptions);
  }
  // @ts-ignore
  prisma = global.prisma;
} else {
  // 프로덕션 환경에서는 매 요청마다 새 인스턴스 생성
  prisma = new PrismaClient(prismaClientOptions);
}

export default prisma;

/**
 * 요청별 격리된 Prisma 클라이언트를 사용하는 함수
 * 서버리스 환경에서 "prepared statement already exists" 오류 방지
 */
export async function withIsolatedPrisma<T>(
  fn: (client: PrismaClient) => Promise<T>
): Promise<T> {
  // 프로덕션 환경에서는 항상 새 인스턴스 생성
  if (process.env.NODE_ENV === "production") {
    const isolatedPrisma = createPrismaClient();

    try {
      return await fn(isolatedPrisma);
    } finally {
      // 작업 완료 후 연결 종료
      await isolatedPrisma.$disconnect();
    }
  }

  // 개발 환경에서는 공유 인스턴스 사용
  return fn(prisma);
}
