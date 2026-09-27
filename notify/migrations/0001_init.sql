-- Singleton row (id = 1) holds the current Kakao OAuth tokens.
-- Access token: 6h TTL (REST API). Refresh: 60d TTL, rotated when <30d left.
CREATE TABLE IF NOT EXISTS kakao_tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  access_expires_at INTEGER NOT NULL,
  refresh_token TEXT NOT NULL,
  refresh_expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Every send + refresh attempt for debugging. Purge old rows via cron if needed.
CREATE TABLE IF NOT EXISTS notify_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  channel TEXT NOT NULL,      -- 'kakao'
  event TEXT NOT NULL,        -- 'send' | 'refresh' | 'error'
  status INTEGER,             -- HTTP or Kakao result_code
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_notify_log_ts ON notify_log (ts DESC);
