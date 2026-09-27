#!/usr/bin/env node
/**
 * OpenDART 실측 스크립트.
 * 목표:
 *   1) API key 유효성 확인
 *   2) 공시목록 응답 필드·페이지네이션 검증
 *   3) 단일 회사 재무 응답 검증 (삼성전자 corp_code=00126380)
 *   4) rate limit 감 잡기 (100 요청 × 시간 측정)
 *   5) corpCode.xml 다운로드 크기 확인
 *
 * 사용법: `npm run probe`  (package.json이 --env-file=.env로 실행)
 */

const KEY = process.env.OPENDART_KEY;
if (!KEY) {
  console.error("OPENDART_KEY 환경변수 없음. .env 확인.");
  process.exit(1);
}
const BASE = "https://opendart.fss.or.kr/api";
const UA = "dart-api/0.1 probe";

function url(path, params = {}) {
  const u = new URL(`${BASE}/${path}`);
  u.searchParams.set("crtfc_key", KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  }
  return u.toString();
}

async function jget(path, params) {
  const r = await fetch(url(path, params), {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  const txt = await r.text();
  try {
    return { http: r.status, body: JSON.parse(txt) };
  } catch {
    return { http: r.status, body: txt };
  }
}

function tsFmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log(" OpenDART Probe — 2026-09-26");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Key: ${KEY.slice(0, 6)}...${KEY.slice(-4)} (len=${KEY.length})\n`);

  // ─── 1) 오늘~7일 전 공시목록
  const end = tsFmt(new Date());
  const bgn = tsFmt(new Date(Date.now() - 7 * 86400_000));
  console.log(`[1] list.json  bgn_de=${bgn} end_de=${end}`);
  const list = await jget("list.json", { bgn_de: bgn, end_de: end, page_count: 100 });
  console.log(`    HTTP ${list.http}  status=${list.body?.status}  message=${list.body?.message}`);
  console.log(`    total_count=${list.body?.total_count} total_page=${list.body?.total_page} rows=${list.body?.list?.length}`);
  if (list.body?.list?.[0]) {
    console.log("    sample:", JSON.stringify(list.body.list[0]));
  }
  console.log();

  // ─── 2) 삼성전자 재무 (2024 사업보고서)
  const SAMSUNG = "00126380";
  console.log(`[2] fnlttSinglAcnt.json  corp=${SAMSUNG} (Samsung Electronics) 2024/11011`);
  const fin = await jget("fnlttSinglAcnt.json", {
    corp_code: SAMSUNG, bsns_year: 2024, reprt_code: "11011",
  });
  console.log(`    HTTP ${fin.http}  status=${fin.body?.status}  rows=${fin.body?.list?.length}`);
  if (fin.body?.list?.[0]) {
    const s = fin.body.list[0];
    console.log(`    sample account: ${s.account_nm} thstrm=${s.thstrm_amount}`);
  }
  console.log();

  // ─── 3) 전체 재무제표
  console.log(`[3] fnlttSinglAcntAll.json  corp=${SAMSUNG} 2024/11011 CFS`);
  const finAll = await jget("fnlttSinglAcntAll.json", {
    corp_code: SAMSUNG, bsns_year: 2024, reprt_code: "11011", fs_div: "CFS",
  });
  console.log(`    HTTP ${finAll.http}  status=${finAll.body?.status}  rows=${finAll.body?.list?.length}`);
  console.log();

  // ─── 4) corpCode.xml 크기
  console.log("[4] corpCode.xml (zip) 크기");
  const cc = await fetch(url("corpCode.xml"), { headers: { "User-Agent": UA } });
  const cl = cc.headers.get("content-length");
  const ct = cc.headers.get("content-type");
  console.log(`    HTTP ${cc.status}  content-length=${cl} bytes  content-type=${ct}`);
  console.log();

  // ─── 5) rate limit 감 잡기 (30 요청 병렬)
  console.log("[5] rate limit 감 (30 요청 병렬, list.json)");
  const t0 = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: 30 }, (_, i) =>
      jget("list.json", { bgn_de: end, end_de: end, page_no: i + 1, page_count: 10 })
    )
  );
  const ok = results.filter((r) => r.status === "fulfilled" && r.value.body?.status === "000").length;
  const rateLimit = results.filter(
    (r) => r.status === "fulfilled" && r.value.body?.status === "020"
  ).length;
  const other = results.length - ok - rateLimit;
  console.log(`    ${Date.now() - t0}ms  ok=${ok}  rate_limit=${rateLimit}  other=${other}`);
  console.log();

  console.log("═══════════════════════════════════════════════════");
  console.log(" 결과 요약");
  console.log("═══════════════════════════════════════════════════");
  console.log(`- Key 유효: ${list.body?.status === "000" ? "YES" : "NO"}`);
  console.log(`- 공시목록 갱신: ${bgn}~${end} 사이 ${list.body?.total_count}건`);
  console.log(`- 재무제표(주요/전체) 응답: ${fin.body?.status}/${finAll.body?.status}`);
  console.log(`- corpCode 크기: ${cl} bytes`);
  console.log(`- 30 요청 병렬 성공률: ${ok}/30`);
}

main().catch((e) => {
  console.error("probe fail:", e);
  process.exit(1);
});
