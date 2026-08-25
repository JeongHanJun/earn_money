import type { Metadata } from "next";
import Link from "next/link";
import { daumRanking, fetchedAt, formatRelative } from "@/lib/trends";

export const metadata: Metadata = {
  title: "Daum 인기 뉴스",
  description: "Daum 뉴스 실시간 많이 본 랭킹 Top 20.",
};

export default function DaumPage() {
  const items = daumRanking();
  const updated = fetchedAt();

  return (
    <div className="space-y-8">
      <Link
        href="/trends"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← 트렌드 대시보드
      </Link>

      <header className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 sm:p-8 text-white shadow-lg">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" aria-hidden />
          Daum 뉴스 · {formatRelative(updated)}
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          🌐 Daum 인기 뉴스
        </h1>
        <p className="mt-2 text-white/90 text-sm">
          지금 Daum에서 가장 많이 보는 기사 {items.length}개.
        </p>
      </header>

      <ol className="grid gap-2 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.rank}>
            <a
              href={it.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-blue-400 transition-all"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold">
                {it.rank}
              </span>
              <span className="text-sm text-zinc-900 leading-snug line-clamp-3 flex-1">
                {it.title}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
