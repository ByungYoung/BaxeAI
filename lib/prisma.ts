// Prisma 클라이언트 - 서버리스 환경에 최적화
import { PrismaClient } from "@prisma/client";

// 개발 환경에서는 글로벌 객체 사용, 프로덕션에서는 각 인스턴스 생성
// 이는 개발 시 핫 리로드로 인한 다중 인스턴스 생성 방지
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 클라이언트 옵션 설정
const prismaOptions = {
  log: process.env.NODE_ENV === "development"
    ? ["query", "error", "warn"]
    : ["error"],
  // 연결 시간 초과 및 재시도 구성 추가
  // 서버리스 환경에서의 안정성 향상
  __internal: {
    engine: {
      connectTimeout: 5000, // 연결 시간 초과 5초
    },
  },
};

// 싱글톤 패턴으로 Prisma 클라이언트 생성
const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaOptions);

// 개발 환경에서만 글로벌 캐시 사용
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

// 서버리스 환경에 최적화된 Prisma 사용 함수
// 이 함수는 개별 API 라우트에서 Prisma를 안전하게 사용할 수 있게 함
export async function withIsolatedPrisma<T>(
  fn: (client: PrismaClient) => Promise<T>
): Promise<T> {
  // 프로덕션 환경에서 각 요청마다 새로운 클라이언트 사용
  if (process.env.NODE_ENV === "production") {
    // 각 요청에 대한 독립 Prisma 인스턴스 생성
    const isolatedClient = new PrismaClient(prismaOptions);
    try {
      return await fn(isolatedClient);
    } finally {
      // 작업 완료 후 연결 즉시 정리
      await isolatedClient.$disconnect();
    }
  }
  
  // 개발 환경에서는 싱글톤 인스턴스 사용
  // 트랜잭션을 사용하여 각 요청을 격리
  try {
    return await prisma.$transaction(async (tx) => {
      return await fn(tx as unknown as PrismaClient);
    }, {
      maxWait: 3000,
      timeout: 8000,
    });
  } catch (error) {
    console.error("Prisma transaction error:", error);
    throw error;
  }
}
