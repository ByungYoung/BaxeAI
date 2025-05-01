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

// 개발 환경에서는 핫 리로드 시 여러 인스턴스가 생성되는 것을 방지하기 위해
// 전역 객체 사용. 프로덕션에서는 일반적인 인스턴스 사용
if (process.env.NODE_ENV === "development") {
  if (!global.cachedPrisma) {
    global.cachedPrisma = new PrismaClient(prismaClientOptions);
  }
  prisma = global.cachedPrisma;
} else {
  prisma = new PrismaClient(prismaClientOptions);
}

export default prisma;

// 연결 풀 관리를 위한 변수
let connectionCount = 0;
const MAX_CONNECTIONS = 10;
const connectionQueue: Array<() => void> = [];

/**
 * 서버리스 환경에서 안전하게 Prisma를 사용하기 위한 유틸리티 함수
 * 각 요청마다 새로운 인스턴스를 생성하고 작업 완료 후 연결을 명시적으로 종료하여
 * "prepared statement already exists" 오류 방지
 */
export async function withIsolatedPrisma<T>(
  fn: (client: PrismaClient) => Promise<T>
): Promise<T> {
  // 연결 수 제한 관리
  if (connectionCount >= MAX_CONNECTIONS) {
    // 연결 수 제한에 도달하면 대기열에 추가
    await new Promise<void>((resolve) => {
      connectionQueue.push(resolve);
    });
  }

  connectionCount++;

  // 항상 격리된 인스턴스 사용
  const isolatedClient = new PrismaClient({
    ...prismaClientOptions,
    // 연결 문제 방지를 위한 추가 설정
    errorFormat: "minimal",
  });

  try {
    await isolatedClient.$connect(); // 명시적 연결
    return await fn(isolatedClient);
  } finally {
    try {
      await isolatedClient.$disconnect(); // 항상 연결 종료
    } catch (e) {
      console.error("Prisma 연결 종료 오류:", e);
    }

    connectionCount--;

    // 대기 중인 연결 처리
    if (connectionQueue.length > 0) {
      const next = connectionQueue.shift();
      if (next) next();
    }
  }
}
