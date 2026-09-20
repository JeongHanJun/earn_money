import { Hono } from "hono";
import { runWeekly, runBackfill } from "./crawler";

export interface Env {
  LOTTO_DB: D1Database;
  LOTTO_R2: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_SECRET: string;              // wrangler secret put ADMIN_SECRET
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) =>
  c.json({ ok: true, ts: new Date().toISOString() }),
);

// 최신 회차 요약
app.get("/api/latest", async (c) => {
  const row = await c.env.LOTTO_DB.prepare(
    `SELECT drw_no, drw_date, n1, n2, n3, n4, n5, n6, bonus, first_amt, first_cnt, total_sales
     FROM draws ORDER BY drw_no DESC LIMIT 1`,
  ).first();
  if (!row) return c.json({ error: "no data" }, 404);
  return c.json(row);
});

// 회차 범위 조회 (시뮬레이션 매칭용)
app.get("/api/draws", async (c) => {
  const from = Number(c.req.query("from") ?? 1);
  const to = Number(c.req.query("to") ?? from + 10);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to - from > 1500) {
    return c.json({ error: "invalid range" }, 400);
  }
  const rows = await c.env.LOTTO_DB.prepare(
    `SELECT drw_no, drw_date, n1, n2, n3, n4, n5, n6, bonus
     FROM draws WHERE drw_no BETWEEN ?1 AND ?2 ORDER BY drw_no ASC`,
  )
    .bind(from, to)
    .all();
  return c.json({ rows: rows.results });
});

// 특정 회차 상세 (등수별 상금 포함)
app.get("/api/draw/:drwNo", async (c) => {
  const drwNo = Number(c.req.param("drwNo"));
  if (!Number.isFinite(drwNo)) return c.json({ error: "invalid" }, 400);
  const draw = await c.env.LOTTO_DB.prepare(
    `SELECT * FROM draws WHERE drw_no = ?1`,
  )
    .bind(drwNo)
    .first();
  if (!draw) return c.json({ error: "not found" }, 404);
  const prizes = await c.env.LOTTO_DB.prepare(
    `SELECT rank, winners, amount FROM prizes WHERE drw_no = ?1 ORDER BY rank ASC`,
  )
    .bind(drwNo)
    .all();
  return c.json({ draw, prizes: prizes.results });
});

// 번호 출현 빈도 (기간 필터)
app.get("/api/stats/frequency", async (c) => {
  const from = Number(c.req.query("from") ?? 1);
  const to = Number(c.req.query("to") ?? 99999);
  const q = c.env.LOTTO_DB.prepare(
    `WITH nums AS (
       SELECT n1 AS n FROM draws WHERE drw_no BETWEEN ?1 AND ?2
       UNION ALL SELECT n2 FROM draws WHERE drw_no BETWEEN ?1 AND ?2
       UNION ALL SELECT n3 FROM draws WHERE drw_no BETWEEN ?1 AND ?2
       UNION ALL SELECT n4 FROM draws WHERE drw_no BETWEEN ?1 AND ?2
       UNION ALL SELECT n5 FROM draws WHERE drw_no BETWEEN ?1 AND ?2
       UNION ALL SELECT n6 FROM draws WHERE drw_no BETWEEN ?1 AND ?2
     )
     SELECT n, COUNT(*) AS cnt FROM nums GROUP BY n ORDER BY n ASC`,
  ).bind(from, to);
  const rows = await q.all();
  return c.json({ rows: rows.results });
});

// 명당 랭킹 (전체 회차 기준 판매점별 배출 횟수)
app.get("/api/stats/top-stores", async (c) => {
  const rank = c.req.query("rank"); // '1' | '2' | undefined(전체)
  const sido = c.req.query("sido");
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);

  const conds: string[] = [];
  const binds: unknown[] = [];
  if (rank === "1" || rank === "2") {
    conds.push("ws.rank = ?");
    binds.push(Number(rank));
  }
  if (sido) {
    conds.push("s.sido = ?");
    binds.push(sido);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const sql = `
    SELECT s.store_id, s.name, s.addr, s.sido, s.sigungu, s.lat, s.lng,
           SUM(CASE WHEN ws.rank = 1 THEN 1 ELSE 0 END) AS rank1_cnt,
           SUM(CASE WHEN ws.rank = 2 THEN 1 ELSE 0 END) AS rank2_cnt,
           COUNT(*) AS total_cnt
    FROM winning_stores ws
    JOIN stores s ON s.store_id = ws.store_id
    ${where}
    GROUP BY s.store_id
    ORDER BY rank1_cnt DESC, rank2_cnt DESC
    LIMIT ${limit}
  `;
  const rows = await c.env.LOTTO_DB.prepare(sql).bind(...binds).all();
  return c.json({ rows: rows.results });
});

