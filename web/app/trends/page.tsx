import type { Metadata } from "next";
import Link from "next/link";
import { COUNTRIES, COUNTRY_SOURCES, SOURCE_LABELS } from "@/lib/trends";

function countryGradient(code: string): string {
  const map: Record<string, string> = {
    kr: "from-red-500 via-rose-500 to-indigo-600",
    us: "from-blue-600 via-indigo-600 to-red-600",
    jp: "from-red-500 via-pink-500 to-rose-600",
    uk: "from-blue-700 via-red-600 to-blue-700",
    tw: "from-red-600 via-rose-500 to-blue-600",
    de: "from-zinc-900 via-red-600 to-amber-500",
    vn: "from-red-600 via-red-500 to-amber-400",
  };
  return map[code] ?? "from-indigo-600 to-indigo-800";
}

export const metadata: Metadata = {
  title: "실시간 트렌드 · 국가별",
  description:
    "한국·미국·일본·영국·대만·독일·베트남 7개국 실시간 트렌드. Google Trends, YouTube, Google News + 국가별 대표 매체.",
};

export default function TrendsPage() {
  return (
    <div className="space-y-8">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          <span
            className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"
            aria-hidden
          />
          매시간 갱신 · 7개국
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          실시간 트렌드
        </h1>
        <p className="mt-2 text-zinc-600 leading-7">
          국가를 선택해 그 나라의 급상승 검색어, 인기 동영상, 뉴스 랭킹을
          확인해보세요.
        </p>
      </header>

      <section aria-labelledby="pick">
        <h2 id="pick" className="sr-only">
          국가 선택
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COUNTRIES.map((c) => {
            const sources = COUNTRY_SOURCES[c.code] ?? [];
            const isDefault = c.code === "kr";
            const gradient = countryGradient(c.code);
            return (
              <Link
                key={c.code}
                href={`/trends/${c.code}`}
                className={
                  "group relative block overflow-hidden rounded-2xl border bg-white shadow-sm hover:shadow-lg transition-all " +
                  (isDefault
                    ? "border-indigo-400 ring-2 ring-indigo-100"
                    : "border-zinc-200 hover:border-zinc-300")
                }
              >
                <div className={`bg-gradient-to-br ${gradient} p-5 text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="text-4xl leading-none drop-shadow-sm"
                        aria-hidden
                      >
                        {c.flag}
                      </span>
                      <div>
                        <div className="text-xl font-black tracking-tight">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-white/85 font-medium">
                          {c.language}
                        </div>
                      </div>
                    </div>
                    {isDefault && (
                      <span className="shrink-0 rounded-full bg-white/25 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white">
                        기본
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-1.5">
                    {sources.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700"
                      >
                        {SOURCE_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-indigo-600 group-hover:underline">
                    트렌드 보기 →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 leading-6">
        <div className="font-semibold text-zinc-900">데이터 소스</div>
        <p className="mt-1">
          Google Trends (RSS), YouTube Data API v3, Google News (RSS),
          각국 주요 매체 공식 RSS/HTML. 매 시간 자동 갱신. 원문 링크는
          각 항목 클릭 시 새 탭에서 열립니다.
        </p>
      </section>
    </div>
  );
}
