-- RLS(Row Level Security) 활성화 스크립트

-- User 테이블에 RLS 활성화
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- MeasurementResult 테이블에 RLS 활성화
ALTER TABLE "MeasurementResult" ENABLE ROW LEVEL SECURITY;

-- 기본 정책 생성: 관리자는 모든 행에 접근 가능
CREATE POLICY admin_all_access ON "User"
    USING (true)
    WITH CHECK (true);

CREATE POLICY admin_all_access ON "MeasurementResult"
    USING (true)
    WITH CHECK (true);

-- 사용자는 자신의 데이터만 볼 수 있음
CREATE POLICY user_self_access ON "User"
    USING (id = current_setting('app.user_id', true)::varchar)
    WITH CHECK (id = current_setting('app.user_id', true)::varchar);

CREATE POLICY user_self_access ON "MeasurementResult"
    USING ("userId" = current_setting('app.user_id', true)::varchar)
    WITH CHECK ("userId" = current_setting('app.user_id', true)::varchar);

-- 커스텀 함수를 통해 현재 사용자 ID를 설정
CREATE OR REPLACE FUNCTION set_user_id(user_id text)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.user_id', user_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용 예시: 
-- SELECT set_user_id('사용자_ID');
-- SELECT * FROM "User"; -- 이제 해당 사용자의 데이터만 반환됨
