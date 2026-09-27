-- DART API 초기 스키마 (2026-09-26)
-- 5 테이블: corp_codes / filings / financials / distress_scores / risk_events + usage_log

-- ─────────────────────────────────────────────
-- 1) corp_codes: DART 법인 마스터 (약 10만 entity)
--    corpCode.xml 부트스트랩 스크립트가 채움. 상장·외감 포함.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS corp_codes (
  corp_code   TEXT PRIMARY KEY,    -- DART 8자리 고유코드
  corp_name   TEXT NOT NULL,       -- 한글 법인명
  corp_name_eng TEXT,              -- 영문명 (있으면)
  stock_code  TEXT,                -- 상장사만: 6자리 종목코드 (KOSPI/KOSDAQ/KONEX)
  modify_date TEXT,                -- YYYYMMDD, DART 원본 수정일
  market      TEXT,                -- KOSPI/KOSDAQ/KONEX/UNLISTED (파생)
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_corp_stock ON corp_codes(stock_code) WHERE stock_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_corp_name ON corp_codes(corp_name);
CREATE INDEX IF NOT EXISTS idx_corp_market ON corp_codes(market);

-- ─────────────────────────────────────────────
-- 2) filings: 공시 원본 메타 (list.json 결과 저장)
--    거버넌스 이벤트·감사의견 변경 등 위험 시그널의 소스.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS filings (
  rcept_no    TEXT PRIMARY KEY,    -- 14자리 접수번호
  corp_code   TEXT NOT NULL,
  corp_name   TEXT NOT NULL,
  report_nm   TEXT NOT NULL,       -- 공시 제목
  rcept_dt    TEXT NOT NULL,       -- YYYYMMDD
  flr_nm      TEXT,                -- 공시 제출인
  rm          TEXT,                -- 비고 (정정/첨부)
  fetched_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (corp_code) REFERENCES corp_codes(corp_code)
);
CREATE INDEX IF NOT EXISTS idx_filings_corp_dt ON filings(corp_code, rcept_dt DESC);
CREATE INDEX IF NOT EXISTS idx_filings_dt ON filings(rcept_dt DESC);

-- ─────────────────────────────────────────────
-- 3) financials: 정기보고서 재무 (연·분기 별)
--    fnlttSinglAcntAll (전체 재무제표) 또는 fnlttSinglAcnt (주요계정)
--    영어 라벨 매핑은 코드 상에서 처리 (스키마 무관).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financials (
  corp_code    TEXT NOT NULL,
  bsns_year    INTEGER NOT NULL,   -- 사업연도 (예: 2024)
  reprt_code   TEXT NOT NULL,      -- 11011=사업(연) 11012=반기 11013=1분기 11014=3분기
  fs_div       TEXT NOT NULL,      -- CFS(연결) / OFS(별도)
  sj_div       TEXT NOT NULL,      -- BS/IS/CIS/CF/SCE
  account_id   TEXT NOT NULL,      -- IFRS 계정 ID (예: ifrs-full_Revenue)
  account_nm   TEXT NOT NULL,      -- 한글 계정명
  thstrm_amount REAL,              -- 당기 금액 (원 단위)
  frmtrm_amount REAL,              -- 전기 금액
  bfefrmtrm_amount REAL,           -- 전전기 금액
  currency     TEXT DEFAULT 'KRW',
  fetched_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (corp_code, bsns_year, reprt_code, fs_div, sj_div, account_id),
  FOREIGN KEY (corp_code) REFERENCES corp_codes(corp_code)
);
CREATE INDEX IF NOT EXISTS idx_fin_corp_year ON financials(corp_code, bsns_year DESC);

-- ─────────────────────────────────────────────
-- 4) distress_scores: 사전계산된 부실 시그널
--    /distress/{crno} 엔드포인트가 여기서 O(1) lookup.
--    매일 cron이 최신 재무 반영해 재계산.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS distress_scores (
  corp_code    TEXT NOT NULL,
  bsns_year    INTEGER NOT NULL,
  reprt_code   TEXT NOT NULL,
  -- Altman Z (Emerging Market 판): 3.25 + 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4
  altman_z_em  REAL,
  altman_grade TEXT,               -- SAFE / GREY / DISTRESS
  -- Piotroski F-Score (0~9)
  piotroski_f  INTEGER,
  piotroski_grade TEXT,            -- STRONG (7~9) / MID (4~6) / WEAK (0~3)
  -- 최근 90일 위험 공시 이벤트 카운트
  risk_events_90d INTEGER DEFAULT 0,
  -- 종합 시그널 (0~100, 높을수록 위험)
  composite_risk REAL,
  composite_grade TEXT,            -- LOW / MEDIUM / HIGH / CRITICAL
  computed_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (corp_code, bsns_year, reprt_code),
  FOREIGN KEY (corp_code) REFERENCES corp_codes(corp_code)
);
CREATE INDEX IF NOT EXISTS idx_distress_risk ON distress_scores(composite_risk DESC);

-- ─────────────────────────────────────────────
-- 5) risk_events: 위험 공시 이벤트 (지분·감사·소송·담보 등)
--    filings에서 report_nm 패턴 매칭으로 추출.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_events (
  rcept_no     TEXT NOT NULL,
  corp_code    TEXT NOT NULL,
  event_type   TEXT NOT NULL,      -- AUDIT_OPINION / MAJOR_SHAREHOLDER / COLLATERAL / LAWSUIT / GOING_CONCERN / DELISTING_RISK
  event_dt     TEXT NOT NULL,      -- YYYYMMDD
  severity     INTEGER NOT NULL,   -- 1~5 (5 = 심각)
  detail       TEXT,               -- 원본 report_nm 스니펫
  detected_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (rcept_no, event_type),
  FOREIGN KEY (rcept_no) REFERENCES filings(rcept_no)
);
CREATE INDEX IF NOT EXISTS idx_risk_corp_dt ON risk_events(corp_code, event_dt DESC);
CREATE INDEX IF NOT EXISTS idx_risk_type ON risk_events(event_type, event_dt DESC);

-- ─────────────────────────────────────────────
-- 6) usage_log: 유료 티어 검증 + 남용 방지 + 매출 분석
--    Cloudflare Workers Analytics Engine 대체 (D1로 검색 가능하게).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL DEFAULT (unixepoch()),
  channel      TEXT,                -- rapidapi / apimarket / brand / direct
  api_key_hash TEXT,                -- SHA-256(key) → 개인정보 최소화
  endpoint     TEXT NOT NULL,       -- /distress/{crno}
  corp_code    TEXT,
  status       INTEGER NOT NULL,    -- HTTP status
  latency_ms   INTEGER,
  cache_hit    INTEGER DEFAULT 0    -- 0/1
);
CREATE INDEX IF NOT EXISTS idx_usage_ts ON usage_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_usage_key ON usage_log(api_key_hash, ts DESC);

-- ─────────────────────────────────────────────
-- 7) crawl_log: 배치 잡 실행 이력
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crawl_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL DEFAULT (unixepoch()),
  job          TEXT NOT NULL,       -- corp_codes / filings_daily / financials_backfill / distress_recompute
  status       TEXT NOT NULL,       -- OK / FAIL / PARTIAL
  rows_upserted INTEGER,
  error        TEXT,
  duration_ms  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_crawl_ts ON crawl_log(ts DESC);
