#!/usr/bin/env node
/**
 * corpCode.xml (zip) 다운로드 → 파싱 → D1 upsert SQL 생성.
 *
 * 사용법:
 *   npm run bootstrap:corp           # 로컬 D1 (--local)
 *   npm run bootstrap:corp:remote    # 원격 D1
 *
 * 흐름:
 *   1) DART corpCode.xml zip 다운로드 (~3.6MB)
 *   2) 압축 해제 (Node built-in stream + fflate 없이 unzip 필요 → jsr:@zip-js 대신 시스템 unzip)
 *      Windows: PowerShell Expand-Archive 사용
 *   3) XML → JSON 파싱 (간단 regex, 10만 row)
 *   4) SQL 배치 (500 row/statement) → wrangler d1 execute
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const KEY = process.env.OPENDART_KEY;
if (!KEY) {
  console.error("OPENDART_KEY missing");
  process.exit(1);
}

const REMOTE = process.argv.includes("--remote");
const BATCH = 500;
const TMP = join(tmpdir(), "dart-corp-codes");

async function download() {
  console.log("[1/4] corpCode.xml 다운로드 중...");
  const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${KEY}`;
  const res = await fetch(url, { headers: { "User-Agent": "dart-api/0.1 bootstrap" } });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(TMP, { recursive: true });
  const zipPath = join(TMP, "corpCode.zip");
  writeFileSync(zipPath, buf);
  console.log(`   ${buf.length} bytes → ${zipPath}`);
  return zipPath;
}

function unzip(zipPath) {
  console.log("[2/4] unzip");
  // Windows PowerShell Expand-Archive (안전, dep 없음)
  const outDir = join(TMP, "extracted");
  mkdirSync(outDir, { recursive: true });
  try {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir}' -Force"`,
      { stdio: "pipe" }
    );
  } catch (e) {
    console.error("Expand-Archive 실패. tar/7z fallback 시도.");
    execSync(`tar -xf "${zipPath}" -C "${outDir}"`, { stdio: "inherit" });
  }
  const xmlPath = join(outDir, "CORPCODE.xml");
  if (!existsSync(xmlPath)) throw new Error(`CORPCODE.xml not found in ${outDir}`);
  console.log(`   → ${xmlPath}`);
  return xmlPath;
}

/**
 * XML 매우 단순한 구조라 regex로 파싱 (10만 row 성능 위해).
 * <list><corp_code>...</corp_code><corp_name>...</corp_name>...</list>
 */
function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function parse(xmlPath) {
  console.log("[3/4] parse XML");
  const xml = readFileSync(xmlPath, "utf-8");
  const rows = [];
  const re = /<list>([\s\S]*?)<\/list>/g;
  const tag = (block, name) => {
    const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)<\/${name}>`));
    return m ? decodeXmlEntities(m[1].trim()) : "";
  };
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const corp_code = tag(block, "corp_code");
    const corp_name = tag(block, "corp_name");
    const corp_eng_name = tag(block, "corp_eng_name");
    const stock_code = tag(block, "stock_code");
    const modify_date = tag(block, "modify_date");
    // stock_code로 market 추정 (정확한 매핑은 별도 KRX API 필요, 여기선 상장/비상장만)
    const market = stock_code && stock_code.length === 6 ? "LISTED" : "UNLISTED";
    rows.push({ corp_code, corp_name, corp_eng_name, stock_code, modify_date, market });
  }
  console.log(`   ${rows.length} rows parsed`);
  return rows;
}

function esc(s) {
  return (s || "").replace(/'/g, "''");
}

function buildSql(rows) {
  const stmts = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = chunk
      .map(
        (r) =>
          `('${esc(r.corp_code)}','${esc(r.corp_name)}',${
            r.corp_eng_name ? `'${esc(r.corp_eng_name)}'` : "NULL"
          },${r.stock_code ? `'${esc(r.stock_code)}'` : "NULL"},${
            r.modify_date ? `'${esc(r.modify_date)}'` : "NULL"
          },'${esc(r.market)}')`
      )
      .join(",\n");
    stmts.push(
      `INSERT INTO corp_codes (corp_code, corp_name, corp_name_eng, stock_code, modify_date, market) VALUES\n${values}\nON CONFLICT(corp_code) DO UPDATE SET corp_name=excluded.corp_name, corp_name_eng=excluded.corp_name_eng, stock_code=excluded.stock_code, modify_date=excluded.modify_date, market=excluded.market, updated_at=unixepoch();`
    );
  }
  return stmts;
}

async function apply(rows) {
  console.log(`[4/4] apply to D1 (${REMOTE ? "remote" : "local"})`);
  const stmts = buildSql(rows);
  const sqlPath = join(TMP, "corp_codes.sql");
  writeFileSync(sqlPath, stmts.join("\n\n"));
  console.log(`   ${stmts.length} batches → ${sqlPath}`);
  const flag = REMOTE ? "--remote" : "--local";
  try {
    execSync(`npx wrangler d1 execute dart-db ${flag} --file="${sqlPath}"`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });
    console.log("[OK] corp_codes 적재 완료");
  } catch (e) {
    console.error("D1 apply 실패. 수동 실행 필요:");
    console.error(`  npx wrangler d1 execute dart-db ${flag} --file="${sqlPath}"`);
    throw e;
  }
}

async function main() {
  const zip = await download();
  const xml = unzip(zip);
  const rows = parse(xml);
  await apply(rows);
  // 임시파일 정리 (SQL은 남겨 재적재 대비)
  try {
    unlinkSync(zip);
  } catch {}
}

main().catch((e) => {
  console.error("bootstrap fail:", e);
  process.exit(1);
});
