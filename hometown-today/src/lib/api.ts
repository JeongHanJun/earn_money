/**
 * 데이터 페치 wrapper.
 * API_BASE는 Vite 환경변수 VITE_API_BASE로 주입 (배포 시 CF Workers 도메인).
 * 개발 단계에는 로컬 fixtures/에 mock JSON을 두고 상대 경로 페치.
 */
import type { RawForecast } from "./weather";
import type { YouthPolicy } from "./youth";
import type { CountryTrends } from "./trends";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function json<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`fetch failed: ${path} ${res.status}`);
  return (await res.json()) as T;
}

export function fetchWeather(sidoSlug: string, muniSlug: string): Promise<RawForecast> {
  return json<RawForecast>(`/api/weather/${sidoSlug}/${muniSlug}.json`);
}

/**
 * 원본 파일 스키마: { fetched_at, data: { total_count, count, items } }.
 * 데이터 서빙 API도 이 스키마를 그대로 노출 예정 → 여기서 items만 언랩.
 */
type YouthRaw = {
  fetched_at: string;
  data: { total_count: number; count: number; items: YouthPolicy[] };
};

export async function fetchYouth(): Promise<{ items: YouthPolicy[]; fetched_at: string }> {
  const raw = await json<YouthRaw>(`/api/youth.json`);
  return { items: raw.data.items, fetched_at: raw.fetched_at };
}

export function fetchTrends(): Promise<CountryTrends> {
  return json<CountryTrends>(`/api/trends/kr.json`);
}
