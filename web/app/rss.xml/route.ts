import { recentServices } from "@/lib/policy";
import { recentYouthPolicies } from "@/lib/youth";

// 정적 export에서 빌드 시 한 번만 생성
export const dynamic = "force-static";
export const revalidate = false;

const BASE = "https://ryanpp.com";

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rfc822(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length < 8) return new Date().toUTCString();
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return new Date(`${y}-${m}-${d}T00:00:00Z`).toUTCString();
}

export async function GET() {
  const services = recentServices(20).map((s) => ({
    title: s.service_name,
    link: `${BASE}/policy/${s.service_id}`,
    desc: s.summary,
    date: rfc822(s.first_registered),
    category: "정책·지원금",
  }));

  const youth = recentYouthPolicies(20).map((p) => ({
    title: p.name,
    link: `${BASE}/policy/youth/${p.plcy_no}`,
    desc: p.description,
    // frstRegDt 는 "2026-08-21 15:01:17" 형식
    date: p.first_reg
      ? new Date(p.first_reg.replace(" ", "T") + "Z").toUTCString()
      : new Date().toUTCString(),
    category: "청년정책",
  }));

  const items = [...services, ...youth]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 30);

  const buildDate = new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ryanpp — 최신 정책·지원금</title>
    <link>${BASE}</link>
    <description>공공데이터 기반 최신 정책·지원금 자동 정리</description>
    <language>ko</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml" />
${items
  .map(
    (it) => `    <item>
      <title>${esc(it.title)}</title>
      <link>${it.link}</link>
      <guid isPermaLink="true">${it.link}</guid>
      <description>${esc(it.desc)}</description>
      <category>${esc(it.category)}</category>
      <pubDate>${it.date}</pubDate>
    </item>`
  )
  .join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
