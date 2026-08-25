import type { Metadata } from "next";
import Link from "next/link";
import {
  allCategories,
  daumRanking,
  fetchedAt,
  formatCount,
  formatRelative,
  googleTrends,
  hackerNewsItems,
  naverRanking,
  youtubePopular,
  type GoogleTrend,
  type YouTubeVideo,
} from "@/lib/trends";

export const metadata: Metadata = {
  title: "실시간 트렌드",
  description:
    "Google 급상승 검색어, YouTube 인기 동영상, Naver·Daum 뉴스 랭킹, Google News, HackerNews 를 한눈에.",
};

export default function TrendsPage() {
  const gTrends = googleTrends();
  const ytVideos = youtubePopular();
  const naverGroups = naverRanking();
  const daumItems = daumRanking();
  const categories = allCategories().filter((c) => c.items.length > 0);
  const hn = hackerNewsItems();
  const updated = fetchedAt();

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between border-b border-zinc-200 pb-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
          실시간 트렌드
        </h1>
        <div className="text-xs text-zinc-500 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
          {formatRelative(updated)}
        </div>
      </header>

      {gTrends.length > 0 && <TrendsSection trends={gTrends} />}

      {categories.length > 0 && <NewsCategoriesSection categories={categories} />}

      {ytVideos.length > 0 && <YouTubeSection videos={ytVideos} />}

      {naverGroups.length > 0 && <NaverSection groups={naverGroups} />}

      {daumItems.length > 0 && <DaumSection items={daumItems} />}

      {hn.length > 0 && <HNSection items={hn} />}

      <p className="text-xs text-zinc-500 text-center pt-4">
        각 섹션의 <span className="font-medium">더보기</span>를 눌러 전체 랭킹을 확인하세요.
      </p>
    </div>
  );
}

/* ---------- Reusable section shell (subtle brand tint) ---------- */

