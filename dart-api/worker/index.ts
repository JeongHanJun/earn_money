/**
 * DART API Worker — 4 endpoints + admin + cron.
 *
 * 판매 원칙: 원본 raw 재배포 X. 지표·이벤트·요약만 응답.
 * 5채널 (RapidAPI, api.market, dart.ryanpp.com, GitHub demo, LinkedIn outreach)
 * 모두 이 Worker를 호출. 채널별 api_key 프리픽스로 구분 (usage_log).
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { OpenDartClient, dartStatusLabel } from "./opendart";
import { toEnglish, detectRiskEvents } from "./mapping";

export interface Env {
  DART_DB: D1Database;
  DART_R2: R2Bucket;
  ASSETS: Fetcher;
  OPENDART_KEY: string;
  ADMIN_SECRET: string;
  DART_BASE_URL?: string;
  USER_AGENT?: string;
  // Optional — 있으면 daily-crawl 결과를 카카오톡으로 통지.
  NOTIFY_URL?: string;      // e.g. "https://notify.ryanpp.com/kakao"
  NOTIFY_TOKEN?: string;    // notify worker의 NOTIFY_SECRET 값
  // 마켓 게이트웨이만 데이터 엔드포인트 호출 허용 (wrangler secret put)
  RAPIDAPI_PROXY_SECRET: string;    // RapidAPI Studio → Gateway → X-RapidAPI-Proxy-Secret
  APIMARKET_GATEWAY_SECRET: string; // api.market API Source → Authentication (X-KRDART-Gateway-Key)
}

/**
 * notify.ryanpp.com 으로 카카오톡 알림 전송. fire-and-forget.
 * 실패해도 caller 로직을 방해하지 않는다.
 */
async function notifyKakao(env: Env, msg: { title: string; body: string; url?: string; button?: string }) {
  if (!env.NOTIFY_URL || !env.NOTIFY_TOKEN) return;
  try {
    await fetch(`${env.NOTIFY_URL}?token=${encodeURIComponent(env.NOTIFY_TOKEN)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
  } catch {
    // swallow — notify는 부수 채널이므로 원 로직에 영향 X
  }
}

type Bindings = { Bindings: Env };
const app = new Hono<Bindings>();

app.use("*", cors({ origin: "*", allowMethods: ["GET", "OPTIONS"] }));

// ─────────────────────────────────────────────────────
// Gateway 인증: 데이터 엔드포인트는 RapidAPI / api.market 프록시 경유만 허용.
// 랜딩 데모 카드 3개(/distress)만 예외로 공개.
// ─────────────────────────────────────────────────────
const DATA_PATH = /^\/(companies|financials|distress|screener|events)(\/|$)/;
const DEMO_DISTRESS = new Set(["00126380", "00164779", "00164742"]); // 삼성전자, LG전자, SK하이닉스

function safeEqual(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

app.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method === "OPTIONS" || !DATA_PATH.test(path)) return next();

  let channel: string;
  let user = "";
  if (safeEqual(c.req.header("X-RapidAPI-Proxy-Secret"), c.env.RAPIDAPI_PROXY_SECRET)) {
    channel = "rapidapi";
    user = c.req.header("X-RapidAPI-User") ?? "";
  } else if (safeEqual(c.req.header("X-KRDART-Gateway-Key"), c.env.APIMARKET_GATEWAY_SECRET)) {
    channel = "apimarket";
  } else if (path.startsWith("/distress/") && DEMO_DISTRESS.has(path.slice(10))) {
    channel = "brand";
  } else {
    return c.json({
      error: "Direct access is not supported. Subscribe via RapidAPI or api.market.",
      rapidapi: "https://rapidapi.com/krdartapi/api/krdart",
      apimarket: "https://api.market/store/krdart/krdart-financials",
    }, 401);
  }

  const t0 = Date.now();
  await next();
  const corp = path.match(/\/(\d{8})(\/|$)/)?.[1] ?? null;
  const endpoint = path.replace(/\/\d{8}(?=\/|$)/, "/{corp_code}");
  c.executionCtx.waitUntil((async () => {
    try {
      await c.env.DART_DB.prepare(
        `INSERT INTO usage_log (channel, api_key_hash, endpoint, corp_code, status, latency_ms) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(channel, user ? await sha256(user) : null, endpoint, corp, c.res.status, Date.now() - t0).run();
    } catch {
      // 로깅 실패는 응답에 영향 X
    }
  })());
});

