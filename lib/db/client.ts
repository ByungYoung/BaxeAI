import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 환경 변수에서 데이터베이스 URL 가져오기
const connectionString = process.env.POSTGRES_PRISMA_URL;

// 연결 문자열이 없으면 오류 발생
if (!connectionString) {
  throw new Error(
    '데이터베이스 연결 URL이 제공되지 않았습니다. POSTGRES_PRISMA_URL 환경 변수를 설정해주세요.'
  );
}

// 개발 환경에서의 DB 연결 로깅
const logQuery = process.env.NODE_ENV === 'development';

// postgres 클라이언트 생성
const client = postgres(connectionString, {
  prepare: true,
  // 연결 제한 설정
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// drizzle ORM 인스턴스 생성
export const db = drizzle(client, { schema, logger: logQuery });

// 데이터베이스 상태 확인용 함수
export async function checkDbConnection() {
  try {
    // 간단한 쿼리로 연결 확인
    const result = await client`SELECT 1 as connected`;
    return result[0].connected === 1;
  } catch (error) {
    return false;
  }
}
