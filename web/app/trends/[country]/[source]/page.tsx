import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CountryTabs } from "@/components/trends/CountryTabs";
import {
  ArticlesView,
  GoogleNewsView,
  GoogleTrendsView,
  PressGroupsView,
  YouTubeView,
} from "@/components/trends/SourceViews";
import {
  COUNTRIES,
  COUNTRY_SOURCES,
  SOURCE_LABELS,
  SOURCE_SLUG_TO_KEY,
  countryMeta,
  formatRelative,
  isValidCountry,
  isValidSource,
  loadCountry,
  type Article,
  type PressGroup,
} from "@/lib/trends";

export function generateStaticParams() {
  const params: Array<{ country: string; source: string }> = [];
  for (const c of COUNTRIES) {
    for (const s of COUNTRY_SOURCES[c.code] ?? []) {
      params.push({ country: c.code, source: s });
    }
  }
  return params;
}

export async function generateMetadata(
  props: PageProps<"/trends/[country]/[source]">
): Promise<Metadata> {
  const { country, source } = await props.params;
  const meta = countryMeta(country);
  if (!meta) return { title: "찾을 수 없음" };
  const label = SOURCE_LABELS[source] ?? source;
  return {
    title: `${meta.name} · ${label}`,
    description: `${meta.flag} ${meta.name} ${label} 실시간 랭킹. 매시간 갱신.`,
  };
}

export default async function SourceDetailPage(
  props: PageProps<"/trends/[country]/[source]">
) {
  const { country, source } = await props.params;
  if (!isValidCountry(country)) notFound();
  if (!isValidSource(country, source)) notFound();

  const meta = countryMeta(country)!;
  const file = loadCountry(country);
  const data = file.data;
  const updated = file.fetched_at;
  const key = SOURCE_SLUG_TO_KEY[source];
  const label = SOURCE_LABELS[source] ?? source;

  return (
    <div className="space-y-6">
      <CountryTabs active={country} />

      <nav className="text-sm text-zinc-500">
        <Link href="/trends" className="hover:text-zinc-900">
          실시간 트렌드
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/trends/${country}`} className="hover:text-zinc-900">
          {meta.flag} {meta.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900">{label}</span>
      </nav>

      <header className="flex items-baseline justify-between border-b border-zinc-200 pb-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
          {label}
        </h1>
        <div className="text-xs text-zinc-500 flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
            aria-hidden
          />
          {formatRelative(updated)}
        </div>
      </header>

      <div>
        {key === "google_trends" && (
          <GoogleTrendsView trends={data.google_trends} />
        )}
        {key === "youtube_popular" && (
          <YouTubeView videos={data.youtube_popular} />
        )}
        {key === "google_news" && (
          <GoogleNewsView news={data.google_news} />
        )}
        {key !== "google_trends" &&
          key !== "youtube_popular" &&
          key !== "google_news" &&
          (() => {
            const src = data.custom?.[key];
            if (!src) return <div className="text-sm text-zinc-500">데이터 없음</div>;
            if (src.type === "press_groups") {
              return <PressGroupsView groups={src.items as PressGroup[]} />;
            }
            return <ArticlesView items={src.items as Article[]} />;
          })()}
      </div>
    </div>
  );
}
