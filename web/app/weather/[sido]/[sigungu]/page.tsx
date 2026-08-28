import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RegionSelect } from "@/components/RegionSelect";
import { allMunicipalityPaths, getMunicipality } from "@/lib/regions";
import { breadcrumbJsonLd } from "@/lib/seo";
import {
  formatKoreanDate,
  formatTime,
  groupByDay,
  loadWeather,
  pivotByTime,
  sample3Hours,
  umbrellaLabel,
  umbrellaLevelFor,
  type DayForecast,
  type UmbrellaLevel,
} from "@/lib/weather";

export function generateStaticParams() {
  return allMunicipalityPaths();
}

export async function generateMetadata(
  props: PageProps<"/weather/[sido]/[sigungu]">
): Promise<Metadata> {
  const { sido, sigungu } = await props.params;
  const hit = getMunicipality(sido, sigungu);
  if (!hit) return { title: "지역을 찾을 수 없음" };
  const { province, municipality } = hit;
  return {
    title: `${municipality.name} 날씨`,
    description: `${province.name} ${municipality.name} 3일 단기예보 (기온·강수·습도·풍속).`,
  };
}

export default async function WeatherDetail(
  props: PageProps<"/weather/[sido]/[sigungu]">
) {
  const { sido, sigungu } = await props.params;
  const hit = getMunicipality(sido, sigungu);
  if (!hit) notFound();
  const { province, municipality } = hit;

  let days: DayForecast[] = [];
  let fetchedAt: string | null = null;
  try {
    const raw = loadWeather(sido, sigungu);
    fetchedAt = raw.fetched_at;
    const points = pivotByTime(raw.data.items);
    days = groupByDay(points);
  } catch {
    // 데이터 파일이 아직 없는 경우
  }

  const breadcrumb = breadcrumbJsonLd([
    { name: "홈", url: "/" },
    { name: "날씨", url: "/weather" },
    { name: province.name, url: `/weather/${province.slug}` },
    { name: municipality.name },
  ]);

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <nav className="text-sm text-zinc-500">
        <Link href="/weather" className="hover:text-zinc-900">
          날씨
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/weather/${province.slug}`} className="hover:text-zinc-900">
          {province.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900">{municipality.name}</span>
      </nav>

      <header>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {municipality.name} 날씨
        </h1>
        <p className="mt-2 text-zinc-600">
          {province.name} · 기상청 단기예보 (격자 {municipality.nx},{" "}
          {municipality.ny})
        </p>
      </header>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-medium text-zinc-500 mb-2">
          다른 지역 보기
        </div>
        <RegionSelect
          initialProvince={province.slug}
          initialMunicipality={municipality.slug}
        />
      </div>

      {days.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <TodayCard day={days[0]} />
          <OutfitTip
            day={days[0].tmax ? days[0] : (days[1] ?? days[0])}
            label={days[0].tmax ? "오늘의 옷차림" : "내일의 옷차림"}
          />
          <div className="grid gap-4">
            {days.slice(1).map((d) => (
              <DayCard key={d.date} day={d} />
            ))}
          </div>
        </>
      )}

      {fetchedAt && (
        <p className="text-xs text-zinc-400 text-center">
          최종 업데이트: {new Date(fetchedAt).toLocaleString("ko-KR")} · 출처:
          기상청 단기예보 조회서비스
        </p>
      )}
    </div>
  );
}

function UmbrellaBadge({
  level,
  popPercent,
  variant = "solid",
}: {
  level: UmbrellaLevel;
  popPercent: number;
  variant?: "solid" | "outline";
}) {
  if (level === "none") return null;
  const label = umbrellaLabel(level);
  const styles: Record<UmbrellaLevel, { solid: string; outline: string }> = {
    essential: {
      solid: "bg-red-600 text-white shadow-lg shadow-red-500/40",
      outline: "bg-red-100 text-red-800 border border-red-300",
    },
    recommended: {
      solid: "bg-amber-500 text-white shadow-lg shadow-amber-500/30",
      outline: "bg-amber-100 text-amber-800 border border-amber-300",
    },
    optional: {
      solid: "bg-sky-500 text-white shadow-lg shadow-sky-500/30",
      outline: "bg-sky-100 text-sky-800 border border-sky-300",
    },
    none: { solid: "", outline: "" },
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${styles[level][variant]}`}
    >
      <span className="text-base">☂</span>
      {label}
      <span className="opacity-80 font-normal text-xs">· {popPercent}%</span>
    </span>
  );
}

