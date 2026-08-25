import type { Metadata } from "next";
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
  type DaumRankingItem,
  type GoogleTrend,
  type NaverPressGroup,
  type TrendItem,
  type YouTubeVideo,
} from "@/lib/trends";

export const metadata: Metadata = {
  title: "실시간 트렌드",
  description:
    "Google 급상승 검색어, YouTube 인기 동영상, Naver/Daum 뉴스 랭킹, Google News를 한 페이지에 통합.",
};

export default function TrendsPage() {
  const gTrends = googleTrends();
  const ytVideos = youtubePopular();
  const naverGroups = naverRanking();
  const daumItems = daumRanking();
  const categories = allCategories();
  const hn = hackerNewsItems();
  const updated = fetchedAt();

  return (
    <div className="space-y-14">
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
          지금 대한민국에서 뜨는 검색어·영상·뉴스를 한 화면에.
        </p>
      </header>

      {gTrends.length > 0 && <GoogleTrendsSection trends={gTrends} />}

      {ytVideos.length > 0 && <YouTubeSection videos={ytVideos} />}

      {daumItems.length > 0 && <DaumSection items={daumItems} />}

      {naverGroups.length > 0 && <NaverSection groups={naverGroups} />}

      {categories.some((c) => c.items.length > 0) && (
        <section>
          <SectionHeader
            emoji="📰"
            title="Google News 카테고리"
            hint="분야별 최신 뉴스"
          />
          <div className="space-y-10">
            {categories.map((c) =>
              c.items.length > 0 ? (
                <CategorySection
                  key={c.slug}
                  name={c.name}
                  items={c.items.slice(0, 8)}
                />
              ) : null
            )}
          </div>
        </section>
      )}

      {hn.length > 0 && (
        <section>
          <SectionHeader
            emoji="💻"
            title="글로벌 IT 화제 (HackerNews)"
            hint="Silicon Valley 개발자·창업가 커뮤니티"
          />
          <div className="grid gap-2">
            {hn.slice(0, 10).map((it, i) => (
              <SimpleLinkCard key={i} item={it} />
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-zinc-500 text-center">
        출처: Google Trends · YouTube · Naver · Daum · Google News · HackerNews · 링크 클릭 시 원문 이동
      </p>
    </div>
  );
}

/* ---------- Reusable ---------- */

function SectionHeader({
  emoji,
  title,
  hint,
}: {
  emoji: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
        <span className="mr-2" aria-hidden>
          {emoji}
        </span>
        {title}
      </h2>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  );
}

/* ---------- Google Trends 급상승 검색어 ---------- */

function GoogleTrendsSection({ trends }: { trends: GoogleTrend[] }) {
  return (
    <section>
      <SectionHeader
        emoji="🔥"
        title="실시간 급상승 검색어"
        hint="Google Trends · 대한민국"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {trends.slice(0, 10).map((t) => (
          <TrendCard key={t.rank} trend={t} />
        ))}
      </div>
    </section>
  );
}

function TrendCard({ trend }: { trend: GoogleTrend }) {
  const primary = trend.articles[0];
  return (
    <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white font-bold text-lg">
          {trend.rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-bold text-zinc-900 text-base leading-tight">
              {trend.keyword}
            </span>
            {trend.traffic && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 3a1 1 0 01.7.29l6 6a1 1 0 11-1.4 1.42L11 6.4V16a1 1 0 11-2 0V6.41L4.7 10.7a1 1 0 01-1.4-1.42l6-6A1 1 0 0110 3z" />
                </svg>
                {trend.traffic} 검색
              </span>
            )}
          </div>
          {primary && (
            <a
              href={primary.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-sm text-zinc-700 leading-snug hover:text-rose-700 hover:underline line-clamp-2"
            >
              {primary.title}
            </a>
          )}
          {primary?.source && (
            <div className="mt-1 text-xs text-zinc-500">{primary.source}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- YouTube ---------- */

function YouTubeSection({ videos }: { videos: YouTubeVideo[] }) {
  return (
    <section>
      <SectionHeader
        emoji="📺"
        title="YouTube 인기 동영상"
        hint="한국 · 실시간 랭킹"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.slice(0, 12).map((v) => (
          <YouTubeCard key={v.video_id} video={v} />
        ))}
      </div>
    </section>
  );
}

function YouTubeCard({ video }: { video: YouTubeVideo }) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.video_id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm hover:shadow-md hover:border-red-400 transition-all"
    >
      <div className="relative aspect-video bg-zinc-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnail}
          alt={video.title}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-bold text-white">
          #{video.rank}
        </div>
      </div>
      <div className="p-3">
        <div className="font-medium text-sm text-zinc-900 leading-snug line-clamp-2 group-hover:text-red-700">
          {video.title}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
          <span className="truncate">{video.channel}</span>
          <span className="shrink-0 ml-2">조회 {formatCount(video.view_count)}</span>
        </div>
      </div>
    </a>
  );
}

/* ---------- Daum ---------- */

function DaumSection({ items }: { items: DaumRankingItem[] }) {
  return (
    <section>
      <SectionHeader emoji="🌐" title="Daum 인기 뉴스" hint="많이 본 랭킹" />
      <ol className="space-y-2">
        {items.slice(0, 15).map((it) => (
          <li key={it.rank}>
            <a
              href={it.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700 text-sm font-bold">
                {it.rank}
              </span>
              <span className="text-sm text-zinc-900 leading-snug line-clamp-2 flex-1">
                {it.title}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- Naver ---------- */

function NaverSection({ groups }: { groups: NaverPressGroup[] }) {
  return (
    <section>
      <SectionHeader
        emoji="📰"
        title="Naver 언론사별 많이 본 뉴스"
        hint={`${groups.length}개 언론사 · 각 Top 5`}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div
            key={g.press}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-zinc-900">{g.press}</span>
            </div>
            <ol className="space-y-1.5">
              {g.items.map((it) => (
                <li key={it.rank}>
                  <a
                    href={it.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 text-sm text-zinc-700 hover:text-emerald-700"
                  >
                    <span className="shrink-0 font-bold text-zinc-400 group-hover:text-emerald-600 min-w-[1.25rem]">
                      {it.rank}
                    </span>
                    <span className="line-clamp-2 leading-snug">{it.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Existing (Google News, HN) ---------- */

function CategorySection({
  name,
  items,
}: {
  name: string;
  items: TrendItem[];
}) {
  return (
    <div>
      <h3 className="text-base font-semibold tracking-tight mb-2 text-zinc-800">
        {name}
      </h3>
      <div className="grid gap-2">
        {items.map((it, i) => (
          <SimpleLinkCard key={i} item={it} />
        ))}
      </div>
    </div>
  );
}

function SimpleLinkCard({ item }: { item: TrendItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-amber-400 hover:bg-amber-50/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-zinc-900 leading-snug line-clamp-2 text-sm">
            {item.title}
          </div>
          {item.description && (
            <div className="mt-1 text-xs text-zinc-500 line-clamp-1">
              {item.description}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right text-xs text-zinc-500">
          {item.publisher && (
            <div className="font-medium">{item.publisher}</div>
          )}
          <div>{formatRelative(item.pub_date)}</div>
        </div>
      </div>
    </a>
  );
}
