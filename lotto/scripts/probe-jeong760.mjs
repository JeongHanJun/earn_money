#!/usr/bin/env node
// jeong760/lotto-data 미러가 정상 동작하는지 실측 + 스키마 파악

const CANDIDATES = [
  "https://raw.githubusercontent.com/jeong760/lotto-data/main/data/lotto-history.json",
  "https://raw.githubusercontent.com/jeong760/lotto-data/master/data/lotto-history.json",
  "https://raw.githubusercontent.com/jeong760/lotto-data/main/lotto-history.json",
  "https://api.github.com/repos/jeong760/lotto-data/contents/data",
];

async function main() {
  for (const url of CANDIDATES) {
    console.log(`\n▶ ${url}`);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "lotto-probe/0.1" },
      });
      console.log(`  status: ${res.status}`);
      const ct = res.headers.get("content-type") ?? "";
      console.log(`  content-type: ${ct}`);
      if (res.ok) {
        const body = await res.text();
        console.log(`  body length: ${body.length.toLocaleString()}`);
        try {
          const data = JSON.parse(body);
          if (Array.isArray(data)) {
            console.log(`  rows: ${data.length} (array)`);
            console.log(`  first row keys: ${Object.keys(data[0] ?? {}).join(",")}`);
            console.log(`  first row: ${JSON.stringify(data[0], null, 2)}`);
            console.log(`  last row drwNo: ${data[data.length - 1]?.drawNo ?? data[data.length - 1]?.drw_no ?? "?"}`);
          } else if (Array.isArray(data.rows)) {
            console.log(`  rows: ${data.rows.length}`);
            console.log(`  first row keys: ${Object.keys(data.rows[0] ?? {}).join(",")}`);
          } else {
            console.log(`  top-level keys: ${Object.keys(data).slice(0, 10).join(",")}`);
            console.log(`  sample: ${JSON.stringify(data).slice(0, 400)}`);
          }
        } catch {
          console.log(`  body snippet: ${body.slice(0, 400)}`);
        }
        return;
      } else {
        console.log(`  body: ${(await res.text()).slice(0, 200)}`);
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }
  console.log("\n[all candidates failed] jeong760 저장소 URL 재확인 필요");
}

main();
