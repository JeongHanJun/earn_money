#!/usr/bin/env node
/**
 * financials 테이블에서 재무 pull → Altman Z + Piotroski F 계산 → distress_scores upsert.
 *
 * 사용법:
 *   node --env-file=.env scripts/compute-distress.mjs [--year 2024] [--limit 100]
 *
 * 로직:
 *   1) D1: financials에서 상장사 × 사업연도(11011) 재무 조회 (2년치: 당기 + 전기)
 *   2) 회사별로 필요 계정 aggregation (BS·IS·CF)
 *   3) Altman Z-Score (EM 판) + Piotroski F-Score 계산
 *   4) 최근 90일 risk_events 카운트 (별도 쿼리)
 *   5) composite risk 계산
 *   6) distress_scores INSERT
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = { year: 2024, limit: null, local: args.includes("--local") };
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--year") opt.year = Number(args[++i]);
  if (args[i] === "--limit") opt.limit = Number(args[++i]);
}
const FLAG = opt.local ? "--local" : "--remote";
const TMP = join(tmpdir(), "dart-distress");
mkdirSync(TMP, { recursive: true });

/** D1 쿼리 헬퍼 (--json) */
function q(sql) {
  const out = execSync(
    `npx wrangler d1 execute dart-db ${FLAG} --command=${JSON.stringify(sql)} --json`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
  );
  return JSON.parse(out)[0]?.results ?? [];
}

/** 계정명 → 표준 필드 매핑 (한글) */
const ACCT = {
  current_assets: ["유동자산"],
  total_assets: ["자산총계"],
  current_liabilities: ["유동부채"],
  total_liabilities: ["부채총계"],
  retained_earnings: ["이익잉여금", "이익잉여금(결손금)"],
  total_equity: ["자본총계"],
  revenue: ["매출액", "수익(매출액)", "영업수익"],
  operating_income: ["영업이익", "영업이익(손실)"],
  net_income: ["당기순이익", "당기순이익(손실)"],
  operating_cash_flow: ["영업활동현금흐름", "영업활동으로인한현금흐름"],
};

