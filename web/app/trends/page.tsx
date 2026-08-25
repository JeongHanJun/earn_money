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
  title: "실시간 트렌드 대시보드",
  description:
    "Google 급상승 검색어, YouTube 인기 동영상, Naver·Daum 뉴스 랭킹, Google News, HackerNews 를 한눈에.",
};

export default function TrendsPage() {
  const gTrends = googleTrends();
  const ytVideos = youtubePopular();
  const naverGroups = naverRanking();
  const daumItems = daumRanking();
  const categories = allCategories();
  const hn = hackerNewsItems();
  const updated = fetchedAt();

  const naverTotal = naverGroups.reduce((s, g) => s + g.items.length, 0);
  const newsTotal = categories.reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-rose-500 p-6 sm:p-8 text-white shadow-lg">
        <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" aria-hidden />
            LIVE · 매시간 갱신 · 최종 {formatRelative(updated)}
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            지금 대한민국이<br className="sm:hidden" /> 뜨겁게 검색 중
          </h1>
          <p className="mt-3 text-sm sm:text-base text-white/85 max-w-2xl leading-6">
            포털·SNS·글로벌 커뮤니티의 실시간 랭킹을 한 화면에 모았습니다.
            궁금한 소스를 눌러 상세 내용을 확인하세요.
          </p>
        </div>
      </header>

      {/* Hero: Google Trends 급상승 */}
      {gTrends.length > 0 && <TrendsHero trends={gTrends} />}

      {/* Grid: 나머지 소스들 */}
      <div className="grid gap-4 sm:grid-cols-2">
        {ytVideos.length > 0 && (
          <YouTubeTile videos={ytVideos} total={ytVideos.length} />
        )}
        {daumItems.length > 0 && (
          <SourceTile
            href="/trends/daum"
            emoji="🌐"
            title="Daum 인기 뉴스"
            brand="daum"
            count={`${daumItems.length}건`}
            preview={
              <ol className="space-y-1.5 text-sm">
                {daumItems.slice(0, 4).map((it) => (
                  <li key={it.rank} className="flex items-start gap-2">
                    <span className="shrink-0 font-bold text-blue-600 min-w-[1.25rem]">
                      {it.rank}
                    </span>
                    <span className="text-zinc-800 leading-snug line-clamp-1">
                      {it.title}
                    </span>
                  </li>
                ))}
              </ol>
            }
          />
        )}
        {naverGroups.length > 0 && (
          <SourceTile
            href="/trends/naver"
            emoji="📰"
            title="Naver 언론사별"
            brand="naver"
            count={`${naverGroups.length} 언론사`}
            preview={
              <ol className="space-y-1.5 text-sm">
                {naverGroups.slice(0, 4).map((g) => (
                  <li key={g.press} className="flex items-start gap-2">
                    <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">
                      {g.press}
                    </span>
                    <span className="text-zinc-700 leading-snug line-clamp-1 flex-1">
                      {g.items[0]?.title}
                    </span>
                  </li>
                ))}
              </ol>
            }
          />
        )}
        {newsTotal > 0 && (
          <SourceTile
            href="/trends/news"
            emoji="📰"
            title="Google News"
            brand="google"
            count={`${categories.length} 카테고리 · ${newsTotal}건`}
            preview={
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <span
                    key={c.slug}
                    className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {c.name} <span className="text-blue-400">{c.items.length}</span>
                  </span>
                ))}
              </div>
            }
          />
        )}
        {hn.length > 0 && (
          <SourceTile
            href="/trends/hn"
            emoji="💻"
            title="HackerNews"
            brand="hn"
            count={`${hn.length}건`}
            preview={
              <ol className="space-y-1.5 text-sm">
                {hn.slice(0, 3).map((it, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="shrink-0 font-bold text-orange-600 min-w-[1.25rem]">
                      {i + 1}
                    </span>
                    <span className="text-zinc-800 leading-snug line-clamp-2">
                      {it.title}
                    </span>
                  </li>
                ))}
              </ol>
            }
          />
        )}
      </div>

      <div className="text-xs text-zinc-500 text-center pt-4">
        <span className="mr-1.5" aria-hidden>💡</span>
        각 카드를 클릭하면 해당 소스의 전체 랭킹을 볼 수 있습니다.
      </div>
    </div>
  );
}

/* ---------- Google Trends Hero ---------- */

