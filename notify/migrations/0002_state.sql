-- 서버가 직접 볼 수 없는 상태(로그인이 필요한 화면)를 PC 점검 때 적어 두는 표.
-- 아침 요약이 "마지막으로 확인한 상태 + 확인 날짜" 로 보여 준다.
CREATE TABLE IF NOT EXISTS state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
