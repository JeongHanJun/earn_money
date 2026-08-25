import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "..", "data", "weather");

/**
 * 기상청 카테고리 코드.
 * 활용가이드: docs/api_reference/weather/weather_api_guide.docx
 */
export const CATEGORY_LABEL: Record<string, string> = {
  POP: "강수확률",
  PTY: "강수형태",
  PCP: "강수량",
  REH: "습도",
  SNO: "적설량",
  SKY: "하늘상태",
  TMP: "기온",
  TMN: "일 최저기온",
  TMX: "일 최고기온",
  UUU: "동서바람성분",
  VVV: "남북바람성분",
  WAV: "파고",
  VEC: "풍향",
  WSD: "풍속",
};

const SKY_MAP: Record<string, string> = {
  "1": "맑음",
  "3": "구름많음",
  "4": "흐림",
};

const PTY_MAP: Record<string, string> = {
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

/**
 * 특정 시점(YYYYMMDD + HHMM)의 예보를 카테고리별로 pivot.
 */
export type TimePointForecast = {
  fcst_date: string;
  fcst_time: string;
  tmp?: string;      // 기온
  sky?: string;      // 하늘상태 (한글 라벨)
  pty?: string;      // 강수형태 (한글 라벨)
  pop?: string;      // 강수확률 %
  reh?: string;      // 습도 %
  wsd?: string;      // 풍속 m/s
  pcp?: string;      // 강수량
  tmn?: string;      // 최저기온 (일별)
  tmx?: string;      // 최고기온 (일별)
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

/**
 * 하루씩 그룹핑: [{date, points: TimePointForecast[]}, ...]
 */
export type UmbrellaLevel = "essential" | "recommended" | "optional" | "none";

export type DayForecast = {
  date: string;
  points: TimePointForecast[];
  tmin?: string;
  tmax?: string;
  summary?: string;
  max_pop: number;              // 하루 중 최대 강수확률 %
  umbrella: UmbrellaLevel;      // 80+ essential / 50+ recommended / 30+ optional / none
};

export function umbrellaLevelFor(popPercent: number): UmbrellaLevel {
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
 * 3시간 간격 슬롯. 기상청 단기예보는 시간별로 오지만 표시는 3시간 간격이 더 직관적.
 */
const THREE_HOUR_SLOTS = [
  "0000", "0300", "0600", "0900", "1200", "1500", "1800", "2100",
];

/**
 * 하루 예보를 3시간 간격으로 샘플링. 오늘처럼 이미 지난 시간대 없는 경우 자연스럽게 축소.
 */
export function sample3Hours(day: DayForecast): TimePointForecast[] {
  return THREE_HOUR_SLOTS
    .map((h) => day.points.find((p) => p.fcst_time === h))
    .filter((p): p is TimePointForecast => Boolean(p));
}

export function groupByDay(points: TimePointForecast[]): DayForecast[] {
  const map = new Map<string, DayForecast>();
  for (const p of points) {
    if (!map.has(p.fcst_date)) {
      map.set(p.fcst_date, {
        date: p.fcst_date,
        points: [],
        max_pop: 0,
        umbrella: "none",
      });
    }
    const day = map.get(p.fcst_date)!;
    day.points.push(p);
    if (p.tmn) day.tmin = p.tmn;
    if (p.tmx) day.tmax = p.tmx;
  }
  for (const day of map.values()) {
    // 낮 시간대 하늘상태
    const noonish = day.points.find(
      (p) => p.fcst_time >= "0900" && p.fcst_time <= "1500" && p.sky
    );
    day.summary = noonish?.sky;
    // 하루 최대 강수확률
    day.max_pop = day.points.reduce((max, p) => {
      const n = Number(p.pop);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    day.umbrella = umbrellaLevelFor(day.max_pop);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function loadWeather(sidoSlug: string, muniSlug: string): RawForecast {
  const file = path.join(DATA_DIR, sidoSlug, `${muniSlug}.json`);
  const text = fs.readFileSync(file, "utf-8");
  return JSON.parse(text) as RawForecast;
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
