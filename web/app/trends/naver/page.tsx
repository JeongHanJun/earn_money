import type { Metadata } from "next";
import Link from "next/link";
import { fetchedAt, formatRelative, naverRanking } from "@/lib/trends";

export const metadata: Metadata = {
  title: "Naver 언론사별 인기 뉴스",
  description: "Naver 뉴스 언론사별 많이 본 랭킹 · 종합 언론 7개 사 Top 5.",
};

export default function NaverPage() {
  const groups = naverRanking();
  const updated = fetchedAt();

  return (
    <div className="space-y-8">
      <Link
        href="/trends"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← 트렌드 대시보드
      </Link>

      <header className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 sm:p-8 text-white shadow-lg">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" aria-hidden />
          Naver 뉴스 · {formatRelative(updated)}
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          📰 Naver 언론사별 많이 본 뉴스
        </h1>
        <p className="mt-2 text-white/90 text-sm">
          {groups.length}개 종합 언론사의 24시간 랭킹.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <section
            key={g.press}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <h2 className="font-bold text-zinc-900">{g.press}</h2>
              <span className="text-xs text-zinc-400 ml-auto">
                Top {g.items.length}
              </span>
            </div>
            <ol className="space-y-2">
              {g.items.map((it) => (
                <li key={it.rank}>
                  <a
                    href={it.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 text-sm text-zinc-800 hover:text-emerald-700"
                  >
                    <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded bg-emerald-50 text-emerald-700 text-xs font-bold group-hover:bg-emerald-100">
                      {it.rank}
                    </span>
                    <span className="line-clamp-2 leading-snug flex-1">
                      {it.title}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