// ─────────────────────────────────────────────────────
// Health & meta
// / 는 public/index.html 랜딩이 assets에서 서빙됨.
// JSON 메타 정보는 /api/info로 이동.
// ─────────────────────────────────────────────────────
app.get("/api/info", (c) => c.json({
  service: "dart-api",
  version: "0.1.0",
  landing: "https://dart.ryanpp.com/",
  openapi: "https://dart.ryanpp.com/openapi.yaml",
  endpoints: [
    "GET /health",
    "GET /stats",
    "GET /companies/:corp_code",
    "GET /companies/search?q=...",
    "GET /financials/:corp_code",
    "GET /distress/:corp_code",
    "GET /screener?altman_max=&piotroski_min=&grade=...",
    "GET /events/recent",
  ],
}));

app.get("/health", async (c) => {
  const r = await c.env.DART_DB.prepare("SELECT COUNT(*) as n FROM corp_codes").first<{ n: number }>();
  return c.json({ ok: true, corp_count: r?.n ?? 0, ts: Date.now() });
});

/**
 * /stats — 랜딩페이지 라이브 카운터용. Cache 60s.
 */
app.get("/stats", async (c) => {
  const cutoff90 = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10).replace(/-/g, "");
  const [corp, listed, filings, events90, distressAny, lastFiling, lastDistress] = await Promise.all([
    c.env.DART_DB.prepare("SELECT COUNT(*) AS n FROM corp_codes").first<{ n: number }>(),
    c.env.DART_DB.prepare("SELECT COUNT(*) AS n FROM corp_codes WHERE market='LISTED'").first<{ n: number }>(),
    c.env.DART_DB.prepare("SELECT COUNT(*) AS n FROM filings").first<{ n: number }>(),
    c.env.DART_DB.prepare("SELECT COUNT(*) AS n FROM risk_events WHERE event_dt >= ?").bind(cutoff90).first<{ n: number }>(),
    c.env.DART_DB.prepare("SELECT COUNT(DISTINCT corp_code) AS n FROM distress_scores").first<{ n: number }>(),
    c.env.DART_DB.prepare("SELECT MAX(rcept_dt) AS d FROM filings").first<{ d: string | null }>(),
    c.env.DART_DB.prepare("SELECT bsns_year AS y, reprt_code AS r FROM distress_scores ORDER BY bsns_year DESC, reprt_code DESC LIMIT 1").first<{ y: number; r: string }>(),
  ]);
  c.header("Cache-Control", "public, max-age=60");
  return c.json({
    entities: corp?.n ?? 0,
    listed: listed?.n ?? 0,
    filings_tracked: filings?.n ?? 0,
    risk_events_90d: events90?.n ?? 0,
    distress_scored: distressAny?.n ?? 0,
    latest_distress_period: lastDistress ? `${lastDistress.y}-${lastDistress.r}` : null,
    last_filing_dt: lastFiling?.d ?? null,
    ts: Date.now(),
  });
});

// ─────────────────────────────────────────────────────
// /companies/search?q=삼성  (한글/영문/종목코드 검색)
// Hono는 정의 순서대로 매칭 → search를 :corp_code보다 먼저.
// ─────────────────────────────────────────────────────
app.get("/companies/search", async (c) => {
  const q = c.req.query("q");
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
  if (!q) return c.json({ error: "q required" }, 400);
  const like = `%${q}%`;
  const rows = await c.env.DART_DB.prepare(
    `SELECT corp_code, corp_name, corp_name_eng, stock_code, market
     FROM corp_codes
     WHERE corp_name LIKE ? OR corp_name_eng LIKE ? OR stock_code = ?
     ORDER BY CASE WHEN stock_code IS NOT NULL THEN 0 ELSE 1 END, corp_name
     LIMIT ?`
  ).bind(like, like, q, limit).all();
  return c.json({ query: q, count: rows.results.length, results: rows.results });
});