function Section({
  href,
  label,
  hint,
  tint,
  border,
  accent,
  dot,
  mark,
  children,
}: {
  href: string;
  label: string;
  hint?: string;
  tint: string;    // e.g. "bg-rose-50/70"
  border: string;  // e.g. "border-rose-200"
  accent: string;  // e.g. "text-rose-700"
  dot: string;     // e.g. "bg-rose-500"
  mark?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl ${tint} border ${border} shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden`}>
      <div className={`flex items-center justify-between gap-3 border-b ${border} bg-white/60 px-4 sm:px-5 py-3`}>
        <div className="flex items-center gap-2 min-w-0">
          {mark ?? (
            <span className={`inline-block h-2 w-2 rounded-full ${dot}`} aria-hidden />
          )}
          <h2 className={`text-lg sm:text-xl font-bold tracking-tight ${accent} truncate`}>
            {label}
          </h2>
          {hint && (
            <span className="hidden sm:inline text-xs text-zinc-500 truncate">
              · {hint}
            </span>
          )}
        </div>
        <Link
          href={href}
          className={`shrink-0 text-sm font-medium ${accent} hover:underline`}
        >
          더보기 →
        </Link>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/* ---------- Brand marks (small colored icons) ---------- */

function BrandMark({ kind }: { kind: "trends" | "news" | "youtube" | "naver" | "daum" | "hn" }) {
  const cls = "inline-flex h-6 w-6 items-center justify-center rounded-md text-white text-xs font-black shrink-0";
  switch (kind) {
    case "trends":
      return <span className={`${cls} bg-gradient-to-br from-rose-500 to-orange-500`}>↑</span>;
    case "news":
      return <span className={`${cls} bg-sky-500`}>G</span>;
    case "youtube":
      return <span className={`${cls} bg-red-600`}>▶</span>;
    case "naver":
      return <span className={`${cls} bg-emerald-600`}>N</span>;
    case "daum":
      return <span className={`${cls} bg-blue-600`}>D</span>;
    case "hn":
      return <span className={`${cls} bg-orange-500`}>Y</span>;
  }
}

/* ---------- Google Trends ---------- */

function TrendsSection({ trends }: { trends: GoogleTrend[] }) {
  const top3 = trends.slice(0, 3);
  const rest = trends.slice(3);
  return (
    <Section
      href="/trends/hot"
      label="급상승 검색어"
      hint="Google Trends · 대한민국"
      tint="bg-rose-50/70"
      border="border-rose-200"
      accent="text-rose-700"
      dot="bg-rose-500"
      mark={<BrandMark kind="trends" />}
    >
      <div className="grid gap-2 sm:grid-cols-3 mb-3">
        {top3.map((t) => (
          <TrendMini key={t.rank} trend={t} />
        ))}
      </div>
      {rest.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rest.map((t) => (
            <Link
              key={t.rank}
              href="/trends/hot"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-rose-400 hover:text-rose-700 transition-colors"
            >
              <span className="text-zinc-400">#{t.rank}</span>
              <span>{t.keyword}</span>
              {t.traffic && (
                <span className="text-rose-600">· {t.traffic}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

function TrendMini({ trend }: { trend: GoogleTrend }) {
  const primary = trend.articles[0];
  return (
    <Link
      href="/trends/hot"
      className="group block rounded-lg border border-rose-200 bg-white p-3 hover:border-rose-400 hover:shadow-sm transition-all"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-bold text-rose-600">#{trend.rank}</span>
        <span className="text-base font-bold text-zinc-900 truncate">
          {trend.keyword}
        </span>
        {trend.traffic && (
          <span className="ml-auto shrink-0 text-[11px] font-semibold text-rose-600">
            {trend.traffic}
          </span>
        )}
      </div>
      {primary && (
        <div className="mt-1.5 text-xs text-zinc-600 line-clamp-2 leading-snug group-hover:text-zinc-900">
          {primary.title}
        </div>
      )}
    </Link>
  );
}

/* ---------- Google News (카테고리별 인기 뉴스) ---------- */

function NewsCategoriesSection({
  categories,
}: {
  categories: Array<{ slug: string; name: string; items: import("@/lib/trends").TrendItem[] }>;
}) {
  return (
    <Section
      href="/trends/news"
      label="카테고리별 인기 뉴스"
      hint="Google News · 매 시간 갱신"
      tint="bg-sky-50/70"
      border="border-sky-200"
      accent="text-sky-700"
      dot="bg-sky-500"
      mark={<BrandMark kind="news" />}
    >
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
    </Section>
  );
}

/* ---------- YouTube ---------- */

function YouTubeSection({ videos }: { videos: YouTubeVideo[] }) {
  return (
    <Section
      href="/trends/youtube"
      label="YouTube 인기 동영상"
      hint={`한국 · Top ${videos.length}`}
      tint="bg-red-50/70"
      border="border-red-200"
      accent="text-red-700"
      dot="bg-red-500"
      mark={<BrandMark kind="youtube" />}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {videos.slice(0, 4).map((v) => (
          <Link
            key={v.video_id}
            href="/trends/youtube"
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
          </Link>
        ))}
      </div>
    </Section>
  );
}

/* ---------- Naver ---------- */

function NaverSection({
  groups,
}: {
  groups: import("@/lib/trends").NaverPressGroup[];
}) {
  return (
    <Section
      href="/trends/naver"
      label="Naver 언론사별 관점"
      hint={`${groups.length}개 언론사 각 Top 1`}
      tint="bg-emerald-50/70"
      border="border-emerald-200"
      accent="text-emerald-700"
      dot="bg-emerald-500"
      mark={<BrandMark kind="naver" />}
    >
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
    </Section>
  );
}

/* ---------- Daum ---------- */

function DaumSection({
  items,
}: {
  items: import("@/lib/trends").DaumRankingItem[];
}) {
  return (
    <Section
      href="/trends/daum"
      label="Daum 인기 뉴스"
      hint={`Top ${items.length}`}
      tint="bg-blue-50/70"
      border="border-blue-200"
      accent="text-blue-700"
      dot="bg-blue-500"
      mark={<BrandMark kind="daum" />}
    >
      <ol className="grid gap-1.5 sm:grid-cols-2">
        {items.slice(0, 6).map((it) => (
          <li key={it.rank}>
            <a
              href={it.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm hover:border-blue-400 hover:shadow-sm transition-all"
            >
              <span className="shrink-0 font-bold text-blue-600 min-w-[1.5rem]">
                {it.rank}
              </span>
              <span className="text-zinc-800 leading-snug line-clamp-1 flex-1 group-hover:text-blue-700">
                {it.title}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ---------- HackerNews ---------- */

function HNSection({ items }: { items: import("@/lib/trends").TrendItem[] }) {
  return (
    <Section
      href="/trends/hn"
      label="HackerNews"
      hint="글로벌 IT 커뮤니티"
      tint="bg-orange-50/70"
      border="border-orange-200"
      accent="text-orange-700"
      dot="bg-orange-500"
      mark={<BrandMark kind="hn" />}
    >
      <ol className="space-y-1.5">
        {items.slice(0, 3).map((it, i) => (
          <li key={i}>
            <a
              href={it.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-md border border-orange-200 bg-white px-3 py-2 hover:border-orange-400 hover:shadow-sm transition-all"
            >
              <span className="shrink-0 font-bold text-orange-600 min-w-[1.5rem]">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-900 leading-snug line-clamp-2 group-hover:text-orange-700">
                  {it.title}
                </div>
                <div className="text-[11px] text-zinc-500">{it.description}</div>
              </div>
            </a>
          </li>
        ))}
      </ol>
    </Section>
  );
}
