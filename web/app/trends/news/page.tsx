import type { Metadata } from "next";
import Link from "next/link";
import { allCategories, fetchedAt, formatRelative, type TrendItem } from "@/lib/trends";

export const metadata: Metadata = {
  title: "Google News 카테고리별",
  description: "Google News (한국) 8개 카테고리별 최신 헤드라인.",
};

export default function GoogleNewsPage() {
  const categories = allCategories().filter((c) => c.items.length > 0);
  const updated = fetchedAt();

  return (
    <div className="space-y-8">
      <Link
        href="/trends"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← 트렌드 대시보드
      </Link>

      <header className="rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-6 sm:p-8 text-white shadow-lg">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" aria-hidden />
          Google News · KR · {formatRelative(updated)}
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          📰 Google News 카테고리별
        </h1>
        <p className="mt-2 text-white/90 text-sm">
          {categories.length}개 카테고리 · 매 시간 헤드라인 갱신.
        </p>
      </header>

      <nav className="sticky top-14 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-white/85 backdrop-blur border-b border-zinc-200">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {categories.map((c) => (
            <a
              key={c.slug}
              href={`#${c.slug}`}
              className="shrink-0 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-blue-400 hover:text-blue-700"
            >
              {c.name} <span className="text-zinc-400">{c.items.length}</span>
            </a>
          ))}
        </div>
      </nav>

      <div className="space-y-10">
        {categories.map((c) => (
          <section key={c.slug} id={c.slug} className="scroll-mt-28">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 mb-3">
              {c.name}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {c.items.map((it, i) => (
                <NewsCard key={i} item={it} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function NewsCard({ item }: { item: TrendItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
    >
      <div className="font-medium text-zinc-900 leading-snug line-clamp-2 text-sm">
        {item.title}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
        <span className="truncate">{item.publisher || "Google News"}</span>
      </div>
    </a>
  );
}