// ─────────────────────────────────────────────────────
// /companies/:corp_code   (단일 회사 마스터)
// ─────────────────────────────────────────────────────
app.get("/companies/:corp_code", async (c) => {
  const code = c.req.param("corp_code");
  if (!/^\d{8}$/.test(code)) return c.json({ error: "corp_code must be 8 digits" }, 400);
  const row = await c.env.DART_DB
    .prepare("SELECT corp_code, corp_name, corp_name_eng, stock_code, market, modify_date FROM corp_codes WHERE corp_code = ?")
    .bind(code)
    .first();
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

// ─────────────────────────────────────────────────────
// /financials/:corp_code?year=2024&reprt=11011
// ─────────────────────────────────────────────────────
app.get("/financials/:corp_code", async (c) => {
  const code = c.req.param("corp_code");
  const year = Number(c.req.query("year") ?? new Date().getFullYear() - 1);
  const reprt = c.req.query("reprt") ?? "11011";
  if (!/^\d{8}$/.test(code)) return c.json({ error: "corp_code must be 8 digits" }, 400);

  const rows = await c.env.DART_DB.prepare(
    `SELECT sj_div, account_id, account_nm, thstrm_amount, frmtrm_amount, bfefrmtrm_amount, currency
     FROM financials
     WHERE corp_code = ? AND bsns_year = ? AND reprt_code = ? AND fs_div = 'CFS'
     ORDER BY sj_div, account_id`
  ).bind(code, year, reprt).all();

  if (rows.results.length === 0) {
    return c.json({ error: "no data — try /admin/fetch-financial to backfill", corp_code: code, year, reprt }, 404);
  }
  const items = rows.results.map((r: any) => toEnglish({
    bsns_year: String(year),
    reprt_code: reprt,
    sj_div: r.sj_div,
    account_id: r.account_id,
    account_nm: r.account_nm,
    thstrm_amount: String(r.thstrm_amount ?? ""),
    frmtrm_amount: String(r.frmtrm_amount ?? ""),
    bfefrmtrm_amount: String(r.bfefrmtrm_amount ?? ""),
    currency: r.currency ?? "KRW",
  }));
  return c.json({ corp_code: code, fiscal_year: year, report_type: reprt, count: items.length, items });
});

// ─────────────────────────────────────────────────────
// /distress/:corp_code   — 사전계산된 스코어 (O(1) 응답)
// ─────────────────────────────────────────────────────
app.get("/distress/:corp_code", async (c) => {
  const code = c.req.param("corp_code");
  if (!/^\d{8}$/.test(code)) return c.json({ error: "corp_code must be 8 digits" }, 400);

  const latest = await c.env.DART_DB.prepare(
    `SELECT bsns_year, reprt_code, altman_z_em, altman_grade, piotroski_f, piotroski_grade,
            risk_events_90d, composite_risk, composite_grade, computed_at
     FROM distress_scores WHERE corp_code = ?
     ORDER BY bsns_year DESC, reprt_code DESC LIMIT 1`
  ).bind(code).first();

  if (!latest) return c.json({ error: "distress score not computed yet", corp_code: code }, 404);

  const events = await c.env.DART_DB.prepare(
    `SELECT event_type, severity, event_dt, detail FROM risk_events
     WHERE corp_code = ? AND event_dt >= strftime('%Y%m%d', 'now', '-90 days')
     ORDER BY event_dt DESC LIMIT 20`
  ).bind(code).all();

  return c.json({
    corp_code: code,
    fiscal_year: latest.bsns_year,
    report_type: latest.reprt_code,
    altman_z_em: latest.altman_z_em,
    altman_grade: latest.altman_grade,
    piotroski_f: latest.piotroski_f,
    piotroski_grade: latest.piotroski_grade,
    risk_events_90d: latest.risk_events_90d,
    composite_risk: latest.composite_risk,
    composite_grade: latest.composite_grade,
    computed_at: latest.computed_at,
    recent_events: events.results,
  });
});

// ─────────────────────────────────────────────────────
// /screener  — Bulk distress screening
// ─────────────────────────────────────────────────────
/**
 * /screener?altman_max=1.5&piotroski_min=7&grade=DISTRESS&limit=50
 *
 * Quant/analyst의 킬러 유즈케이스. 사전계산된 distress_scores 위에 필터만 적용해 O(N).
 * 응답은 전부 상장사 KOSPI/KOSDAQ 만.
 */
app.get("/screener", async (c) => {
  const altmanMax = c.req.query("altman_max");
  const altmanMin = c.req.query("altman_min");
  const pioMin = c.req.query("piotroski_min");
  const pioMax = c.req.query("piotroski_max");
  const grade = c.req.query("grade"); // LOW/MEDIUM/HIGH/CRITICAL
  const altmanGrade = c.req.query("altman_grade"); // SAFE/GREY/DISTRESS
  const year = c.req.query("year"); // 2024/2025
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 500);
  const sort = c.req.query("sort") ?? "composite_desc"; // composite_desc, altman_asc, piotroski_asc

  const where: string[] = ["cc.stock_code IS NOT NULL", "cc.market='LISTED'"];
  const params: any[] = [];

  if (year) { where.push("ds.bsns_year = ?"); params.push(Number(year)); }
  if (altmanMax) { where.push("ds.altman_z_em <= ?"); params.push(Number(altmanMax)); }
  if (altmanMin) { where.push("ds.altman_z_em >= ?"); params.push(Number(altmanMin)); }
  if (pioMin) { where.push("ds.piotroski_f >= ?"); params.push(Number(pioMin)); }
  if (pioMax) { where.push("ds.piotroski_f <= ?"); params.push(Number(pioMax)); }
  if (grade) { where.push("ds.composite_grade = ?"); params.push(grade); }
  if (altmanGrade) { where.push("ds.altman_grade = ?"); params.push(altmanGrade); }

  const orderBy = sort === "altman_asc" ? "ds.altman_z_em ASC"
    : sort === "altman_desc" ? "ds.altman_z_em DESC"
    : sort === "piotroski_asc" ? "ds.piotroski_f ASC"
    : sort === "piotroski_desc" ? "ds.piotroski_f DESC"
    : "ds.composite_risk DESC";

  const sql = `
    SELECT ds.corp_code, cc.corp_name, cc.corp_name_eng, cc.stock_code,
           ds.bsns_year, ds.reprt_code,
           ds.altman_z_em, ds.altman_grade,
           ds.piotroski_f, ds.piotroski_grade,
           ds.composite_risk, ds.composite_grade
    FROM distress_scores ds
    JOIN corp_codes cc ON ds.corp_code = cc.corp_code
    WHERE ${where.join(" AND ")}
      AND ds.bsns_year = (SELECT MAX(bsns_year) FROM distress_scores WHERE corp_code = ds.corp_code)
    ORDER BY ${orderBy}
    LIMIT ?
  `;
  params.push(limit);

  const rows = await c.env.DART_DB.prepare(sql).bind(...params).all();
  c.header("Cache-Control", "public, max-age=300");
  return c.json({
    filters: { altman_max: altmanMax, altman_min: altmanMin, piotroski_min: pioMin, piotroski_max: pioMax, grade, altman_grade: altmanGrade, year, sort },
    count: rows.results.length,
    results: rows.results,
  });
});

// ─────────────────────────────────────────────────────
// /events/recent?days=7&type=DELISTING_RISK
// ─────────────────────────────────────────────────────
app.get("/events/recent", async (c) => {
  const days = Math.min(Number(c.req.query("days") ?? 7), 90);
  const type = c.req.query("type");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 500);
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10).replace(/-/g, "");

  const q = type
    ? `SELECT re.event_type, re.severity, re.event_dt, re.detail, re.corp_code, cc.corp_name, cc.corp_name_eng, cc.stock_code
       FROM risk_events re LEFT JOIN corp_codes cc ON re.corp_code = cc.corp_code
       WHERE re.event_dt >= ? AND re.event_type = ?
       ORDER BY re.event_dt DESC, re.severity DESC LIMIT ?`
    : `SELECT re.event_type, re.severity, re.event_dt, re.detail, re.corp_code, cc.corp_name, cc.corp_name_eng, cc.stock_code
       FROM risk_events re LEFT JOIN corp_codes cc ON re.corp_code = cc.corp_code
       WHERE re.event_dt >= ?
       ORDER BY re.event_dt DESC, re.severity DESC LIMIT ?`;
  const rows = type
    ? await c.env.DART_DB.prepare(q).bind(cutoff, type, limit).all()
    : await c.env.DART_DB.prepare(q).bind(cutoff, limit).all();

  return c.json({ from: cutoff, days, type: type ?? "all", count: rows.results.length, results: rows.results });
});

