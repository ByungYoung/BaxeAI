/**
 * Row Level Security (RLS) 관련 유틸리티 함수
 */
import { sql } from 'drizzle-orm';
import { db } from './client';

/**
 * 현재 세션의 사용자 ID를 설정하여 RLS 정책을 적용합니다.
 * @param userId 사용자 ID 문자열
 */
export async function setSessionUserId(userId: string | null) {
  if (userId) {
    await db.execute(sql`SELECT set_user_id(${userId})`);
  }
}

/**
 * 관리자 권한으로 데이터베이스 작업을 수행합니다.
 * 이 경우 RLS 제한이 우회됩니다 (관리자 정책에 의해).
 * @param callback 실행할 콜백 함수
 */
export async function withAdminAccess<T>(callback: () => Promise<T>): Promise<T> {
  try {
    // 관리자 권한 설정 (모든 데이터 접근)
    await db.execute(sql`SELECT set_user_id(null)`);
    return await callback();
  } finally {
    // 세션 종료 후 초기화
    await db.execute(sql`SELECT set_user_id(null)`);
  }
}

/**
 * 특정 사용자 ID로 데이터베이스 작업을 수행합니다.
 * RLS 정책에 따라 해당 사용자의 데이터만 접근 가능합니다.
 * @param userId 사용자 ID
 * @param callback 실행할 콜백 함수
 */
export async function withUserAccess<T>(userId: string, callback: () => Promise<T>): Promise<T> {
  try {
    await setSessionUserId(userId);
    return await callback();
  } finally {
    // 세션 종료 후 초기화
    await setSessionUserId(null);
  }
}
