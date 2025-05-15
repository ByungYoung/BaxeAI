/**
 * 데이터베이스 유틸리티
 *
 * 이 모듈은 drizzle-orm을 사용하여 데이터베이스 작업을 처리하는 도우미 함수를 제공합니다.
 */
import { db } from './db/client';
import * as schema from './db/schema';
import { withAdminAccess, withUserAccess } from './db/rls';
import { measurementResults } from './db/schema';
import { createId } from '@paralleldrive/cuid2';

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

/**
 * 측정 결과를 저장
 * measurementResults 테이블에 데이터를 삽입합니다.
 */
export async function saveMeasurement({
  userId,
  heartRate,
  confidence,
  createdAt,
  email,
}: {
  userId: string;
  heartRate: number;
  confidence: number;
  createdAt?: Date;
  email?: string;
}) {
  const result = await db
    .insert(measurementResults)
    .values({
      id: createId(),
      userId,
      heartRate,
      confidence,
      createdAt: createdAt ?? new Date(),
      email,
    })
    .returning();
  return result[0];
}