// ─────────────────────────────────────────────────────
// Admin (Bearer ADMIN_SECRET)
// ─────────────────────────────────────────────────────
function checkAdmin(c: any): boolean {
  const auth = c.req.header("Authorization") ?? "";
  return auth === `Bearer ${c.env.ADMIN_SECRET}`;
}

/**
 * POST /admin/backfill-financials?year=2024&start=0&count=50
 * 상장사 corp_code offset~offset+count 범위 재무 백필.
 * Worker CPU + subrequest 한계 고려해 count는 50 이하 권장.
 * 응답: { done, next, ok, empty, err, rows }
 */
app.post("/admin/backfill-financials", async (c) => {
  if (!checkAdmin(c)) return c.json({ error: "unauthorized" }, 401);
  const year = Number(c.req.query("year") ?? 2024);
  const reprt = c.req.query("reprt") ?? "11011";
  const start = Number(c.req.query("start") ?? 0);
  const count = Math.min(Number(c.req.query("count") ?? 100), 200);
  const t0 = Date.now();

  const list = await c.env.DART_DB.prepare(
    `SELECT corp_code FROM corp_codes
     WHERE stock_code IS NOT NULL AND market='LISTED'
     ORDER BY modify_date DESC LIMIT ? OFFSET ?`
  ).bind(count, start).all();
  const companies = list.results as Array<{ corp_code: string }>;

  const client = new OpenDartClient({ key: c.env.OPENDART_KEY });
  let ok = 0, empty = 0, err = 0, rowsIns = 0;
  const errors: string[] = [];

  const parseAmt = (s: string) => {
    if (!s || s === "-") return null;
    const n = Number(String(s).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  // 전체 병렬 fetch (Cloudflare Worker는 subrequest concurrency high)
  const fetches = await Promise.allSettled(
    companies.map((co) => client.singleFinancial(co.corp_code, year, reprt))
  );

  // 성공 응답을 한 번의 D1 batch로 upsert (여러 회사 rows 통합)
  const allStmts: D1PreparedStatement[] = [];
  for (let i = 0; i < companies.length; i++) {
    const co = companies[i];
    const f = fetches[i];
    if (f.status === "rejected") {
      err++;
      if (errors.length < 5) errors.push(`${co.corp_code}: ${String(f.reason?.message ?? f.reason)}`);
      continue;
    }
    const res = f.value;
    if (res.status === "013" || !res.list) { empty++; continue; }
    if (res.status !== "000") {
      err++;
      if (errors.length < 5) errors.push(`${co.corp_code}: dart=${res.status} ${res.message}`);
      continue;
    }
    for (const it of res.list) {
      // fnlttSinglAcnt API는 account_id가 자주 빈 문자열이라 account_nm을 key로 사용
      const key = it.account_id && it.account_id !== "" ? it.account_id : (it.account_nm ?? "");
      allStmts.push(
        c.env.DART_DB.prepare(
          `INSERT INTO financials (corp_code, bsns_year, reprt_code, fs_div, sj_div, account_id, account_nm, thstrm_amount, frmtrm_amount, bfefrmtrm_amount, currency)
           VALUES (?, ?, ?, 'CFS', ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(corp_code, bsns_year, reprt_code, fs_div, sj_div, account_id) DO UPDATE SET
             account_nm=excluded.account_nm, thstrm_amount=excluded.thstrm_amount,
             frmtrm_amount=excluded.frmtrm_amount, bfefrmtrm_amount=excluded.bfefrmtrm_amount, fetched_at=unixepoch()`
        ).bind(
          co.corp_code, year, reprt,
          it.sj_div ?? "", key, it.account_nm ?? "",
          parseAmt(it.thstrm_amount), parseAmt(it.frmtrm_amount), parseAmt(it.bfefrmtrm_amount),
          it.currency ?? "KRW"
        )
      );
    }
    ok++;
  }

  if (allStmts.length > 0) {
    // D1 batch는 100개 statement/call 권장. chunk로 나눔.
    const CHUNK = 100;
    for (let i = 0; i < allStmts.length; i += CHUNK) {
      await c.env.DART_DB.batch(allStmts.slice(i, i + CHUNK));
    }
    rowsIns = allStmts.length;
  }

  return c.json({
    ok, empty, err, rowsIns, count: companies.length,
    next: companies.length === count ? start + count : null,
    ms: Date.now() - t0,
    errors: errors.length ? errors : undefined,
  });
});

/**
 * POST /admin/compute-distress?year=2024&start=0&count=500
 * financials → Altman Z (EM) + Piotroski F 계산 → distress_scores upsert.
 */
app.post("/admin/compute-distress", async (c) => {
  if (!checkAdmin(c)) return c.json({ error: "unauthorized" }, 401);
  const year = Number(c.req.query("year") ?? 2024);
  const reprt = c.req.query("reprt") ?? "11011";
  const start = Number(c.req.query("start") ?? 0);
  const count = Math.min(Number(c.req.query("count") ?? 80), 90);
  const t0 = Date.now();

  // 대상 corp_code
  const list = await c.env.DART_DB.prepare(
    `SELECT DISTINCT corp_code FROM financials WHERE bsns_year = ? AND reprt_code = ? LIMIT ? OFFSET ?`
  ).bind(year, reprt, count, start).all();
  const codes = (list.results as Array<{ corp_code: string }>).map((r) => r.corp_code);
  if (codes.length === 0) {
    return c.json({ ok: 0, next: null, ms: Date.now() - t0 });
  }

  // 모든 회사의 재무 한 번에 pull (당기 + 전기)
  const placeholders = codes.map(() => "?").join(",");
  const rows = await c.env.DART_DB.prepare(
    `SELECT corp_code, account_nm, thstrm_amount, frmtrm_amount
     FROM financials
     WHERE corp_code IN (${placeholders}) AND bsns_year = ? AND reprt_code = ? AND fs_div = 'CFS'`
  ).bind(...codes, year, reprt).all();

  // 회사별 집계
  const byCorp = new Map<string, Record<string, { cur: number | null; pri: number | null }>>();
  for (const r of rows.results as any[]) {
    if (!byCorp.has(r.corp_code)) byCorp.set(r.corp_code, {});
    byCorp.get(r.corp_code)![r.account_nm] = { cur: r.thstrm_amount, pri: r.frmtrm_amount };
  }

  const stmts: D1PreparedStatement[] = [];
  let ok = 0, bad = 0;
  for (const [corp_code, acc] of byCorp) {
    // 필요 계정
    const get = (name: string, k: "cur" | "pri") => acc[name]?.[k] ?? null;
    const ca = get("유동자산", "cur"), cl = get("유동부채", "cur");
    const ta = get("자산총계", "cur"), tl = get("부채총계", "cur");
    const re = get("이익잉여금", "cur"), te = get("자본총계", "cur");
    const rev = get("매출액", "cur"), oi = get("영업이익", "cur");
    const ni = get("당기순이익(손실)", "cur") ?? get("당기순이익", "cur");

    // Altman Z''-EM (Altman 2005): 3.25 상수 포함 버전 → 컷오프 5.85 / 4.35
    // (상수 없는 Z'' 컷오프 2.60 / 1.10을 쓰면 3.25만큼 SAFE로 치우침)
    let altmanZ: number | null = null, altmanGrade = "N/A";
    if (ta && ta > 0) {
      const x1 = ca !== null && cl !== null ? (ca - cl) / ta : null;
      const x2 = re !== null ? re / ta : null;
      const x3 = oi !== null ? oi / ta : null;
      const x4 = te !== null && tl && tl > 0 ? te / tl : null;
      if (x1 !== null && x2 !== null && x3 !== null && x4 !== null) {
        altmanZ = 3.25 + 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4;
        altmanGrade = altmanZ > 5.85 ? "SAFE" : altmanZ >= 4.35 ? "GREY" : "DISTRESS";
      }
    }

    // Piotroski-style F, 5 signals (0–5). 주요계정 API에 CFO·주식수·매출총이익이 없어 9개 중 5개만 근사.
    let pioScore = 0, usable = 0;
    const add = (v: boolean | null) => { if (v !== null) { usable++; if (v) pioScore++; } };
    add(ni !== null ? ni > 0 : null);                    // ROA > 0 (근사)
    add(ni !== null && get("당기순이익(손실)", "pri") !== null
        ? ni > get("당기순이익(손실)", "pri")! : null);  // ΔNI > 0
    add(oi !== null && rev && rev > 0
        ? oi / rev > 0.05 : null);                       // OM > 5%
    add(tl !== null && ta !== null && ta > 0 ? (tl / ta) < 0.5 : null); // 부채비율 낮음
    add(ca !== null && cl !== null && cl > 0 ? ca > cl : null);         // 유동성

    let pioGrade = "N/A", pioFinal: number | null = null;
    if (usable >= 3) {
      pioFinal = pioScore;
      pioGrade = pioScore >= 4 ? "STRONG" : pioScore >= 2 ? "MID" : "WEAK";
    }

    // Composite
    let compScore = 0;
    compScore += altmanGrade === "SAFE" ? 0 : altmanGrade === "GREY" ? 30 : altmanGrade === "DISTRESS" ? 70 : 15;
    compScore += pioGrade === "STRONG" ? 0 : pioGrade === "MID" ? 10 : pioGrade === "WEAK" ? 20 : 10;
    const compGrade = compScore < 25 ? "LOW" : compScore < 50 ? "MEDIUM" : compScore < 75 ? "HIGH" : "CRITICAL";

    if (altmanZ === null && pioFinal === null) { bad++; continue; }

    stmts.push(
      c.env.DART_DB.prepare(
        `INSERT INTO distress_scores (corp_code, bsns_year, reprt_code, altman_z_em, altman_grade, piotroski_f, piotroski_grade, risk_events_90d, composite_risk, composite_grade)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(corp_code, bsns_year, reprt_code) DO UPDATE SET
           altman_z_em=excluded.altman_z_em, altman_grade=excluded.altman_grade,
           piotroski_f=excluded.piotroski_f, piotroski_grade=excluded.piotroski_grade,
           composite_risk=excluded.composite_risk, composite_grade=excluded.composite_grade,
           computed_at=unixepoch()`
      ).bind(corp_code, year, reprt, altmanZ, altmanGrade, pioFinal, pioGrade, compScore, compGrade)
    );
    ok++;
  }

  // D1 batch (chunk 100)
  for (let i = 0; i < stmts.length; i += 100) {
    await c.env.DART_DB.batch(stmts.slice(i, i + 100));
  }

  return c.json({
    ok, bad, computed: stmts.length,
    next: codes.length === count ? start + count : null,
    ms: Date.now() - t0,
  });
});

/**
 * POST /admin/daily-crawl?days=&bgn_de=&end_de=&max_pages=
 *
 * 우선순위:
 *   1) bgn_de/end_de 명시 → 그 범위
 *   2) days 명시 → today ~ today-days
 *   3) 기본 → MAX(filings.rcept_dt)+1 부터 today (없으면 14일 lookback)
 *
 * DART가 013 리턴하면 status/message를 응답 + crawl_log에 기록해 조용한 실패 방지.
 * filings/risk_events 는 D1 batch 로 chunk 100씩 insert.
 */
app.post("/admin/daily-crawl", async (c) => {
  if (!checkAdmin(c)) return c.json({ error: "unauthorized" }, 401);
  const t0 = Date.now();
  const client = new OpenDartClient({ key: c.env.OPENDART_KEY });

  const daysQ = c.req.query("days");
  const bgnQ = c.req.query("bgn_de");
  const endQ = c.req.query("end_de");
  const maxPages = Math.min(Number(c.req.query("max_pages") ?? 100), 500);

  const today = new Date();
  const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, "");
  const endDate = endQ ?? yyyymmdd;

  let startDate: string;
  let startSource: string;
  if (bgnQ) {
    startDate = bgnQ;
    startSource = "explicit";
  } else if (daysQ) {
    startDate = new Date(Date.now() - Number(daysQ) * 86400_000).toISOString().slice(0, 10).replace(/-/g, "");
    startSource = `days=${daysQ}`;
  } else {
    const last = await c.env.DART_DB
      .prepare(`SELECT MAX(rcept_dt) AS d FROM filings`).first<{ d: string | null }>();
    if (last?.d && /^\d{8}$/.test(last.d)) {
      const y = Number(last.d.slice(0, 4)), m = Number(last.d.slice(4, 6)) - 1, dd = Number(last.d.slice(6, 8));
      const next = new Date(Date.UTC(y, m, dd) + 86400_000);
      startDate = next.toISOString().slice(0, 10).replace(/-/g, "");
      startSource = `last_rcept+1=${last.d}`;
    } else {
      startDate = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10).replace(/-/g, "");
      startSource = "fallback_14d";
    }
  }

  let inserted = 0;
  let riskInserted = 0;
  let pagesFetched = 0;
  let dartStatus = "";
  let dartMessage = "";
  let totalCount = 0;
  let error: string | null = null;

  try {
    let page = 1;
    while (page <= maxPages) {
      const res = await client.listFilings({
        bgn_de: startDate,
        end_de: endDate,
        page_no: page,
        page_count: 100,
      });
      pagesFetched++;
      dartStatus = res.status;
      dartMessage = res.message;
      if (res.status === "013") break; // no data — 정상 종료
      if (res.status !== "000" || !res.list) {
        throw new Error(`DART ${res.status}: ${dartStatusLabel(res.status)} — ${res.message}`);
      }
      totalCount = res.total_count ?? totalCount;

      const stmts: D1PreparedStatement[] = [];
      for (const f of res.list) {
        stmts.push(
          c.env.DART_DB.prepare(
            `INSERT INTO filings (rcept_no, corp_code, corp_name, report_nm, rcept_dt, flr_nm, rm)
             VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(rcept_no) DO NOTHING`
          ).bind(f.rcept_no, f.corp_code, f.corp_name, f.report_nm, f.rcept_dt, f.flr_nm ?? "", f.rm ?? "")
        );
        inserted++;
        for (const ev of detectRiskEvents(f.report_nm)) {
          stmts.push(
            c.env.DART_DB.prepare(
              `INSERT INTO risk_events (rcept_no, corp_code, event_type, event_dt, severity, detail)
               VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(rcept_no, event_type) DO NOTHING`
            ).bind(f.rcept_no, f.corp_code, ev.type, f.rcept_dt, ev.severity, f.report_nm.slice(0, 200))
          );
          riskInserted++;
        }
      }
      for (let i = 0; i < stmts.length; i += 100) {
        await c.env.DART_DB.batch(stmts.slice(i, i + 100));
      }
      if (page >= (res.total_page ?? 1)) break;
      page++;
    }
  } catch (e: any) {
    error = e?.message ?? String(e);
  }

  const logNote = error ?? (dartStatus === "013" ? `DART:013 ${dartMessage} range=${startDate}~${endDate}` : null);
  await c.env.DART_DB.prepare(
    `INSERT INTO crawl_log (job, status, rows_upserted, error, duration_ms) VALUES (?, ?, ?, ?, ?)`
  ).bind("filings_daily", error ? "FAIL" : "OK", inserted, logNote, Date.now() - t0).run();

  // 카톡 통지 — 실패했을 때만. 정상 수집은 알리지 않는다(수집이 멈추면 notify 의 아침 요약이 알려 준다).
  // 받는 사람은 개발자가 아니므로 "무슨 일인지 + 다음에 어떻게 되는지" 를 먼저 쓰고 원인은 뒤에 붙인다.
  if (error) {
    await notifyKakao(c.env, {
      title: "KRDART 공시 수집 실패",
      body: `어젯밤 한국 공시 자동 수집이 실패했어요. 내일 새벽에 다시 시도합니다. 이틀 연속이면 점검이 필요해요.\n원인: ${startDate}~${endDate} · DART 응답 ${dartStatus} · ${error}`,
      url: "https://dart.ryanpp.com",
      button: "사이트 열기",
    });
  }

  return c.json({
    ok: !error,
    range: { bgn_de: startDate, end_de: endDate, source: startSource },
    inserted,
    riskInserted,
    pagesFetched,
    totalCount,
    dartStatus,
    dartMessage,
    ms: Date.now() - t0,
    error,
  });
});

// ─────────────────────────────────────────────────────
// Cron trigger — 매일 03:00 KST (18:00 UTC 전날)
// ─────────────────────────────────────────────────────
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    // 관리 endpoint를 직접 호출 (같은 로직 재사용)
    const req = new Request("http://internal/admin/daily-crawl", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.ADMIN_SECRET}` },
    });
    await app.fetch(req, env);
  },
};
