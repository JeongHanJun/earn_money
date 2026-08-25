import type { Metadata } from "next";
import Link from "next/link";
import { fetchedAt, formatRelative, hackerNewsItems } from "@/lib/trends";

export const metadata: Metadata = {
  title: "HackerNews Top Stories",
  description: "실리콘밸리 개발자·창업가 커뮤니티 HackerNews Top 15.",
};

export default function HackerNewsPage() {
  const items = hackerNewsItems();
  const updated = fetchedAt();

  return (
    <div className="space-y-8">
      <Link
        href="/trends"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← 트렌드 대시보드
      </Link>

      <header className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 p-6 sm:p-8 text-white shadow-lg">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" aria-hidden />
          HackerNews · {formatRelative(updated)}
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          💻 HackerNews Top Stories
        </h1>
        <p className="mt-2 text-white/90 text-sm">
          실리콘밸리 개발자·창업가·연구자 커뮤니티가 지금 주목하는 글로벌 IT 이슈 {items.length}개.
        </p>
      </header>

      <ol className="space-y-2">
        {items.map((it, i) => (
          <li key={i}>
            <a
              href={it.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-orange-400 transition-all"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-white text-sm font-bold">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-900 leading-snug line-clamp-2">
                  {it.title}
                </div>
                <div className="mt-1 text-xs text-zinc-500">{it.description}</div>
              </div>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
