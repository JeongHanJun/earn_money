#!/usr/bin/env node
/**
 * 상장사(stock_code IS NOT NULL) × 최근 3년 × 사업보고서(11011) 재무 backfill.
 *
 * 흐름:
 *   1) D1에서 상장사 corp_code 목록 조회 (원격)
 *   2) fnlttSinglAcnt.json 호출 (20 병렬)
 *   3) 응답을 SQL INSERT 배치로 build (chunk당 100 회사)
 *   4) wrangler d1 execute --file 로 배치 적재
 *
 * 사용법:
 *   npm run bootstrap:corp:remote  # (선행) corp_codes 있어야 함
 *   node --env-file=.env scripts/backfill-financials.mjs [--year 2024] [--limit 100] [--dry-run]
 *
 * 옵션:
 *   --year YYYY   특정 연도만 (기본: 2022,2023,2024 전부)
 *   --limit N     처음 N개 회사만 (테스트용)
 *   --dry-run     SQL만 생성, D1 apply 안 함
 *   --local       로컬 D1 대상 (기본: --remote)
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const KEY = process.env.OPENDART_KEY;
if (!KEY) { console.error("OPENDART_KEY missing"); process.exit(1); }

const args = process.argv.slice(2);
const opt = {
  year: null,
  limit: null,
  dryRun: args.includes("--dry-run"),
  local: args.includes("--local"),
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--year") opt.year = Number(args[++i]);
  if (args[i] === "--limit") opt.limit = Number(args[++i]);
}
const REMOTE_FLAG = opt.local ? "--local" : "--remote";
const YEARS = opt.year ? [opt.year] : [2022, 2023, 2024];
const REPRT = "11011"; // 연간사업보고서만
const PARALLEL = 15;   // 병렬 API 호출 (rate limit 여유)
const CHUNK = 100;     // SQL 배치 회사 수 (파일당)
const TMP = join(tmpdir(), "dart-financials");

/** 상장사 corp_code 리스트 조회 (wrangler d1 execute --json) */
function listListed() {
  console.log("[1/4] 상장사 corp_code 조회 (D1)");
  // modify_date DESC = DART에서 최근 공시활동 있는 순 → 상장폐지·휴면 회사 뒤로 밀림
  const q = `SELECT corp_code, corp_name FROM corp_codes WHERE stock_code IS NOT NULL AND market='LISTED' ORDER BY modify_date DESC${opt.limit ? ` LIMIT ${opt.limit}` : ""}`;
  const out = execSync(
    `npx wrangler d1 execute dart-db ${REMOTE_FLAG} --command="${q}" --json`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
  );
  const parsed = JSON.parse(out);
  const rows = parsed[0]?.results ?? [];
  console.log(`   ${rows.length} listed companies (sorted by modify_date DESC)`);
  return rows;
}