function pickAmount(rows, keys, key) {
  const nameSet = new Set(ACCT[keys]);
  const hit = rows.find((r) => nameSet.has(r.account_nm));
  if (!hit) return null;
  const v = hit[key];
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Altman Z-Score (Emerging Market): 3.25 + 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4 */
function altmanZ(f) {
  if (!f.total_assets || f.total_assets <= 0) return { z: null, grade: "N/A" };
  const x1 = f.current_assets !== null && f.current_liabilities !== null
    ? (f.current_assets - f.current_liabilities) / f.total_assets : null;
  const x2 = f.retained_earnings !== null ? f.retained_earnings / f.total_assets : null;
  const x3 = f.operating_income !== null ? f.operating_income / f.total_assets : null;
  const x4 = f.total_equity !== null && f.total_liabilities && f.total_liabilities > 0
    ? f.total_equity / f.total_liabilities : null;
  if (x1 === null || x2 === null || x3 === null || x4 === null) return { z: null, grade: "N/A" };
  const z = 3.25 + 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4;
  const grade = z > 2.60 ? "SAFE" : z > 1.10 ? "GREY" : "DISTRESS";
  return { z, grade };
}

/** Piotroski F-Score (0~9): 9 시그널 이진 합 */
function piotroski(f, fPrior) {
  let s = 0, usable = 0;
  const check = (v) => { if (v !== null) { usable++; if (v) s++; } };

  // 1) ROA > 0
  check(f.net_income !== null ? f.net_income > 0 : null);
  // 2) CFO > 0
  check(f.operating_cash_flow !== null ? f.operating_cash_flow > 0 : null);
  // 3) ΔROA > 0
  const roa = f.net_income !== null && f.total_assets ? f.net_income / f.total_assets : null;
  const roaP = fPrior && fPrior.net_income !== null && fPrior.total_assets
    ? fPrior.net_income / fPrior.total_assets : null;
  check(roa !== null && roaP !== null ? roa > roaP : null);
  // 4) CFO > NI
  check(f.operating_cash_flow !== null && f.net_income !== null
    ? f.operating_cash_flow > f.net_income : null);
  // 5) leverage 감소
  const dta = f.total_liabilities !== null && f.total_assets
    ? f.total_liabilities / f.total_assets : null;
  const dtaP = fPrior && fPrior.total_liabilities !== null && fPrior.total_assets
    ? fPrior.total_liabilities / fPrior.total_assets : null;
  check(dta !== null && dtaP !== null ? dta <= dtaP : null);
  // 6) current ratio 개선
  const cr = f.current_assets !== null && f.current_liabilities && f.current_liabilities > 0
    ? f.current_assets / f.current_liabilities : null;
  const crP = fPrior && fPrior.current_assets !== null && fPrior.current_liabilities && fPrior.current_liabilities > 0
    ? fPrior.current_assets / fPrior.current_liabilities : null;
  check(cr !== null && crP !== null ? cr > crP : null);
  // 7) no dilution — 발행주식수 데이터 없음 → skip (null)
  check(null);
  // 8) operating margin 개선
  const om = f.operating_income !== null && f.revenue && f.revenue > 0
    ? f.operating_income / f.revenue : null;
  const omP = fPrior && fPrior.operating_income !== null && fPrior.revenue && fPrior.revenue > 0
    ? fPrior.operating_income / fPrior.revenue : null;
  check(om !== null && omP !== null ? om > omP : null);
  // 9) asset turnover 개선
  const at = f.revenue !== null && f.total_assets ? f.revenue / f.total_assets : null;
  const atP = fPrior && fPrior.revenue !== null && fPrior.total_assets
    ? fPrior.revenue / fPrior.total_assets : null;
  check(at !== null && atP !== null ? at > atP : null);

  if (usable < 4) return { score: null, grade: "N/A" };
  const grade = s >= 7 ? "STRONG" : s >= 4 ? "MID" : "WEAK";
  return { score: s, grade };
}

function composite(altman, pio, eventSevSum) {
  let s = 0;
  s += altman.grade === "SAFE" ? 0 : altman.grade === "GREY" ? 30 : altman.grade === "DISTRESS" ? 70 : 15;
  s += pio.grade === "STRONG" ? 0 : pio.grade === "MID" ? 10 : pio.grade === "WEAK" ? 20 : 10;
  s += Math.min(30, eventSevSum);
  const grade = s < 25 ? "LOW" : s < 50 ? "MEDIUM" : s < 75 ? "HIGH" : "CRITICAL";
  return { score: s, grade };
}

function extract(rows, key) {
  return {
    current_assets: pickAmount(rows, "current_assets", key),
    total_assets: pickAmount(rows, "total_assets", key),
    current_liabilities: pickAmount(rows, "current_liabilities", key),
    total_liabilities: pickAmount(rows, "total_liabilities", key),
    retained_earnings: pickAmount(rows, "retained_earnings", key),
    total_equity: pickAmount(rows, "total_equity", key),
    revenue: pickAmount(rows, "revenue", key),
    operating_income: pickAmount(rows, "operating_income", key),
    net_income: pickAmount(rows, "net_income", key),
    operating_cash_flow: pickAmount(rows, "operating_cash_flow", key),
  };
}

function esc(s) { return String(s || "").replace(/'/g, "''"); }

async function main() {
  console.log("[1/4] 상장사 corp_code 조회");
  const companies = q(
    `SELECT DISTINCT corp_code FROM financials WHERE bsns_year = ${opt.year} AND reprt_code = '11011'${opt.limit ? ` LIMIT ${opt.limit}` : ""}`
  );
  console.log(`   ${companies.length} companies with ${opt.year} annual`);

  console.log("[2/4] 재무 pull + score 계산");
  const scores = [];
  let bad = 0;
  let batch = 0;
  const BATCH_Q = 100;
  const t0 = Date.now();

  for (let i = 0; i < companies.length; i += BATCH_Q) {
    const chunk = companies.slice(i, i + BATCH_Q);
    const codes = chunk.map((c) => `'${c.corp_code}'`).join(",");
    // 당기(opt.year) + 전기 재무를 한 번에
    const rows = q(
      `SELECT corp_code, bsns_year, sj_div, account_nm, thstrm_amount, frmtrm_amount
       FROM financials
       WHERE corp_code IN (${codes}) AND bsns_year = ${opt.year} AND reprt_code = '11011' AND fs_div = 'CFS'`
    );
    // 회사별 그룹
    const byCorp = new Map();
    for (const r of rows) {
      if (!byCorp.has(r.corp_code)) byCorp.set(r.corp_code, []);
      byCorp.get(r.corp_code).push(r);
    }
    // 계산: current=thstrm_amount, prior=frmtrm_amount
    for (const [corp_code, rs] of byCorp) {
      const cur = extract(rs, "thstrm_amount");
      const pri = extract(rs, "frmtrm_amount");
      const a = altmanZ(cur);
      const p = piotroski(cur, pri);
      const c = composite(a, p, 0); // 이벤트는 별도 update
      if (a.z === null && p.score === null) { bad++; continue; }
      scores.push({
        corp_code, bsns_year: opt.year, reprt_code: "11011",
        altman_z_em: a.z, altman_grade: a.grade,
        piotroski_f: p.score, piotroski_grade: p.grade,
        risk_events_90d: 0,
        composite_risk: c.score, composite_grade: c.grade,
      });
    }
    batch++;
    if (batch % 5 === 0) {
      process.stdout.write(`   ${i + BATCH_Q}/${companies.length} scores=${scores.length} bad=${bad} ${((Date.now() - t0) / 1000).toFixed(0)}s\r`);
    }
  }
  console.log(`\n   ${scores.length} scores computed (bad=${bad})`);

  console.log("[3/4] SQL 파일 생성");
  const chunkSize = 500;
  const files = [];
  for (let i = 0; i < scores.length; i += chunkSize) {
    const chunk = scores.slice(i, i + chunkSize);
    const values = chunk.map((s) =>
      `('${s.corp_code}',${s.bsns_year},'${s.reprt_code}',${s.altman_z_em ?? "NULL"},'${esc(s.altman_grade)}',${s.piotroski_f ?? "NULL"},'${esc(s.piotroski_grade)}',${s.risk_events_90d},${s.composite_risk ?? "NULL"},'${esc(s.composite_grade)}')`
    ).join(",\n");
    const sql = `INSERT INTO distress_scores
      (corp_code, bsns_year, reprt_code, altman_z_em, altman_grade, piotroski_f, piotroski_grade, risk_events_90d, composite_risk, composite_grade)
      VALUES\n${values}
      ON CONFLICT(corp_code, bsns_year, reprt_code) DO UPDATE SET
        altman_z_em=excluded.altman_z_em, altman_grade=excluded.altman_grade,
        piotroski_f=excluded.piotroski_f, piotroski_grade=excluded.piotroski_grade,
        risk_events_90d=excluded.risk_events_90d,
        composite_risk=excluded.composite_risk, composite_grade=excluded.composite_grade,
        computed_at=unixepoch();`;
    const path = join(TMP, `distress_${String(files.length).padStart(3, "0")}.sql`);
    writeFileSync(path, sql);
    files.push(path);
  }
  console.log(`   ${files.length} SQL files`);

  console.log(`[4/4] apply to D1 (${FLAG})`);
  for (const f of files) {
    execSync(`npx wrangler d1 execute dart-db ${FLAG} --file="${f}"`, {
      stdio: ["pipe", "pipe", "inherit"],
    });
  }
  console.log(`[OK] ${scores.length} distress scores upserted`);
}

main().catch((e) => { console.error(e); process.exit(1); });
