/**
 * 데이터베이스 유틸리티
 *
 * 이 모듈은 drizzle-orm을 사용하여 데이터베이스 작업을 처리하는 도우미 함수를 제공합니다.
 */
import { db } from "./db/client";
import * as schema from "./db/schema";
import { withAdminAccess, withUserAccess } from "./db/rls";

export { db, schema };

/**
 * 격리된 데이터베이스 컨텍스트에서 작업을 실행
 * 이 함수는 여러 데이터베이스 작업을 안전하게 수행할 수 있도록 합니다.
 *
 * 기본적으로 관리자 권한으로 실행됩니다.
 */
export async function withDb<T>(
  fn: (dbInstance: typeof db) => Promise<T>,
  options?: { userId?: string; isAdmin?: boolean }
): Promise<T> {
  try {
    // 사용자 ID가 제공되고 관리자가 아닌 경우
    if (options?.userId && !options.isAdmin) {
      return await withUserAccess(options.userId, () => fn(db));
    }
    // 그 외의 경우(관리자 접근 또는 사용자 ID 없음)
    else {
      return await withAdminAccess(() => fn(db));
    }
  } catch (error) {
    throw error;
  }
}