function TrendsHero({ trends }: { trends: GoogleTrend[] }) {
  const top3 = trends.slice(0, 3);
  const rest = trends.slice(3);
  return (
    <section>
      <SectionTitle
        emoji="🔥"
        title="실시간 급상승 검색어"
        subtitle="Google Trends · 대한민국"
        href="/trends/hot"
        actionLabel={`전체 ${trends.length}개 →`}
      />
      <div className="grid gap-3 sm:grid-cols-3 mb-3">
        {top3.map((t, i) => (
          <BigTrendCard key={t.rank} trend={t} accent={i} />
        ))}
      </div>
      {rest.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rest.map((t) => (
            <Link
              key={t.rank}
              href="/trends/hot"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 transition-colors"
            >
              <span className="text-xs text-zinc-400">#{t.rank}</span>
              <span>{t.keyword}</span>
              {t.traffic && (
                <span className="text-xs text-rose-600">· {t.traffic}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function BigTrendCard({ trend, accent }: { trend: GoogleTrend; accent: number }) {
  const gradients = [
    "from-rose-500 to-orange-500",
    "from-orange-500 to-amber-500",
    "from-amber-500 to-yellow-400",
  ];
  const grad = gradients[accent] ?? gradients[0];
  const primary = trend.articles[0];
  return (
    <Link
      href="/trends/hot"
      className="group block overflow-hidden rounded-2xl shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5"
    >
      <div className={`relative bg-gradient-to-br ${grad} p-5 text-white min-h-[9rem]`}>
        <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/20 blur-xl" aria-hidden />
        <div className="relative">
          <div className="flex items-baseline justify-between">
            <span className="text-4xl font-black leading-none">#{trend.rank}</span>
            {trend.traffic && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/25 backdrop-blur px-2.5 py-1 text-xs font-semibold">
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 3a1 1 0 01.7.29l6 6a1 1 0 11-1.4 1.42L11 6.4V16a1 1 0 11-2 0V6.41L4.7 10.7a1 1 0 01-1.4-1.42l6-6A1 1 0 0110 3z" />
                </svg>
                {trend.traffic}
              </span>
            )}
          </div>
          <div className="mt-3 text-xl sm:text-2xl font-bold tracking-tight leading-tight">
            {trend.keyword}
          </div>
          {primary && (
            <div className="mt-2 text-xs text-white/85 line-clamp-2 leading-snug">
              {primary.title}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ---------- YouTube big tile ---------- */

function YouTubeTile({ videos, total }: { videos: YouTubeVideo[]; total: number }) {
  return (
    <Link
      href="/trends/youtube"
      className="group block rounded-2xl overflow-hidden border border-zinc-200 bg-white shadow-sm hover:shadow-md hover:border-red-400 transition-all"
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-red-600 text-white text-sm">
            ▶
          </span>
          <div>
            <div className="font-bold text-zinc-900">YouTube 인기</div>
            <div className="text-xs text-zinc-500">한국 · {total}개</div>
          </div>
        </div>
        <span className="text-xs font-medium text-zinc-500 group-hover:text-red-600">
          더보기 →
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 p-3">
        {videos.slice(0, 4).map((v) => (
          <div key={v.video_id} className="relative aspect-video overflow-hidden rounded-md bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.thumbnail}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <div className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
              #{v.rank}
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <div className="text-sm font-medium text-zinc-900 line-clamp-1">
          {videos[0]?.title}
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {videos[0]?.channel} · 조회 {formatCount(videos[0]?.view_count ?? 0)}
        </div>
      </div>
    </Link>
  );
}

/* ---------- Generic source tile ---------- */

function SourceTile({
  href,
  emoji,
  title,
  brand,
  count,
  preview,
}: {
  href: string;
  emoji: string;
  title: string;
  brand: "naver" | "daum" | "google" | "hn";
  count: string;
  preview: React.ReactNode;
}) {
  const brandStyle = {
    naver: {
      dot: "bg-emerald-500",
      hover: "hover:border-emerald-400",
      accent: "group-hover:text-emerald-700",
    },
    daum: {
      dot: "bg-blue-500",
      hover: "hover:border-blue-400",
      accent: "group-hover:text-blue-700",
    },
    google: {
      dot: "bg-blue-500",
      hover: "hover:border-blue-400",
      accent: "group-hover:text-blue-700",
    },
    hn: {
      dot: "bg-orange-500",
      hover: "hover:border-orange-400",
      accent: "group-hover:text-orange-700",
    },
  }[brand];

  return (
    <Link
      href={href}
      className={`group block rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-md ${brandStyle.hover} transition-all`}
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>{emoji}</span>
          <div>
            <div className="font-bold text-zinc-900 flex items-center gap-1.5">
              {title}
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${brandStyle.dot}`} />
            </div>
            <div className="text-xs text-zinc-500">{count}</div>
          </div>
        </div>
        <span className={`text-xs font-medium text-zinc-500 ${brandStyle.accent}`}>
          더보기 →
        </span>
      </div>
      <div className="p-4">{preview}</div>
    </Link>
  );
}

/* ---------- Section title ---------- */

function SectionTitle({
  emoji,
  title,
  subtitle,
  href,
  actionLabel,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
          <span className="mr-2" aria-hidden>{emoji}</span>
          {title}
        </h2>
        {subtitle && <div className="mt-0.5 text-xs text-zinc-500">{subtitle}</div>}
      </div>
      {href && actionLabel && (
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-rose-600 hover:text-rose-700 hover:underline"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
