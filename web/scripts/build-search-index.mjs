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
