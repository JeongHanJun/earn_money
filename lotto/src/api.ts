// 공통 fetch 헬퍼. 개발 시 wrangler dev(8787)로 프록시, 프로덕션은 same-origin.

const isDev = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const API_BASE = isDev ? "http://localhost:8787" : "";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

export interface Draw {
  drw_no: number;
  drw_date: string;
  n1: number; n2: number; n3: number; n4: number; n5: number; n6: number;
  bonus: number;
  first_amt: number | null;
  first_cnt: number | null;
  total_sales: number | null;
}

export interface FrequencyRow {
  n: number;
  cnt: number;
}

export interface TopStoreRow {
  store_id: number;
  name: string;
  addr: string;
  sido: string | null;
  sigungu: string | null;
  lat: number | null;
  lng: number | null;
  rank1_cnt: number;
  rank2_cnt: number;
  total_cnt: number;
}

export interface RegionRow {
  sido: string;
  sigungu: string;
  rank1_cnt: number;
  rank2_cnt: number;
  total_cnt: number;
}

export interface DrawStore {
  rank: number;
  method: "auto" | "manual" | "semi" | null;
  store_id: number;
  name: string;
  addr: string;
  sido: string | null;
  sigungu: string | null;
  lat: number | null;
  lng: number | null;
}

export interface SimulationsMeta {
  total: number;
  jackpots: number;
  distribution: { rank: number; c: number }[];
}
