import Link from "next/link";
import type {
  Article,
  GoogleNewsItem,
  GoogleTrend,
  PressGroup,
  YouTubeVideo,
} from "@/lib/trends";
import { CATEGORY_META, formatCount } from "@/lib/trends";

// ============ Google Trends ============

export function GoogleTrendsView({
  trends,
  compact = false,
}: {
  trends: GoogleTrend[];
  compact?: boolean;
}) {
  if (trends.length === 0) {
    return <div className="text-sm text-zinc-500">데이터 없음</div>;
  }
  if (compact) {
    // 상위 10개 - 순위 뱃지 + 키워드 + 트래픽 + 첫 기사
    const items = trends.slice(0, 10);
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((t) => {
          const primary = t.articles[0];
          const rankColor =
            t.rank <= 3 ? "from-rose-500 to-orange-500" : "from-rose-400 to-rose-500";
          return (
            <div
              key={t.rank}
              className="group flex items-start gap-3 rounded-xl border border-rose-200 bg-white p-3 hover:border-rose-400 hover:shadow-sm transition-all"
            >
              <span
                className={`shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br ${rankColor} text-white text-sm font-black shadow-sm`}
              >
                {t.rank}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-zinc-900 truncate">
                    {t.keyword}
                  </span>
                  {t.traffic && (
                    <span className="ml-auto shrink-0 text-[11px] font-bold text-rose-600">
                      {t.traffic}
                    </span>
                  )}
                </div>
                {primary && (
                  <a
                    href={primary.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-[12px] text-zinc-600 line-clamp-1 leading-snug hover:text-rose-700 hover:underline"
                  >
                    {primary.title}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <ol className="space-y-3">
      {trends.map((t) => (
        <li
          key={t.rank}
          className="rounded-xl border border-rose-200 bg-white p-4"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-rose-600">#{t.rank}</span>
            <span className="text-lg font-bold text-zinc-900">{t.keyword}</span>
            {t.traffic && (
              <span className="ml-auto text-xs font-semibold text-rose-600">
                {t.traffic}
              </span>
            )}
          </div>
          {t.articles.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {t.articles.map((a, i) => (
                <li key={i}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-zinc-700 hover:text-rose-700 hover:underline line-clamp-2 leading-snug"
                  >
                    {a.title}
                  </a>
                  {a.source && (
                    <div className="text-[11px] text-zinc-500">{a.source}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

// ============ YouTube ============

export function YouTubeView({
  videos,
  compact = false,
}: {
  videos: YouTubeVideo[];
  compact?: boolean;
}) {
  if (videos.length === 0) {
    return <div className="text-sm text-zinc-500">데이터 없음</div>;
  }
  const cols = compact
    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4";
  const items = compact ? videos.slice(0, 10) : videos;
  return (
    <div className={`grid ${cols} gap-3`}>
      {items.map((v) => (
        <a
          key={v.video_id}
          href={`https://www.youtube.com/watch?v=${v.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group block overflow-hidden rounded-lg border border-red-200 bg-white hover:border-red-400 hover:shadow-sm transition-all"
        >
          <div className="relative aspect-video bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.thumbnail}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <div className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
              #{v.rank}
            </div>
          </div>
          <div className="p-2">
            <div className="text-xs font-medium text-zinc-900 line-clamp-2 leading-snug">
              {v.title}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
              <span className="truncate">{v.channel}</span>
              <span className="shrink-0 ml-1">{formatCount(v.view_count)}</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ============ Google News (카테고리별) ============

export function GoogleNewsView({
  news,
  compact = false,
}: {
  news: Record<string, GoogleNewsItem[]>;
  compact?: boolean;
}) {
  const categories = CATEGORY_META.map((c) => ({
    ...c,
    items: news[c.slug] ?? [],
  })).filter((c) => c.items.length > 0);

  if (categories.length === 0) {
    return <div className="text-sm text-zinc-500">데이터 없음</div>;
  }

  if (compact) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {categories.map((c) => {
          const top = c.items[0];
          if (!top) return null;
          return (
            <a
              key={c.slug}
              href={top.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-lg border border-sky-200 bg-white p-3 hover:border-sky-400 hover:shadow-sm transition-all"
            >
              <span className="shrink-0 mt-0.5 rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                {c.name}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-900 leading-snug line-clamp-2 group-hover:text-sky-700">
                  {top.title}
                </div>
                {top.publisher && (
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    {top.publisher}
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map((c) => (
        <section key={c.slug}>
          <h3 className="text-base font-bold text-zinc-900 mb-2 pb-1 border-b border-sky-200">
            {c.name}
          </h3>
          <ul className="space-y-1.5">
            {c.items.slice(0, 15).map((it, i) => (
              <li key={i}>
                <a
                  href={it.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-sky-50 transition-colors"
                >
                  <span className="shrink-0 text-xs text-zinc-400 font-medium min-w-[1.5rem]">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-800 leading-snug line-clamp-2 group-hover:text-sky-700">
                      {it.title}
                    </div>
                    {it.publisher && (
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        {it.publisher}
                      </div>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ============ Articles (BBC/NHK/Yahoo/NYT/HN/CNA/LTN/Spiegel/VnExpress) ============

export function ArticlesView({
  items,
  compact = false,
  accent = "zinc",
}: {
  items: Article[];
  compact?: boolean;
  accent?: "zinc" | "sky" | "red" | "orange" | "blue" | "emerald" | "amber" | "indigo";
}) {
  if (items.length === 0) {
    return <div className="text-sm text-zinc-500">데이터 없음</div>;
  }

  const accentText: Record<string, string> = {
    zinc: "text-zinc-700 group-hover:text-zinc-900",
    sky: "group-hover:text-sky-700",
    red: "group-hover:text-red-700",
    orange: "group-hover:text-orange-700",
    blue: "group-hover:text-blue-700",
    emerald: "group-hover:text-emerald-700",
    amber: "group-hover:text-amber-700",
    indigo: "group-hover:text-indigo-700",
  };
  const accentBg: Record<string, string> = {
    zinc: "hover:bg-zinc-50",
    sky: "hover:bg-sky-50",
    red: "hover:bg-red-50",
    orange: "hover:bg-orange-50",
    blue: "hover:bg-blue-50",
    emerald: "hover:bg-emerald-50",
    amber: "hover:bg-amber-50",
    indigo: "hover:bg-indigo-50",
  };

  const list = compact ? items.slice(0, 4) : items;

  return (
    <ol className="space-y-1.5">
      {list.map((it, i) => (
        <li key={i}>
          <a
            href={it.link}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-start gap-2 rounded-md px-2 py-1.5 ${accentBg[accent]} transition-colors`}
          >
            <span className="shrink-0 text-xs text-zinc-400 font-medium min-w-[1.5rem]">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className={`text-sm leading-snug line-clamp-2 ${accentText[accent]}`}>
                {it.title}
              </div>
              {it.description && !compact && (
                <div className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                  {it.description}
                </div>
              )}
              {it.publisher && (
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  {it.publisher}
                </div>
              )}
            </div>
          </a>
        </li>
      ))}
    </ol>
  );
}

// ============ Press Groups (Naver 언론사별) ============

export function PressGroupsView({
  groups,
  compact = false,
}: {
  groups: PressGroup[];
  compact?: boolean;
}) {
  if (groups.length === 0) {
    return <div className="text-sm text-zinc-500">데이터 없음</div>;
  }

  if (compact) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {groups.map((g) => {
          const top = g.items[0];
          if (!top) return null;
          return (
            <a
              key={g.press}
              href={top.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-lg border border-emerald-200 bg-white p-3 hover:border-emerald-400 hover:shadow-sm transition-all"
            >
              <span className="shrink-0 mt-0.5 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                {g.press}
              </span>
              <div className="flex-1 text-sm text-zinc-900 leading-snug line-clamp-2 group-hover:text-emerald-700">
                {top.title}
              </div>
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.press}>
          <h3 className="text-base font-bold text-zinc-900 mb-2 pb-1 border-b border-emerald-200">
            {g.press}
          </h3>
          <ol className="space-y-1.5">
            {g.items.map((it) => (
              <li key={it.rank}>
                <a
                  href={it.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-emerald-50 transition-colors"
                >
                  <span className="shrink-0 text-xs font-bold text-emerald-600 min-w-[1.5rem]">
                    {it.rank}
                  </span>
                  <span className="text-sm text-zinc-800 leading-snug line-clamp-2 group-hover:text-emerald-700">
                    {it.title}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
