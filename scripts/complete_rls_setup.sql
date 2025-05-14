-- RLS 설정을 적용하기 위한 통합 스크립트

-- 1. RLS 활성화
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeasurementResult" ENABLE ROW LEVEL SECURITY;

-- 2. 기본 정책 생성: 관리자는 모든 행에 접근 가능
CREATE POLICY admin_all_access ON "User"
    USING (true)
    WITH CHECK (true);

CREATE POLICY admin_all_access ON "MeasurementResult"
    USING (true)
    WITH CHECK (true);

-- 3. 사용자는 자신의 데이터만 볼 수 있음
CREATE POLICY user_self_access ON "User"
    USING (id = current_setting('app.user_id', true)::varchar)
    WITH CHECK (id = current_setting('app.user_id', true)::varchar);

CREATE POLICY user_self_access ON "MeasurementResult"
    USING ("userId" = current_setting('app.user_id', true)::varchar)
    WITH CHECK ("userId" = current_setting('app.user_id', true)::varchar);

-- 4. 커스텀 함수를 통해 현재 사용자 ID를 설정
CREATE OR REPLACE FUNCTION set_user_id(user_id text)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.user_id', user_id, false);
END;
$$ LANGUAGE plpgsql;

-- 5. 함수 사용 테스트
SELECT set_user_id(NULL);
SELECT set_user_id('test-user');
SELECT current_setting('app.user_id', true);
SELECT set_user_id(NULL);
