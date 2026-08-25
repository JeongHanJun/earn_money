import type { Metadata } from "next";
import Link from "next/link";
import { fetchedAt, formatRelative, googleTrends } from "@/lib/trends";

export const metadata: Metadata = {
  title: "실시간 급상승 검색어",
  description: "Google Trends 대한민국 실시간 인기 검색어 Top 20 · 관련 뉴스 포함.",
};

export default function GoogleTrendsPage() {
  const trends = googleTrends();
  const updated = fetchedAt();

  return (
    <div className="space-y-8">
      <BackToTrends />
      <header className="rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 p-6 sm:p-8 text-white shadow-lg">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" aria-hidden />
          Google Trends · KR · {formatRelative(updated)}
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          🔥 실시간 급상승 검색어
        </h1>
        <p className="mt-2 text-white/90 text-sm">
          지금 대한민국 사용자들이 가장 많이 검색하는 키워드 {trends.length}개.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {trends.map((t) => (
          <article
            key={t.rank}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white text-xl font-black">
                {t.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-zinc-900">{t.keyword}</h2>
                  {t.traffic && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                      ↑ {t.traffic} 검색
                    </span>
                  )}
                </div>
                {t.articles.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {t.articles.map((a, i) => (
                      <li key={i}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-start gap-2 text-sm text-zinc-700 hover:text-rose-700"
                        >
                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-zinc-400 group-hover:bg-rose-500" />
                          <span className="flex-1 line-clamp-2 leading-snug">
                            {a.title}
                            <span className="ml-1.5 text-xs text-zinc-400">
                              {a.source}
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function BackToTrends() {
  return (
    <Link
      href="/trends"
      className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
    >
      ← 트렌드 대시보드
    </Link>
  );
}
