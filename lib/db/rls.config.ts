/**
 * Row Level Security 설정 파일
 * PostgreSQL RLS에 대한 Drizzle ORM 메타데이터를 정의합니다.
 */

// RLS 설정을 위한 타입 정의
export interface RLSPolicy {
  name: string;
  using?: string;
  check?: string;
}

export interface RLSConfig {
  enable: boolean;
  policies: RLSPolicy[];
}

// 메타데이터로 사용할 RLS 객체
export const rls = {
  // 사용자 테이블 RLS 설정
  User: {
    enable: true,
    policies: [
      {
        name: 'admin_all_access',
        using: 'true',
        check: 'true',
      },
      {
        name: 'user_self_access',
        using: "id = current_setting('app.user_id', true)::varchar",
        check: "id = current_setting('app.user_id', true)::varchar",
      },
    ],
  },

  // 측정 결과 테이블 RLS 설정
  MeasurementResult: {
    enable: true,
    policies: [
      {
        name: 'admin_all_access',
        using: 'true',
        check: 'true',
      },
      {
        name: 'user_self_access',
        using: '"userId" = current_setting(\'app.user_id\', true)::varchar',
        check: '"userId" = current_setting(\'app.user_id\', true)::varchar',
      },
    ],
  },
};
