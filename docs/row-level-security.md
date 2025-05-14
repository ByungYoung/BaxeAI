# PostgreSQL Row Level Security (RLS) 설정

이 문서는 BaxeAI 애플리케이션의 데이터베이스에 Row Level Security를 설정하는 방법에 대해 설명합니다.

## 문제 상황

"RLS Disabled in Public" 오류가 다음 테이블에서 발생했습니다:

- `public.User`
- `public.MeasurementResult`

이 오류는 해당 테이블에 Row Level Security가 활성화되지 않았음을 의미합니다.

## 해결 방법

### 1. PostgreSQL에 RLS 설정 적용하기

다음 SQL 스크립트를 데이터베이스에서 실행합니다:

```bash
# PostgreSQL CLI 로그인 (Vercel Postgres 또는 로컬 데이터베이스)
psql $POSTGRES_PRISMA_URL

# 또는 로컬에서 실행 시
psql -U [username] -d [database_name]
```

접속 후 `scripts/enable_rls.sql` 파일의 내용을 실행하거나, 파일 자체를 직접 실행합니다:

```bash
# SQL 파일 직접 실행
psql $POSTGRES_PRISMA_URL -f scripts/enable_rls.sql
```

### 2. 애플리케이션 코드 업데이트

다음 파일들이 수정되었습니다:

1. `/lib/db/rls.ts` - RLS 관련 유틸리티 함수 추가
2. `/lib/db.ts` - withDb 함수에 RLS 지원 추가
3. `/app/api/measurements/route.ts` - API 라우트에 RLS 적용

## 작동 방식

1. 각 테이블에 Row Level Security를 활성화
2. 두 가지 정책 생성:
   - 관리자는 모든 행에 접근 가능
   - 일반 사용자는 자신의 데이터만 접근 가능
3. 세션 컨텍스트 관리를 위한 함수 추가
4. API 호출 시 사용자 권한에 따라 적절한 RLS 정책 적용

## 주의사항

- 기존 데이터베이스에 RLS를 설정하면 적절한 권한이 설정되지 않은 사용자는 데이터에 접근할 수 없게 됩니다.
- PostgreSQL 9.5 이상에서만 사용 가능합니다.
- 개발 환경과 프로덕션 환경 모두에서 스크립트를 실행해야 합니다.
