/**
 * 데이터베이스 유틸리티
 *
 * 이 모듈은 drizzle-orm을 사용하여 데이터베이스 작업을 처리하는 도우미 함수를 제공합니다.
 */
import { db } from "./db/client";
import * as schema from "./db/schema";

export { db, schema };

/**
 * 격리된 데이터베이스 컨텍스트에서 작업을 실행
 * 이 함수는 여러 데이터베이스 작업을 안전하게 수행할 수 있도록 합니다.
 */
export async function withDb<T>(
  fn: (dbInstance: typeof db) => Promise<T>
): Promise<T> {
  try {
    // db 인스턴스를 콜백 함수에 전달
    return await fn(db);
  } catch (error) {
    throw error;
  }
}
