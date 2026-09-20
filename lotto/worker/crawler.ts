// 크롤러 파이프라인: dhlottery 응답 → D1 upsert
// - runWeekly: 매주 최신 회차 수집 (Cron)
// - runBackfill: 특정 회차 범위 판매점 백필 (admin endpoint)

import type { Env } from "./index";
import {
  fetchLatestDraw,
  fetchWinningStores,
  methodCode,
} from "./dhlottery";
import { parseAddress } from "./address";

async function log(env: Env, kind: string, drwFrom: number | null, drwTo: number | null, ok: boolean, message: string) {
  try {
    await env.LOTTO_DB.prepare(
      `INSERT INTO crawl_log (ran_at, kind, drw_from, drw_to, ok, message) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(Date.now(), kind, drwFrom, drwTo, ok ? 1 : 0, message.slice(0, 4000))
      .run();
  } catch {
    // logging 실패는 무시
  }
}

/** 특정 회차의 draws + prizes upsert (dhlottery 최신 응답 기준) */
async function upsertLatestDraw(env: Env): Promise<{ drwNo: number; drwDate: string }> {
  const d = await fetchLatestDraw();
  const now = Date.now();
  await env.LOTTO_DB.batch([
    env.LOTTO_DB.prepare(
      `INSERT INTO draws (drw_no, drw_date, n1, n2, n3, n4, n5, n6, bonus, total_sales, first_amt, first_cnt, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
       ON CONFLICT(drw_no) DO UPDATE SET
         drw_date=excluded.drw_date, n1=excluded.n1, n2=excluded.n2, n3=excluded.n3,
         n4=excluded.n4, n5=excluded.n5, n6=excluded.n6, bonus=excluded.bonus,
         total_sales=excluded.total_sales, first_amt=excluded.first_amt,
         first_cnt=excluded.first_cnt, updated_at=excluded.updated_at`,
    ).bind(
      d.drwNo,
      d.drwDate,
      d.numbers[0], d.numbers[1], d.numbers[2], d.numbers[3], d.numbers[4], d.numbers[5],
      d.bonus,
      d.totalSales,
      d.firstAmt,
      d.firstCnt,
      now,
    ),
    ...d.prizes.map((p) =>
      env.LOTTO_DB.prepare(
        `INSERT INTO prizes (drw_no, rank, winners, amount)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(drw_no, rank) DO UPDATE SET
           winners=excluded.winners, amount=excluded.amount`,
      ).bind(d.drwNo, p.rank, p.winners, p.amount),
    ),
  ]);
  return { drwNo: d.drwNo, drwDate: d.drwDate };
}

/** 회차별 배출점 + 판매점 upsert (기존 winning_stores 재작성) */
async function upsertWinningStores(env: Env, drwNo: number): Promise<{ inserted: number }> {
  const resp = await fetchWinningStores(drwNo);
  const rows = resp.list;
  if (rows.length === 0) return { inserted: 0 };

  // 판매점 upsert (dedup by ltShpId)
  const storeMap = new Map<number, (typeof rows)[number]>();
  for (const r of rows) {
    const id = Number(r.ltShpId);
    if (!Number.isFinite(id) || storeMap.has(id)) continue;
    storeMap.set(id, r);
  }
  const now = Date.now();
  const storeStmts = [...storeMap.entries()].map(([id, r]) => {
    const p = parseAddress(r.shpAddr ?? r.rdnm);
    return env.LOTTO_DB.prepare(
      `INSERT INTO stores (store_id, name, addr, sido, sigungu, eupmyeondong, lat, lng, first_seen_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(store_id) DO UPDATE SET
         name=excluded.name, addr=excluded.addr,
         sido=excluded.sido, sigungu=excluded.sigungu, eupmyeondong=excluded.eupmyeondong,
         lat=excluded.lat, lng=excluded.lng`,
    ).bind(
      id,
      r.shpNm,
      r.shpAddr ?? r.rdnm ?? "",
      p.sido,
      p.sigungu,
      p.eupmyeondong,
      r.shpLat,
      r.shpLot,
      now,
    );
  });

  // 기존 회차 배출점 삭제 후 재삽입 (idempotent)
  const delStmt = env.LOTTO_DB.prepare(
    `DELETE FROM winning_stores WHERE drw_no = ?1`,
  ).bind(drwNo);

  const insertStmts = rows.map((r) => {
    return env.LOTTO_DB.prepare(
      `INSERT INTO winning_stores (drw_no, rank, store_id, method) VALUES (?1, ?2, ?3, ?4)`,
    ).bind(drwNo, Number(r.wnShpRnk), Number(r.ltShpId), methodCode(r.atmtPsvYnTxt));
  });

  await env.LOTTO_DB.batch([...storeStmts, delStmt, ...insertStmts]);
  return { inserted: rows.length };
}

/** 매주 Cron: 최신 회차 수집 → 배출점까지 */
export async function runWeekly(env: Env): Promise<{ drwNo: number; storesInserted: number }> {
  const started = Date.now();
  try {
    const d = await upsertLatestDraw(env);
    const { inserted } = await upsertWinningStores(env, d.drwNo);
    await log(env, "weekly", d.drwNo, d.drwNo, true, `latest ${d.drwNo} (${d.drwDate}), stores ${inserted}, ${Date.now() - started}ms`);
    return { drwNo: d.drwNo, storesInserted: inserted };
  } catch (e) {
    const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
    await log(env, "weekly", null, null, false, msg);
    throw e;
  }
}

/** 백필: 특정 회차 범위 배출점 크롤링. 0.5초 간격, 실패 시 계속 진행. */
export async function runBackfill(
  env: Env,
  from: number,
  to: number,
  opts: { skipIfPresent?: boolean } = {},
): Promise<{ processed: number; succeeded: number; failed: number; skipped: number }> {
  const started = Date.now();
  const stats = { processed: 0, succeeded: 0, failed: 0, skipped: 0 };
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);

  for (let n = lo; n <= hi; n++) {
    stats.processed++;
    try {
      if (opts.skipIfPresent) {
        const row = await env.LOTTO_DB.prepare(
          `SELECT COUNT(*) AS c FROM winning_stores WHERE drw_no = ?1`,
        )
          .bind(n)
          .first<{ c: number }>();
        if ((row?.c ?? 0) > 0) {
          stats.skipped++;
          continue;
        }
      }
      const { inserted } = await upsertWinningStores(env, n);
      if (inserted > 0) stats.succeeded++;
      else stats.skipped++;
    } catch (e) {
      stats.failed++;
      const msg = e instanceof Error ? e.message : String(e);
      await log(env, "backfill", n, n, false, `drw ${n}: ${msg}`);
    }
    // rate limit — dhlottery 부담 최소화
    await new Promise((r) => setTimeout(r, 400));
  }

  await log(
    env,
    "backfill",
    lo,
    hi,
    stats.failed === 0,
    `range ${lo}~${hi} processed=${stats.processed} ok=${stats.succeeded} skip=${stats.skipped} fail=${stats.failed} in ${Date.now() - started}ms`,
  );
  return stats;
}
