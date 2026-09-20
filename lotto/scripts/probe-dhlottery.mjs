#!/usr/bin/env node
// dhlottery 실측 스크립트 — Q1/Q2 (Q3는 Worker 배포 후 별도)
//
// 실행: node scripts/probe-dhlottery.mjs
//
// 목적:
//   Q1. common.do?method=getLottoNumber&drwNo=N 이 로컬(한국 IP)에서 정상 동작?
//   Q2. store.do?method=topStore&pageGubun=L645&drwNo=N 이 회차 1까지 데이터 있는지?
//   Q3. Cloudflare Workers edge에서 302 뜨는지 — 이건 배포 후 /api/probe 엔드포인트로 확인

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function seedSession() {
  const res = await fetch("https://www.dhlottery.co.kr/", {
    headers: { "User-Agent": UA },
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const jsessionid = setCookie.match(/DHJSESSIONID=[^;]+/)?.[0];
  const wmonid = setCookie.match(/WMONID=[^;]+/)?.[0];
  return [jsessionid, wmonid].filter(Boolean).join("; ");
}

async function fetchLottoNumber(drwNo, cookie, variant = "default") {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`;
  const headers = {
    "User-Agent": UA,
    Accept: "application/json,text/plain,*/*",
  };
  if (variant === "ajax") {
    headers["X-Requested-With"] = "XMLHttpRequest";
    headers["Referer"] = "https://www.dhlottery.co.kr/gameResult.do?method=byWin";
    headers["Origin"] = "https://www.dhlottery.co.kr";
  } else if (variant === "nosession") {
    // no referer, no cookie
  } else {
    headers["Referer"] = "https://www.dhlottery.co.kr/gameResult.do?method=byWin";
  }
  if (cookie && variant !== "nosession") headers["Cookie"] = cookie;

  const res = await fetch(url, { headers, redirect: "follow" });
  const body = await res.text();
  const isJson = body.trim().startsWith("{");
  let parsed = null;
  if (isJson) {
    try {
      parsed = JSON.parse(body);
    } catch {}
  }
  return {
    variant,
    status: res.status,
    finalUrl: res.url,
    isJson,
    parsed,
    bodyLen: body.length,
    bodySnippet: body.slice(0, 200).replace(/\s+/g, " "),
  };
}

async function fetchTopStore(drwNo, cookie) {
  const url = `https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645&drwNo=${drwNo}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,*/*",
      Referer: "https://www.dhlottery.co.kr/",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    redirect: "follow",
  });
  const body = await res.text();
  const hasTable = /<tbody|<td[^>]*>[가-힣]/.test(body);
  const noResult = /검색\s*결과|해당.*없|정보.*없|자료.*없/.test(body);
  return {
    status: res.status,
    finalUrl: res.url,
    contentLength: body.length,
    hasTable,
    noResult,
    bodySnippet: body.slice(0, 500).replace(/\s+/g, " "),
  };
}

function log(label, obj) {
  console.log(`\n▶ ${label}`);
  console.log(JSON.stringify(obj, null, 2));
}

async function main() {
  console.log("== dhlottery probe (Q1/Q2) ==");

  const cookie = await seedSession();
  console.log(`[seed] cookie: ${cookie || "(none)"}`);

  // Q1: 3가지 헤더 변형으로 각각 시도
  log("Q1a-default drwNo=1150", await fetchLottoNumber(1150, cookie, "default"));
  log("Q1a-ajax drwNo=1150", await fetchLottoNumber(1150, cookie, "ajax"));
  log("Q1a-nosession drwNo=1150", await fetchLottoNumber(1150, null, "nosession"));
  log("Q1b drwNo=1", await fetchLottoNumber(1, cookie, "ajax"));
  log("Q1c drwNo=9999", await fetchLottoNumber(9999, cookie, "ajax"));

  // Q2: 배출점 정보 — 초기 회차와 최근 회차
  log("Q2a store.do drwNo=1150", await fetchTopStore(1150, cookie));
  log("Q2b store.do drwNo=1", await fetchTopStore(1, cookie));

  console.log(
    "\n== 판정 가이드 ==\n" +
      "Q1: 200 + JSON with returnValue:success → OK\n" +
      "Q1: 302 → 세션/UA 이슈 (retry with seedSession)\n" +
      "Q1: fail → drwNo 조정 필요\n" +
      "Q2: 200 + HTML에 <tbody>·상호명 포함 → OK\n" +
      "Q2 drwNo=1: 데이터 없으면 '검색 결과 없음' 문구 → 초기 회차 배출점 없음 확정\n" +
      "\nQ3 (Workers edge 302 재현)는 배포 후 /api/probe 로 확인.",
  );
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
