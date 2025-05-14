# "RLS Disabled in Public" 문제 해결 가이드

## 문제 설명

PostgreSQL 데이터베이스의 공개 스키마(public)에서 `User` 및 `MeasurementResult` 테이블에 대해 "RLS Disabled in Public" 오류가 발생하였습니다. 이는 Row Level Security(RLS)가 활성화되지 않았기 때문입니다.

## 해결 방안

이 문제를 해결하기 위해 다음 단계를 따르세요:

### 1. 코드 변경사항 확인

프로젝트에 다음과 같은 코드 변경이 적용되었는지 확인합니다:

- `lib/db/rls.ts` - RLS 유틸리티 함수
- `lib/db/rls.config.ts` - RLS 메타데이터 설정
- `lib/db.ts` - withDb 함수 업데이트
- `app/api/measurements/route.ts` - API 엔드포인트 수정

### 2. 데이터베이스 마이그레이션 실행

Drizzle ORM을 사용하여 스키마를 먼저 마이그레이션합니다:

```bash
# Drizzle 마이그레이션 파일 생성
npx drizzle-kit generate

# 마이그레이션 적용 (지원되는 경우)
npx drizzle-kit push
```

### 3. RLS 설정 스크립트 실행

PostgreSQL에 접속하여 RLS 설정 스크립트를 실행합니다. 다음 방법 중 하나를 선택하세요:

#### Vercel Postgres 대시보드 사용 (권장)

1. [Vercel 대시보드](https://vercel.com)에 로그인
2. 프로젝트 > Storage > Postgres로 이동
3. "Query Editor" 탭 선택
4. `scripts/complete_rls_setup.sql` 파일의 내용을 복사하여 쿼리 에디터에 붙여넣기
5. 쿼리 실행

#### PostgreSQL 클라이언트 사용

PostgreSQL 클라이언트(`psql`)가 설치된 경우:

```bash
# 환경 변수에 저장된 연결 문자열 사용
psql $POSTGRES_PRISMA_URL -f scripts/complete_rls_setup.sql

# 또는 수동으로 접속
psql -h <호스트명> -U <사용자명> -d <데이터베이스명> -f scripts/complete_rls_setup.sql
```

#### 데이터베이스 관리 도구 사용

pgAdmin 또는 DBeaver와 같은 그래픽 도구를 사용하여 스크립트 실행:

1. 도구를 사용해 데이터베이스에 접속
2. `scripts/complete_rls.sql` 파일을 열거나 내용을 복사하여 쿼리 편집기에 붙여넣기
3. 쿼리 실행

### 4. 애플리케이션 재배포

변경사항을 적용한 후 애플리케이션을 재배포합니다:

```bash
# Vercel에 배포
vercel --prod
```

### 5. 작동 확인

애플리케이션에서 다음을 확인하세요:

1. 관리자 계정으로 로그인하여 모든 사용자의 측정 결과를 볼 수 있는지 확인
2. 일반 사용자 계정으로 로그인하여 자신의 측정 결과만 볼 수 있는지 확인

## 문제 해결

문제가 계속 발생하는 경우:

1. PostgreSQL 대화식 세션에서 RLS가 활성화되었는지 확인:

   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public'
   AND tablename IN ('User', 'MeasurementResult');
   ```

   결과에서 rowsecurity 열이 모두 't'(true)로 표시되어야 합니다.

2. 정책이 올바르게 생성되었는지 확인:

   ```sql
   SELECT tablename, policyname
   FROM pg_policies
   WHERE schemaname = 'public';
   ```

3. RLS 함수가 올바르게 작동하는지 테스트:
   ```sql
   SELECT set_user_id('test-id');
   SELECT current_setting('app.user_id', true);
   ```

## 자세한 내용

Row Level Security에 대한 자세한 내용은 [PostgreSQL 공식 문서](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)를 참조하세요.
