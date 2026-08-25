import type { Metadata } from "next";
import {
  allCategories,
  fetchedAt,
  formatRelative,
  hackerNewsItems,
  type TrendItem,
} from "@/lib/trends";

export const metadata: Metadata = {
  title: "실시간 트렌드",
  description:
    "Google News (국내·세계·경제·IT·연예·스포츠·건강) + HackerNews 실시간 집계.",
};

export default function TrendsPage() {
  const categories = allCategories();
  const hn = hackerNewsItems();
  const updated = fetchedAt();

  return (
    <div className="space-y-8">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          <span
            className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"
            aria-hidden
          />
          매시간 갱신 · 최종 {formatRelative(updated)}
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          실시간 트렌드
        </h1>
        <p className="mt-2 text-zinc-600 leading-7">
          Google News 카테고리별 최신 뉴스 + HackerNews 글로벌 IT 화제
        </p>
      </header>

      {categories.map((c) =>
        c.items.length > 0 ? (
          <CategorySection key={c.slug} name={c.name} items={c.items.slice(0, 8)} />
        ) : null
      )}

      {hn.length > 0 && (
        <CategorySection name="글로벌 IT (HackerNews)" items={hn.slice(0, 10)} />
      )}

      <p className="text-xs text-zinc-500 text-center">
        출처: Google News · HackerNews · 링크 클릭 시 원문 이동
      </p>
    </div>
  );
}

function CategorySection({
  name,
  items,
}: {
  name: string;
  items: TrendItem[];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight mb-3">{name}</h2>
      <div className="grid gap-2">
        {items.map((it, i) => (
          <a
            key={i}
            href={it.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-amber-400 hover:bg-amber-50/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-900 leading-snug line-clamp-2">
                  {it.title}
                </div>
                {it.description && (
                  <div className="mt-1 text-xs text-zinc-500 line-clamp-1">
                    {it.description}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right text-xs text-zinc-500">
                {it.publisher && <div className="font-medium">{it.publisher}</div>}
                <div>{formatRelative(it.pub_date)}</div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
