-- 로또 서비스 D1 초기 스키마
-- 적용: npx wrangler d1 migrations apply lotto-db --remote

-- 회차별 당첨번호 + 회차 기본 통계 (jeong760 + dhlottery selectPstLt645Info.do)
CREATE TABLE IF NOT EXISTS draws (
  drw_no       INTEGER PRIMARY KEY,       -- 회차 번호 (1~)
  drw_date     TEXT NOT NULL,             -- 추첨일 YYYY-MM-DD
  n1           INTEGER NOT NULL,          -- 당첨 6개 (오름차순)
  n2           INTEGER NOT NULL,
  n3           INTEGER NOT NULL,
  n4           INTEGER NOT NULL,
  n5           INTEGER NOT NULL,
  n6           INTEGER NOT NULL,
  bonus        INTEGER NOT NULL,          -- 보너스 번호
  total_sales  INTEGER,                   -- 회차 총 판매액
  first_amt    INTEGER,                   -- 1등 1인당 당첨금
  first_cnt    INTEGER,                   -- 1등 당첨자 수
  -- winning_stores 집계로 자동/수동/반자동 breakdown 계산 (별도 컬럼 미사용)
  updated_at   INTEGER NOT NULL           -- unix ms
);
CREATE INDEX IF NOT EXISTS idx_draws_date ON draws(drw_date);

-- 등수별 상세 (1~5등)
CREATE TABLE IF NOT EXISTS prizes (
  drw_no    INTEGER NOT NULL,
  rank      INTEGER NOT NULL,             -- 1~5
  winners   INTEGER NOT NULL,
  amount    INTEGER NOT NULL,             -- 1인당 상금
  PRIMARY KEY (drw_no, rank),
  FOREIGN KEY (drw_no) REFERENCES draws(drw_no)
);

-- 판매점 마스터 (dhlottery ltShpId를 그대로 PK로 사용)
CREATE TABLE IF NOT EXISTS stores (
  store_id      INTEGER PRIMARY KEY,      -- dhlottery ltShpId
  name          TEXT NOT NULL,
  addr          TEXT NOT NULL,            -- shpAddr (도로명주소)
  sido          TEXT,                     -- 시/도 (파싱, 예: 서울)
  sigungu       TEXT,                     -- 시/군/구 (예: 중랑구)
  eupmyeondong  TEXT,                     -- 읍/면/동 (도로명이라 대개 NULL, v2에서 확장)
  lat           REAL,                     -- 위도 (dhlottery shpLat)
  lng           REAL,                     -- 경도 (dhlottery shpLot)
  first_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stores_region ON stores(sido, sigungu);

-- 회차별 1·2등 배출점 (selectLtWnShp.do)
CREATE TABLE IF NOT EXISTS winning_stores (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  drw_no   INTEGER NOT NULL,
  rank     INTEGER NOT NULL,              -- 1 or 2
  store_id INTEGER NOT NULL,               -- FK stores.store_id (= ltShpId)
  method   TEXT,                           -- 'auto' | 'manual' | 'semi' | NULL
  FOREIGN KEY (drw_no) REFERENCES draws(drw_no),
  FOREIGN KEY (store_id) REFERENCES stores(store_id)
);
CREATE INDEX IF NOT EXISTS idx_ws_drw ON winning_stores(drw_no);
CREATE INDEX IF NOT EXISTS idx_ws_store ON winning_stores(store_id);
CREATE INDEX IF NOT EXISTS idx_ws_drw_rank ON winning_stores(drw_no, rank);

-- 익명 시뮬레이션 이벤트 (메타 통계)
CREATE TABLE IF NOT EXISTS simulations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id            TEXT NOT NULL,
  drw_no                INTEGER NOT NULL,
  total_tickets         INTEGER NOT NULL,
  best_rank             INTEGER,           -- 1~5 or NULL(꽝)
  best_rank_index       INTEGER,
  matched_first_hundred INTEGER NOT NULL,  -- 0 or 1
  created_at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_drw ON simulations(drw_no);
CREATE INDEX IF NOT EXISTS idx_sim_created ON simulations(created_at);

-- 크롤러 실행 로그 (관측용)
CREATE TABLE IF NOT EXISTS crawl_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at      INTEGER NOT NULL,
  kind        TEXT NOT NULL,               -- 'weekly' | 'backfill'
  drw_from    INTEGER,
  drw_to      INTEGER,
  ok          INTEGER NOT NULL,            -- 0 or 1
  message     TEXT
);
