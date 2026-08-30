/**
 * Build client-side search index from welfare + youth data.
 * Output: web/public/search-index.json
 *
 * Runs as `prebuild` before `next build`. Purely additive — safe to fail if
 * data files missing (writes empty index in that case).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");
const DATA_ROOT = path.resolve(WEB_ROOT, "..", "data");
const OUT = path.join(WEB_ROOT, "public", "search-index.json");

function safeRead(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    console.warn(`[search-index] skip ${file}: ${err.message}`);
    return null;
  }
}

function buildIndex() {
  const welfareFile = safeRead(path.join(DATA_ROOT, "welfare", "list.json"));
  const youthFile = safeRead(path.join(DATA_ROOT, "youth", "list.json"));

  const welfare = (welfareFile?.data?.items ?? []).map((s) => ({
    i: s.service_id,
    n: s.service_name || "",
    s: (s.summary || "").slice(0, 100),
    d: s.department || "",
    t: (s.interest_topics ?? []).join(" "),
  }));

  const youth = (youthFile?.data?.items ?? []).map((p) => ({
    i: p.plcy_no,
    n: p.name || "",
    s: (p.description || "").slice(0, 100),
    d: p.department || "",
    k: p.keyword || "",
    c: p.major_category || "",
  }));

  return {
    generated_at: new Date().toISOString(),
    welfare,
    youth,
  };
}

const index = buildIndex();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(index));

const bytes = fs.statSync(OUT).size;
console.log(
  `[search-index] wrote ${OUT} (welfare=${index.welfare.length}, youth=${index.youth.length}, ${(bytes / 1024).toFixed(1)} KB)`,
);

// ----- Weather search index (regions) -----

const REGIONS_FILE = path.join(WEB_ROOT, "lib", "regions.json");
const WEATHER_OUT = path.join(WEB_ROOT, "public", "weather-index.json");

function buildWeatherIndex() {
  const regions = safeRead(REGIONS_FILE);
  if (!regions?.provinces) return { regions: [] };
  const items = [];
  for (const p of regions.provinces) {
    for (const m of p.municipalities ?? []) {
      items.push({
        s: p.slug,       // sido slug
        m: m.slug,       // municipality slug
        n: m.name,       // 시군구 이름
        p: p.name,       // 시도 이름
        la: m.lat,       // 위도 (내 위치 매칭용)
        lo: m.lon,       // 경도
      });
    }
  }
  return { regions: items };
}

const weatherIndex = buildWeatherIndex();
fs.writeFileSync(WEATHER_OUT, JSON.stringify(weatherIndex));
const wBytes = fs.statSync(WEATHER_OUT).size;
console.log(
  `[weather-index] wrote ${WEATHER_OUT} (regions=${weatherIndex.regions.length}, ${(wBytes / 1024).toFixed(1)} KB)`,
);

// ----- Trends search index (all 7 countries' hot keywords + youtube titles) -----

const TRENDS_DIR = path.join(DATA_ROOT, "trends");
const TRENDS_OUT = path.join(WEB_ROOT, "public", "trends-index.json");
const COUNTRY_META = [
  { code: "kr", name: "한국", flag: "🇰🇷" },
  { code: "us", name: "미국", flag: "🇺🇸" },
  { code: "jp", name: "일본", flag: "🇯🇵" },
  { code: "uk", name: "영국", flag: "🇬🇧" },
  { code: "tw", name: "대만", flag: "🇹🇼" },
  { code: "de", name: "독일", flag: "🇩🇪" },
  { code: "vn", name: "베트남", flag: "🇻🇳" },
];

function buildTrendsIndex() {
  const items = [];
  for (const c of COUNTRY_META) {
    const f = safeRead(path.join(TRENDS_DIR, `${c.code}.json`));
    if (!f?.data) continue;
    // Google Trends 급상승 키워드
    for (const t of f.data.google_trends ?? []) {
      items.push({
        c: c.code,       // country code
        cn: c.name,      // country name
        k: t.keyword,    // keyword
        r: t.rank,       // rank
        tr: t.traffic,   // traffic
        t: "trend",      // type
      });
    }
    // YouTube 인기 동영상 (title로 검색)
    for (const v of (f.data.youtube_popular ?? []).slice(0, 10)) {
      items.push({
        c: c.code,
        cn: c.name,
        k: v.title,
        r: v.rank,
        ch: v.channel,   // channel name
        vid: v.video_id, // for direct link
        t: "youtube",
      });
    }
  }
  return { items };
}

const trendsIndex = buildTrendsIndex();
fs.writeFileSync(TRENDS_OUT, JSON.stringify(trendsIndex));
const tBytes = fs.statSync(TRENDS_OUT).size;
console.log(
  `[trends-index] wrote ${TRENDS_OUT} (items=${trendsIndex.items.length}, ${(tBytes / 1024).toFixed(1)} KB)`,
);
