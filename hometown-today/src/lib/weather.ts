/**
 * 기상청 단기예보 순수 로직. web/lib/weather.ts에서 fs 의존 제거 후 이식.
 * 데이터 로딩은 api.ts의 fetchWeather()로 분리.
 */

export const SKY_MAP: Record<string, string> = {
  "1": "맑음",
  "3": "구름많음",
  "4": "흐림",
};

export const PTY_MAP: Record<string, string> = {
  "0": "없음",
  "1": "비",
  "2": "비/눈",
  "3": "눈",
  "4": "소나기",
};

export type RawForecastItem = {
  base_date: string;
  base_time: string;
  fcst_date: string;
  fcst_time: string;
  category: string;
  fcst_value: string;
  nx: number;
  ny: number;
};

export type RawForecast = {
  fetched_at: string;
  data: {
    grid: { nx: number; ny: number };
    base_date: string;
    base_time: string;
    count: number;
    items: RawForecastItem[];
  };
};

export type TimePointForecast = {
  fcst_date: string;
  fcst_time: string;
  tmp?: string;
  sky?: string;
  pty?: string;
  pop?: string;
  reh?: string;
  wsd?: string;
  pcp?: string;
  tmn?: string;
  tmx?: string;
};

export function pivotByTime(items: RawForecastItem[]): TimePointForecast[] {
  const map = new Map<string, TimePointForecast>();
  for (const it of items) {
    const key = `${it.fcst_date}-${it.fcst_time}`;
    if (!map.has(key)) {
      map.set(key, { fcst_date: it.fcst_date, fcst_time: it.fcst_time });
    }
    const point = map.get(key)!;
    switch (it.category) {
      case "TMP":
        point.tmp = it.fcst_value;
        break;
      case "SKY":
        point.sky = SKY_MAP[it.fcst_value] ?? it.fcst_value;
        break;
      case "PTY":
        point.pty = PTY_MAP[it.fcst_value] ?? it.fcst_value;
        break;
      case "POP":
        point.pop = it.fcst_value;
        break;
      case "REH":
        point.reh = it.fcst_value;
        break;
      case "WSD":
        point.wsd = it.fcst_value;
        break;
      case "PCP":
        point.pcp = it.fcst_value;
        break;
      case "TMN":
        point.tmn = it.fcst_value;
        break;
      case "TMX":
        point.tmx = it.fcst_value;
        break;
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const ka = a.fcst_date + a.fcst_time;
    const kb = b.fcst_date + b.fcst_time;
    return ka.localeCompare(kb);
  });
}

export type UmbrellaLevel = "essential" | "recommended" | "optional" | "none";

export type DayForecast = {
  date: string;
  points: TimePointForecast[];
  tmin?: string;
  tmax?: string;
  summary?: string;
  max_pop: number;
  has_actual_precip: boolean;
  umbrella: UmbrellaLevel;
};

/**
 * 우산 필요도 판정. 실측 강수(PTY)를 우선하고, 확률(POP)로 보완.
 * POP 단독 판정은 실제 비 와도 60% 유지되는 케이스가 흔해 과소 판정됨.
 */
export function umbrellaLevelFor(
  popPercent: number,
  hasActualPrecip = false,
): UmbrellaLevel {
  if (hasActualPrecip) return "essential";
  if (popPercent >= 80) return "essential";
  if (popPercent >= 50) return "recommended";
  if (popPercent >= 30) return "optional";
  return "none";
}

export function umbrellaLabel(level: UmbrellaLevel): string {
  switch (level) {
    case "essential":
      return "우산 필수!";
    case "recommended":
      return "우산 지참 권고";
    case "optional":
      return "우산 지참 고려";
    default:
      return "";
  }
}

/**
 * 현재 시각 기준 가장 가까운 과거 슬롯. KST 분 계산으로 tz 무관.
 */
export function pickNowSlot(
  points: TimePointForecast[],
  now: Date = new Date(),
): TimePointForecast | undefined {
  const withTmp = points.filter((p) => p.tmp);
  if (withTmp.length === 0) return points[0];
  const kstMin = (now.getTime() / 60000 + 9 * 60) % (24 * 60);
  const past = withTmp
    .map((p) => ({
      p,
      mins: Number(p.fcst_time.slice(0, 2)) * 60 + Number(p.fcst_time.slice(2)),
    }))
    .filter(({ mins }) => mins <= kstMin);
  if (past.length === 0) return withTmp[0];
  return past.reduce((best, cur) => (cur.mins > best.mins ? cur : best)).p;
}

export function groupByDay(points: TimePointForecast[]): DayForecast[] {
  const map = new Map<string, DayForecast>();
  for (const p of points) {
    if (!map.has(p.fcst_date)) {
      map.set(p.fcst_date, {
        date: p.fcst_date,
        points: [],
        max_pop: 0,
        has_actual_precip: false,
        umbrella: "none",
      });
    }
    const day = map.get(p.fcst_date)!;
    day.points.push(p);
    if (p.tmn) day.tmin = p.tmn;
    if (p.tmx) day.tmax = p.tmx;
  }
  for (const day of map.values()) {
    const noonish = day.points.find(
      (p) => p.fcst_time >= "0900" && p.fcst_time <= "1500" && p.sky,
    );
    day.summary = noonish?.sky;
    day.max_pop = day.points.reduce((max, p) => {
      const n = Number(p.pop);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    day.has_actual_precip = day.points.some(
      (p) => p.pty && p.pty !== "없음",
    );
    day.umbrella = umbrellaLevelFor(day.max_pop, day.has_actual_precip);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function formatKoreanDate(yyyymmdd: string): string {
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  const date = new Date(`${y}-${m}-${d}`);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${Number(m)}/${Number(d)} (${dow})`;
}

export function formatTime(hhmm: string): string {
  return `${hhmm.slice(0, 2)}시`;
}
