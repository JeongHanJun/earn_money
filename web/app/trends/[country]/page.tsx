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

      <header
        className={`rounded-2xl bg-gradient-to-br ${countryHeroGradient(country)} p-5 sm:p-6 text-white shadow-md`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className="text-4xl sm:text-5xl leading-none drop-shadow-sm" aria-hidden>
                {meta.flag}
              </span>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-white/85">
                  {meta.language}
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                  {meta.name} 실시간 트렌드
                </h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-white/90 leading-6">
              {sources.length}개 소스 · 매시간 자동 갱신
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1 text-[11px] text-white/90">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/25 backdrop-blur-sm px-2.5 py-1 font-medium">
              <span
                className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"
                aria-hidden
              />
              {formatRelative(updated)}
            </span>
          </div>
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
                hint={`Top 10 · ${meta.name}`}
                gradient="from-rose-500 via-orange-500 to-amber-500"
                border="border-rose-200"
                icon={<IconTrend />}
              >
                <GoogleTrendsView trends={data.google_trends.slice(0, 10)} compact />
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
                hint={`Top 10 · ${data.youtube_popular.length}개 중`}
                gradient="from-red-600 via-red-500 to-rose-500"
                border="border-red-200"
                icon={<IconPlay />}
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
                hint="8개 카테고리"
                gradient="from-sky-500 via-blue-500 to-indigo-500"
                border="border-sky-200"
                icon={<IconNews />}
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
              gradient={style.gradient}
              border={style.border}
              icon={style.icon}
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

// ---------- Section shell (gradient header) ----------

function SourceCard({
  href,
  label,
  hint,
  gradient,
  border,
  icon,
  children,
}: {
  href: string;
  label: string;
  hint?: string;
  gradient: string;
  border: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl bg-white border ${border} shadow-sm overflow-hidden`}
    >
      <div
        className={`relative flex items-center justify-between gap-3 bg-gradient-to-r ${gradient} px-4 sm:px-5 py-3 text-white`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && (
            <span className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/25 backdrop-blur-sm">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold tracking-tight truncate leading-tight">
              {label}
            </h2>
            {hint && (
              <div className="text-[11px] text-white/85 truncate">{hint}</div>
            )}
          </div>
        </div>
        <Link
          href={href}
          className="shrink-0 text-sm font-semibold text-white hover:bg-white/20 rounded-md px-2.5 py-1 transition-colors"
        >
          더보기 →
        </Link>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function customSourceStyle(slug: string): {
  gradient: string;
  border: string;
  icon: React.ReactNode;
  viewAccent: "sky" | "red" | "orange" | "blue" | "emerald" | "amber" | "indigo" | "zinc";
} {
  const map: Record<string, ReturnType<typeof customSourceStyle>> = {
    naver: {
      gradient: "from-emerald-500 via-green-500 to-teal-500",
      border: "border-emerald-200",
      icon: <IconLetter c="N" />,
      viewAccent: "emerald",
    },
    daum: {
      gradient: "from-blue-500 via-blue-600 to-indigo-600",
      border: "border-blue-200",
      icon: <IconLetter c="D" />,
      viewAccent: "blue",
    },
    yahoo: {
      gradient: "from-fuchsia-500 via-purple-500 to-indigo-500",
      border: "border-fuchsia-200",
      icon: <IconLetter c="Y!" />,
      viewAccent: "indigo",
    },
    nhk: {
      gradient: "from-red-600 via-rose-600 to-pink-600",
      border: "border-red-200",
      icon: <IconLetter c="NHK" small />,
      viewAccent: "red",
    },
    nyt: {
      gradient: "from-zinc-800 via-zinc-900 to-black",
      border: "border-zinc-300",
      icon: <IconLetter c="NYT" small />,
      viewAccent: "zinc",
    },
    hn: {
      gradient: "from-orange-500 via-amber-500 to-yellow-500",
      border: "border-orange-200",
      icon: <IconLetter c="Y" />,
      viewAccent: "orange",
    },
    bbc: {
      gradient: "from-red-700 via-red-600 to-rose-600",
      border: "border-red-200",
      icon: <IconLetter c="BBC" small />,
      viewAccent: "red",
    },
    cna: {
      gradient: "from-emerald-600 via-teal-600 to-cyan-600",
      border: "border-emerald-200",
      icon: <IconLetter c="CNA" small />,
      viewAccent: "emerald",
    },
    ltn: {
      gradient: "from-amber-500 via-yellow-500 to-orange-500",
      border: "border-amber-200",
      icon: <IconLetter c="LTN" small />,
      viewAccent: "amber",
    },
    spiegel: {
      gradient: "from-red-600 via-orange-700 to-amber-700",
      border: "border-orange-200",
      icon: <IconLetter c="DS" small />,
      viewAccent: "orange",
    },
    vnexpress: {
      gradient: "from-sky-500 via-cyan-500 to-teal-500",
      border: "border-sky-200",
      icon: <IconLetter c="Vn" small />,
      viewAccent: "sky",
    },
  };
  return (
    map[slug] ?? {
      gradient: "from-zinc-500 to-zinc-700",
      border: "border-zinc-200",
      icon: <IconLetter c="•" />,
      viewAccent: "zinc",
    }
  );
}

function sourceHint(slug: string, count: number, type: string): string {
  if (type === "press_groups") return `${count}개 언론사`;
  return `Top ${count}`;
}

function countryHeroGradient(code: string): string {
  const map: Record<string, string> = {
    kr: "from-red-500 via-rose-500 to-indigo-600",
    us: "from-blue-600 via-indigo-600 to-red-600",
    jp: "from-red-500 via-pink-500 to-rose-600",
    uk: "from-blue-700 via-red-600 to-blue-700",
    tw: "from-red-600 via-rose-500 to-blue-600",
    de: "from-zinc-900 via-red-600 to-amber-500",
    vn: "from-red-600 via-red-500 to-amber-400",
  };
  return map[code] ?? "from-indigo-600 to-indigo-800";
}

// ---------- Icons ----------

function IconLetter({ c, small = false }: { c: string; small?: boolean }) {
  return (
    <span className={`font-black text-white ${small ? "text-[10px]" : "text-sm"}`}>
      {c}
    </span>
  );
}

function IconTrend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M3 17l6-6 4 4 8-8M14 7h7v7"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconNews() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 6h16M4 12h16M4 18h10"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
