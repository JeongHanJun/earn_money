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
  loadCountry,
  type Article,
  type PressGroup,
} from "@/lib/trends";

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.code }));
}

export async function generateMetadata(
  props: PageProps<"/trends/[country]">
): Promise<Metadata> {
  const { country } = await props.params;
  const meta = countryMeta(country);
  if (!meta) return { title: "국가를 찾을 수 없음" };
  return {
    title: `${meta.name} 실시간 트렌드`,
    description: `${meta.flag} ${meta.name}의 Google 급상승 검색어, YouTube 인기 동영상, Google News, 대표 매체 랭킹. 매시간 갱신.`,
  };
}

export default async function CountryTrendsPage(
  props: PageProps<"/trends/[country]">
) {
  const { country } = await props.params;
  if (!isValidCountry(country)) notFound();

  const meta = countryMeta(country)!;
  const file = loadCountry(country);
  const data = file.data;
  const updated = file.fetched_at;
  const sources = COUNTRY_SOURCES[country] ?? [];

  return (
    <div className="space-y-6">
      <div>
        <CountryTabs active={country} />
      </div>

      <header className="flex items-baseline justify-between border-b border-zinc-200 pb-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
          <span aria-hidden>{meta.flag}</span>
          <span>{meta.name} 실시간 트렌드</span>
        </h1>
        <div className="text-xs text-zinc-500 flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
            aria-hidden
          />
          {formatRelative(updated)}
        </div>
      </header>

      <div className="space-y-4">
        {sources.map((slug) => {
          const key = SOURCE_SLUG_TO_KEY[slug];
          const label = SOURCE_LABELS[slug] ?? slug;
          const href = `/trends/${country}/${slug}`;

          if (key === "google_trends") {
            if (data.google_trends.length === 0) return null;
            return (
              <SourceCard
                key={slug}
                href={href}
                label={label}
                hint={`Google Trends · ${meta.name}`}
                tint="bg-rose-50/70"
                border="border-rose-200"
                accent="text-rose-700"
              >
                <GoogleTrendsView trends={data.google_trends.slice(0, 6)} compact />
              </SourceCard>
            );
          }
          if (key === "youtube_popular") {
            if (data.youtube_popular.length === 0) return null;
            return (
              <SourceCard
                key={slug}
                href={href}
                label={label}
                hint={`YouTube · Top ${data.youtube_popular.length}`}
                tint="bg-red-50/70"
                border="border-red-200"
                accent="text-red-700"
              >
                <YouTubeView videos={data.youtube_popular} compact />
              </SourceCard>
            );
          }
          if (key === "google_news") {
            const cats = Object.values(data.google_news ?? {}).filter(
              (v) => v.length > 0
            );
            if (cats.length === 0) return null;
            return (
              <SourceCard
                key={slug}
                href={href}
                label={label}
                hint="카테고리별 · 매시간 갱신"
                tint="bg-sky-50/70"
                border="border-sky-200"
                accent="text-sky-700"
              >
                <GoogleNewsView news={data.google_news} compact />
              </SourceCard>
            );
          }
          // custom source
          const src = data.custom?.[key];
          if (!src || src.items.length === 0) return null;
          const style = customSourceStyle(slug);
          return (
            <SourceCard
              key={slug}
              href={href}
              label={label}
              hint={sourceHint(slug, src.items.length, src.type)}
              tint={style.tint}
              border={style.border}
              accent={style.accent}
            >
              {src.type === "press_groups" ? (
                <PressGroupsView groups={src.items as PressGroup[]} compact />
              ) : (
                <ArticlesView
                  items={src.items as Article[]}
                  compact
                  accent={style.viewAccent}
                />
              )}
            </SourceCard>
          );
        })}
      </div>

      <p className="text-xs text-zinc-500 text-center pt-2">
        각 섹션의 <span className="font-medium">더보기 →</span>를 눌러 전체 랭킹을 확인하세요.
      </p>
    </div>
  );
}

// ---------- Section shell ----------

function SourceCard({
  href,
  label,
  hint,
  tint,
  border,
  accent,
  children,
}: {
  href: string;
  label: string;
  hint?: string;
  tint: string;
  border: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl ${tint} border ${border} shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b ${border} bg-white/60 px-4 sm:px-5 py-3`}
      >
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className={`text-base sm:text-lg font-bold tracking-tight ${accent} truncate`}>
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

function customSourceStyle(slug: string): {
  tint: string;
  border: string;
  accent: string;
  viewAccent: "sky" | "red" | "orange" | "blue" | "emerald" | "amber" | "indigo" | "zinc";
} {
  const map: Record<string, ReturnType<typeof customSourceStyle>> = {
    naver: {
      tint: "bg-emerald-50/70",
      border: "border-emerald-200",
      accent: "text-emerald-700",
      viewAccent: "emerald",
    },
    daum: {
      tint: "bg-blue-50/70",
      border: "border-blue-200",
      accent: "text-blue-700",
      viewAccent: "blue",
    },
    yahoo: {
      tint: "bg-fuchsia-50/70",
      border: "border-fuchsia-200",
      accent: "text-fuchsia-700",
      viewAccent: "indigo",
    },
    nhk: {
      tint: "bg-red-50/70",
      border: "border-red-200",
      accent: "text-red-700",
      viewAccent: "red",
    },
    nyt: {
      tint: "bg-zinc-50/70",
      border: "border-zinc-300",
      accent: "text-zinc-800",
      viewAccent: "zinc",
    },
    hn: {
      tint: "bg-orange-50/70",
      border: "border-orange-200",
      accent: "text-orange-700",
      viewAccent: "orange",
    },
    bbc: {
      tint: "bg-red-50/70",
      border: "border-red-200",
      accent: "text-red-700",
      viewAccent: "red",
    },
    cna: {
      tint: "bg-emerald-50/70",
      border: "border-emerald-200",
      accent: "text-emerald-700",
      viewAccent: "emerald",
    },
    ltn: {
      tint: "bg-amber-50/70",
      border: "border-amber-200",
      accent: "text-amber-700",
      viewAccent: "amber",
    },
    spiegel: {
      tint: "bg-orange-50/70",
      border: "border-orange-200",
      accent: "text-orange-700",
      viewAccent: "orange",
    },
    vnexpress: {
      tint: "bg-sky-50/70",
      border: "border-sky-200",
      accent: "text-sky-700",
      viewAccent: "sky",
    },
  };
  return (
    map[slug] ?? {
      tint: "bg-zinc-50/70",
      border: "border-zinc-200",
      accent: "text-zinc-700",
      viewAccent: "zinc",
    }
  );
}

function sourceHint(slug: string, count: number, type: string): string {
  if (type === "press_groups") return `${count}개 언론사`;
  return `Top ${count}`;
}