/**
 * 강수확률에 따른 시간 박스 배경 스타일.
 */
function timeSlotStyle(pop: number, inverse: boolean): string {
  if (pop >= 80) {
    return inverse
      ? "bg-red-500/40 ring-2 ring-red-300"
      : "bg-red-100 ring-1 ring-red-300";
  }
  if (pop >= 50) {
    return inverse
      ? "bg-amber-400/35 ring-1 ring-amber-200"
      : "bg-amber-50 ring-1 ring-amber-200";
  }
  if (pop >= 30) {
    return inverse ? "bg-sky-400/25" : "bg-sky-50";
  }
  return inverse ? "bg-white/10" : "bg-zinc-50";
}

/**
 * 일 단위 배경색 (전체 카드 배경).
 */
function dayBgClass(level: UmbrellaLevel): string {
  switch (level) {
    case "essential":
      return "border-red-300 bg-red-50/70";
    case "recommended":
      return "border-amber-300 bg-amber-50/60";
    case "optional":
      return "border-sky-300 bg-sky-50/50";
    default:
      return "border-zinc-200 bg-white";
  }
}

function TodayCard({ day }: { day: DayForecast }) {
  const now = day.points.find((p) => p.tmp) ?? day.points[0];
  const slots = sample3Hours(day);
  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 sm:p-8 text-white">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-indigo-200">
          오늘 · {formatKoreanDate(day.date)}
        </div>
        <UmbrellaBadge
          level={day.umbrella}
          popPercent={day.max_pop}
          variant="solid"
        />
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        {now?.tmp && (
          <div className="text-5xl sm:text-6xl font-bold tracking-tight">
            {now.tmp}°
          </div>
        )}
        {day.summary && (
          <div className="text-xl sm:text-2xl font-medium">{day.summary}</div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-indigo-100">
        {day.tmin && day.tmax && (
          <span>
            최저 {day.tmin}° / 최고 {day.tmax}°
          </span>
        )}
        {now?.pop && <span>강수확률 {now.pop}%</span>}
        {now?.reh && <span>습도 {now.reh}%</span>}
        {now?.wsd && <span>풍속 {now.wsd}m/s</span>}
      </div>

      {slots.length > 0 && (
        <div
          className="mt-6 grid gap-2 text-center"
          style={{
            gridTemplateColumns: `repeat(${Math.min(slots.length, 8)}, minmax(0, 1fr))`,
          }}
        >
          {slots.map((p) => {
            const pop = Number(p.pop) || 0;
            const highlight = timeSlotStyle(pop, /* inverse */ true);
            return (
              <div
                key={`${p.fcst_date}${p.fcst_time}`}
                className={`rounded-lg backdrop-blur px-2 py-2 ${highlight}`}
              >
                <div className="text-xs text-indigo-100">
                  {formatTime(p.fcst_time)}
                </div>
                {p.tmp && (
                  <div className="mt-1 text-base font-semibold">{p.tmp}°</div>
                )}
                {p.sky && (
                  <div className="text-[10px] text-indigo-100 mt-0.5">
                    {p.sky}
                  </div>
                )}
                {p.pop && p.pop !== "0" && (
                  <div
                    className={`text-[10px] ${
                      pop >= 80
                        ? "text-white font-bold"
                        : pop >= 50
                        ? "text-amber-100 font-semibold"
                        : "text-indigo-200"
                    }`}
                  >
                    {pop >= 50 ? "☂" : "💧"} {p.pop}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DayCard({ day }: { day: DayForecast }) {
  const slots = sample3Hours(day);
  const bgClass = dayBgClass(day.umbrella);
  return (
    <div className={`rounded-xl border p-5 transition-colors ${bgClass}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold">
          {formatKoreanDate(day.date)}
        </h3>
        <div className="flex items-center gap-2">
          <UmbrellaBadge
            level={day.umbrella}
            popPercent={day.max_pop}
            variant="outline"
          />
          <div className="text-sm text-zinc-600">
            {day.tmin && day.tmax
              ? `${day.tmin}° / ${day.tmax}°`
              : day.summary}
          </div>
        </div>
      </div>
      {slots.length > 0 && (
        <div
          className="mt-3 grid gap-2 text-center"
          style={{
            gridTemplateColumns: `repeat(${Math.min(slots.length, 8)}, minmax(0, 1fr))`,
          }}
        >
          {slots.map((p) => {
            const pop = Number(p.pop) || 0;
            const highlight = timeSlotStyle(pop, /* inverse */ false);
            return (
              <div
                key={`${p.fcst_date}${p.fcst_time}`}
                className={`rounded-lg px-2 py-2 ${highlight}`}
              >
                <div className="text-xs text-zinc-500">
                  {formatTime(p.fcst_time)}
                </div>
                {p.tmp && (
                  <div className="mt-1 text-sm font-semibold">{p.tmp}°</div>
                )}
                {p.sky && (
                  <div className="text-[10px] text-zinc-500 mt-0.5">{p.sky}</div>
                )}
                {p.pop && p.pop !== "0" && (
                  <div
                    className={`text-[10px] ${
                      pop >= 80
                        ? "text-red-700 font-bold"
                        : pop >= 50
                        ? "text-amber-700 font-semibold"
                        : "text-indigo-600"
                    }`}
                  >
                    {pop >= 50 ? "☂" : "💧"} {p.pop}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function outfitFor(tmax: string | null | undefined, tmin: string | null | undefined): {
  headline: string;
  items: string[];
  tone: "hot" | "warm" | "mild" | "cool" | "cold" | "freeze";
} {
  const t = Number(tmax);
  if (Number.isNaN(t)) {
    return { headline: "기온 정보 준비 중", items: [], tone: "mild" };
  }
  if (t >= 28) {
    return {
      headline: "많이 덥습니다",
      items: ["민소매·반팔", "린넨 셔츠", "반바지·얇은 원피스", "선크림"],
      tone: "hot",
    };
  }
  if (t >= 23) {
    return {
      headline: "따뜻합니다",
      items: ["반팔", "얇은 셔츠", "면바지·긴바지"],
      tone: "warm",
    };
  }
  if (t >= 20) {
    return {
      headline: "선선합니다",
      items: ["긴팔 티", "얇은 니트·가디건", "긴바지"],
      tone: "mild",
    };
  }
  if (t >= 17) {
    return {
      headline: "쌀쌀합니다",
      items: ["니트", "얇은 자켓", "가벼운 아우터"],
      tone: "cool",
    };
  }
  if (t >= 12) {
    return {
      headline: "가벼운 겉옷 필요",
      items: ["자켓·트렌치코트", "니트", "청바지·기모 바지"],
      tone: "cool",
    };
  }
  if (t >= 9) {
    return {
      headline: "쌀쌀하고 두꺼운 겉옷 권장",
      items: ["트렌치코트", "야상·점퍼", "니트"],
      tone: "cold",
    };
  }
  if (t >= 5) {
    return {
      headline: "춥습니다",
      items: ["코트", "가죽 자켓", "니트·기모 바지"],
      tone: "cold",
    };
  }
  return {
    headline: "많이 춥습니다",
    items: ["패딩·두꺼운 코트", "기모 니트", "목도리·장갑·모자"],
    tone: "freeze",
  };
}

function OutfitTip({ day, label = "오늘의 옷차림" }: { day: DayForecast; label?: string }) {
  const outfit = outfitFor(day.tmax, day.tmin);
  if (outfit.items.length === 0) return null;

  const toneClass = {
    hot: "from-red-500 to-orange-500 text-white",
    warm: "from-orange-400 to-amber-400 text-white",
    mild: "from-emerald-400 to-teal-500 text-white",
    cool: "from-sky-400 to-indigo-500 text-white",
    cold: "from-indigo-500 to-blue-700 text-white",
    freeze: "from-blue-700 to-slate-900 text-white",
  }[outfit.tone];

  const rainNote =
    day.max_pop >= 60
      ? "☂ 우산 필수 · 방수 신발 권장"
      : day.max_pop >= 30
        ? "☂ 우산 챙기기"
        : null;

  return (
    <section
      aria-label="오늘의 옷차림 추천"
      className={`rounded-2xl bg-gradient-to-br ${toneClass} p-5 sm:p-6 shadow-sm`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider opacity-80">
          {label}
        </div>
        {day.tmax && day.tmin && (
          <div className="text-xs opacity-80">
            {day.tmin}° / {day.tmax}°
          </div>
        )}
      </div>
      <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight">
        {outfit.headline}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {outfit.items.map((it) => (
          <span
            key={it}
            className="inline-flex items-center rounded-full bg-white/20 backdrop-blur px-3 py-1 text-sm font-medium"
          >
            {it}
          </span>
        ))}
      </div>
      {rainNote && (
        <div className="mt-3 text-sm font-medium opacity-95 border-t border-white/20 pt-3">
          {rainNote}
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
      <p className="text-zinc-600">
        아직 데이터가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.
      </p>
    </div>
  );
}
