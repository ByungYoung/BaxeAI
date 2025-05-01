// Prisma 클라이언트 - 서버리스 환경에 최적화
import { PrismaClient, Prisma } from "@prisma/client";

// 연결 설정을 위한 옵션
const prismaClientOptions: Prisma.PrismaClientOptions = {
  // 로그 설정
  log:
    process.env.NODE_ENV === "production"
      ? [{ level: "error", emit: "stdout" }]
      : [
          { level: "query", emit: "stdout" },
          { level: "error", emit: "stdout" },
          { level: "warn", emit: "stdout" },
        ],
  // 시간대 설정 - KST(한국 표준시)
  datasources: {
    db: {
      url: process.env.POSTGRES_PRISMA_URL,
    },
  },
};

// 글로벌 상태 유형 설정
declare global {
  var cachedPrisma: PrismaClient;
}

// 캐시된 클라이언트 인스턴스 사용
let prisma: PrismaClient;
if (process.env.NODE_ENV === "production") {
  // 프로덕션 환경 - 매 인스턴스마다 새로운 클라이언트 생성
  prisma = new PrismaClient(prismaClientOptions);
} else {
  // 개발 환경 - 한 번만 생성하고 재사용
  if (!global.cachedPrisma) {
    global.cachedPrisma = new PrismaClient(prismaClientOptions);
  }
  prisma = global.cachedPrisma;
}

export default prisma;

/**
 * 서버리스 환경에서 안전하게 Prisma를 사용하기 위한 유틸리티 함수
 * 각 요청마다 새로운 인스턴스를 생성하고 작업 완료 후 연결을 명시적으로 종료하여
 * "prepared statement already exists" 오류 방지
 */
export async function withIsolatedPrisma<T>(
  fn: (client: PrismaClient) => Promise<T>
): Promise<T> {
  // 항상 격리된 인스턴스 사용 (개발 및 프로덕션 모두)
  const isolatedClient = new PrismaClient(prismaClientOptions);
  try {
    return await fn(isolatedClient);
  } finally {
    // 작업 완료 후 항상 연결 종료하여 리소스 정리
    await isolatedClient.$disconnect();
  }
}