// 시·구별 명당 집계 (choropleth 지도용)
app.get("/api/stats/region", async (c) => {
  const rows = await c.env.LOTTO_DB.prepare(`
    SELECT s.sido, s.sigungu,
           SUM(CASE WHEN ws.rank = 1 THEN 1 ELSE 0 END) AS rank1_cnt,
           SUM(CASE WHEN ws.rank = 2 THEN 1 ELSE 0 END) AS rank2_cnt,
           COUNT(*) AS total_cnt
    FROM winning_stores ws
    JOIN stores s ON s.store_id = ws.store_id
    WHERE s.sido IS NOT NULL AND s.sigungu IS NOT NULL
    GROUP BY s.sido, s.sigungu
    ORDER BY rank1_cnt DESC
  `).all();
  return c.json({ rows: rows.results });
});

// 최신 회차 배출점 상세
app.get("/api/stores/by-draw/:drwNo", async (c) => {
  const drwNo = Number(c.req.param("drwNo"));
  if (!Number.isFinite(drwNo)) return c.json({ error: "invalid" }, 400);
  const rows = await c.env.LOTTO_DB.prepare(`
    SELECT ws.rank, ws.method, s.store_id, s.name, s.addr, s.sido, s.sigungu, s.lat, s.lng
    FROM winning_stores ws
    JOIN stores s ON s.store_id = ws.store_id
    WHERE ws.drw_no = ?1
    ORDER BY ws.rank ASC, s.sido ASC
  `).bind(drwNo).all();
  return c.json({ rows: rows.results });
});

// 익명 시뮬레이션 기록
app.post("/api/simulations", async (c) => {
  const body = await c.req.json<{
    sessionId?: string;
    drwNo?: number;
    totalTickets?: number;
    bestRank?: number | null;
    bestRankIndex?: number | null;
    matchedFirstHundred?: boolean;
  }>().catch(() => null);
  if (!body || !body.sessionId || !body.drwNo || !body.totalTickets) {
    return c.json({ error: "invalid" }, 400);
  }
  await c.env.LOTTO_DB.prepare(
    `INSERT INTO simulations (session_id, drw_no, total_tickets, best_rank, best_rank_index, matched_first_hundred, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  )
    .bind(
      body.sessionId.slice(0, 64),
      body.drwNo,
      body.totalTickets,
      body.bestRank ?? null,
      body.bestRankIndex ?? null,
      body.matchedFirstHundred ? 1 : 0,
      Date.now(),
    )
    .run();
  return c.json({ ok: true });
});

// 시뮬레이션 메타 통계
app.get("/api/simulations/meta", async (c) => {
  const total = await c.env.LOTTO_DB.prepare(
    `SELECT COUNT(*) AS c FROM simulations`,
  ).first<{ c: number }>();
  const dist = await c.env.LOTTO_DB.prepare(
    `SELECT COALESCE(best_rank, 0) AS rank, COUNT(*) AS c FROM simulations GROUP BY best_rank`,
  ).all();
  const jackpots = await c.env.LOTTO_DB.prepare(
    `SELECT COUNT(*) AS c FROM simulations WHERE best_rank = 1`,
  ).first<{ c: number }>();
  return c.json({
    total: total?.c ?? 0,
    jackpots: jackpots?.c ?? 0,
    distribution: dist.results,
  });
});

// ADMIN: 백필 트리거 (Bearer ADMIN_SECRET)
app.post("/api/admin/backfill", async (c) => {
  const auth = c.req.header("authorization") ?? "";
  if (auth !== `Bearer ${c.env.ADMIN_SECRET}`) return c.json({ error: "unauthorized" }, 401);
  const from = Number(c.req.query("from"));
  const to = Number(c.req.query("to"));
  const skipIfPresent = c.req.query("skip") !== "false";
  if (!Number.isFinite(from) || !Number.isFinite(to)) return c.json({ error: "from/to required" }, 400);
  if (to - from > 100) return c.json({ error: "range too wide (max 100 per call, chain sequentially)" }, 400);
  const stats = await runBackfill(c.env, from, to, { skipIfPresent });
  return c.json({ ok: true, stats });
});

// ADMIN: 주간 크롤 수동 실행
app.post("/api/admin/run-weekly", async (c) => {
  const auth = c.req.header("authorization") ?? "";
  if (auth !== `Bearer ${c.env.ADMIN_SECRET}`) return c.json({ error: "unauthorized" }, 401);
  const result = await runWeekly(c.env);
  return c.json({ ok: true, ...result });
});

// 크롤러 로그 조회
app.get("/api/admin/log", async (c) => {
  const auth = c.req.header("authorization") ?? "";
  if (auth !== `Bearer ${c.env.ADMIN_SECRET}`) return c.json({ error: "unauthorized" }, 401);
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 500);
  const rows = await c.env.LOTTO_DB.prepare(
    `SELECT * FROM crawl_log ORDER BY id DESC LIMIT ?1`,
  ).bind(limit).all();
  return c.json({ rows: rows.results });
});

// 정적 자산으로 폴백 (assets 바인딩)
app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runWeekly(env).catch((e) => {
        console.error("[cron] runWeekly failed", e);
      }),
    );
  },
};