function url(path, params) {
  const u = new URL(`https://opendart.fss.or.kr/api/${path}`);
  u.searchParams.set("crtfc_key", KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

async function fetchFin(corp_code, year) {
  const r = await fetchRetry(url("fnlttSinglAcnt.json", { corp_code, bsns_year: year, reprt_code: REPRT }), {
    headers: { "User-Agent": "dart-api/0.1 backfill", Accept: "application/json" },
  });
  if (!r.ok) return { status: `HTTP_${r.status}`, list: [] };
  return await r.json();
}

/** 함수 배열을 chunk 크기로 나눠 실행 (실제로 동시성 제한). */
async function chunkedRun(fns, size, onProgress) {
  const out = [];
  for (let i = 0; i < fns.length; i += size) {
    const chunk = fns.slice(i, i + size);
    const res = await Promise.allSettled(chunk.map((fn) => fn()));
    for (const r of res) out.push(r);
    if (onProgress) onProgress(Math.min(i + size, fns.length), fns.length);
    // 서버 부담 완화 (100ms) — DART 서버 TLS handshake 여유
    if (i + size < fns.length) await new Promise((r) => setTimeout(r, 100));
  }
  return out;
}

/** 소켓 재시도 fetch (TLS/ECONNRESET 방어) */
async function fetchRetry(url, opts, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetch(url, opts);
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
}

function esc(s) { return String(s || "").replace(/'/g, "''"); }

function toSql(rows) {
  if (rows.length === 0) return "";
  const values = rows.map((r) =>
    `('${esc(r.corp_code)}',${r.bsns_year},'${esc(r.reprt_code)}','CFS','${esc(r.sj_div)}','${esc(r.account_id)}','${esc(r.account_nm)}',${
      r.thstrm ?? "NULL"
    },${r.frmtrm ?? "NULL"},${r.bfefrmtrm ?? "NULL"},'${esc(r.currency || "KRW")}')`
  ).join(",\n");
  return `INSERT INTO financials
    (corp_code, bsns_year, reprt_code, fs_div, sj_div, account_id, account_nm, thstrm_amount, frmtrm_amount, bfefrmtrm_amount, currency)
    VALUES\n${values}
    ON CONFLICT(corp_code, bsns_year, reprt_code, fs_div, sj_div, account_id)
    DO UPDATE SET account_nm=excluded.account_nm, thstrm_amount=excluded.thstrm_amount,
    frmtrm_amount=excluded.frmtrm_amount, bfefrmtrm_amount=excluded.bfefrmtrm_amount, fetched_at=unixepoch();`;
}

function parseAmount(s) {
  if (!s || s === "" || s === "-") return null;
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function main() {
  mkdirSync(TMP, { recursive: true });
  const companies = listListed();
  console.log(`[2/4] fetch: ${companies.length} × ${YEARS.length} year(s) = ${companies.length * YEARS.length} calls`);

  const t0 = Date.now();
  let okCount = 0, emptyCount = 0, errCount = 0;
  const allRows = [];

  for (const year of YEARS) {
    const tasks = companies.map((c) => async () => {
      const res = await fetchFin(c.corp_code, year);
      if (res.status === "000" && Array.isArray(res.list)) {
        okCount++;
        for (const it of res.list) {
          allRows.push({
            corp_code: c.corp_code,
            bsns_year: year,
            reprt_code: REPRT,
            sj_div: it.sj_div,
            account_id: it.account_id,
            account_nm: it.account_nm,
            thstrm: parseAmount(it.thstrm_amount),
            frmtrm: parseAmount(it.frmtrm_amount),
            bfefrmtrm: parseAmount(it.bfefrmtrm_amount),
            currency: it.currency,
          });
        }
      } else if (res.status === "013") {
        emptyCount++;
      } else {
        errCount++;
      }
    });
    await chunkedRun(tasks, PARALLEL, (done, total) => {
      if (done % 300 === 0 || done === total) {
        const dur = ((Date.now() - t0) / 1000).toFixed(1);
        process.stdout.write(`   ${year}: ${done}/${total} ok=${okCount} empty=${emptyCount} err=${errCount} rows=${allRows.length} ${dur}s\r`);
      }
    });
    console.log();
  }

  console.log(`[3/4] build SQL (${allRows.length} rows, chunk=${CHUNK * 30})`);
  // 회사당 ~30 row 가정, CHUNK 회사 단위로 파일 나눔
  const ROWS_PER_FILE = CHUNK * 40;
  const files = [];
  for (let i = 0; i < allRows.length; i += ROWS_PER_FILE) {
    const chunk = allRows.slice(i, i + ROWS_PER_FILE);
    const sql = toSql(chunk);
    const path = join(TMP, `financials_${String(files.length).padStart(3, "0")}.sql`);
    writeFileSync(path, sql);
    files.push(path);
  }
  console.log(`   ${files.length} SQL files in ${TMP}`);

  if (opt.dryRun) {
    console.log("[dry-run] apply 생략. 파일:", files);
    return;
  }

  console.log(`[4/4] apply to D1 (${REMOTE_FLAG})`);
  let applied = 0;
  for (const f of files) {
    try {
      execSync(`npx wrangler d1 execute dart-db ${REMOTE_FLAG} --file="${f}"`, {
        stdio: ["pipe", "pipe", "inherit"],
      });
      applied++;
      process.stdout.write(`   applied ${applied}/${files.length}\r`);
    } catch (e) {
      console.error(`\n   FAIL ${f}: ${e.message}`);
    }
  }
  console.log(`\n[OK] backfill 완료: ${okCount} companies, ${allRows.length} rows, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => { console.error(e); process.exit(1); });
