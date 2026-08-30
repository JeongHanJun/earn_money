"use client";

import { useEffect, useRef, useState } from "react";

type Region = { s: string; m: string; n: string; p: string; la: number; lo: number };
type Index = { regions: Region[] };

type Status =
  | { kind: "idle" }
  | { kind: "prompt" } // 권한 요청 중
  | { kind: "matching" } // 좌표 매칭 중
  | { kind: "matched"; sido: string; sigungu: string; name: string; province: string }
  | { kind: "error"; message: string };

const CACHE_KEY = "myloc_v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

type CachedMatch = {
  ts: number;
  sido: string;
  sigungu: string;
  name: string;
  province: string;
};

function readCache(): CachedMatch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedMatch;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(m: Omit<CachedMatch, "ts">) {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...m, ts: Date.now() })
    );
  } catch {
    // ignore quota / private mode
  }
}

// Haversine 거리 (m 단위). 근접 매칭이라 정확도 중요 X, 그러나 정확한 값을 씀.
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function loadIndex(): Promise<Index> {
  const res = await fetch("/weather-index.json");
  if (!res.ok) throw new Error("weather-index.json 로드 실패");
  return (await res.json()) as Index;
}

function findNearest(index: Index, lat: number, lon: number): Region | null {
  let best: Region | null = null;
  let bestDist = Infinity;
  for (const r of index.regions) {
    const d = haversineMeters(lat, lon, r.la, r.lo);
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return best;
}

export function MyLocationButton() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [cached, setCached] = useState<CachedMatch | null>(null);
  const indexRef = useRef<Index | null>(null);

  useEffect(() => {
    setCached(readCache());
  }, []);

  const findMyLocation = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatus({ kind: "error", message: "이 브라우저는 위치 서비스를 지원하지 않습니다." });
      return;
    }
    setStatus({ kind: "prompt" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setStatus({ kind: "matching" });
        try {
          if (!indexRef.current) {
            indexRef.current = await loadIndex();
          }
          const nearest = findNearest(indexRef.current, pos.coords.latitude, pos.coords.longitude);
          if (!nearest) {
            setStatus({ kind: "error", message: "가까운 지역을 찾지 못했습니다." });
            return;
          }
          const match: Omit<CachedMatch, "ts"> = {
            sido: nearest.s,
            sigungu: nearest.m,
            name: nearest.n,
            province: nearest.p,
          };
          writeCache(match);
          setCached({ ...match, ts: Date.now() });
          setStatus({ kind: "matched", ...match });
          window.location.href = `/weather/${nearest.s}/${nearest.m}`;
        } catch (err) {
          setStatus({
            kind: "error",
            message: err instanceof Error ? err.message : "매칭 실패",
          });
        }
      },
      (err) => {
        const map: Record<number, string> = {
          1: "위치 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.",
          2: "현재 위치를 확인할 수 없습니다.",
          3: "위치 확인 시간이 초과되었습니다.",
        };
        setStatus({ kind: "error", message: map[err.code] ?? "위치 확인 실패" });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const busy = status.kind === "prompt" || status.kind === "matching";

  return (
    <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5 text-sky-600"
              aria-hidden
            >
              <path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="text-sm font-semibold text-sky-900">내 위치 날씨</span>
          </div>
          {cached ? (
            <p className="mt-1 text-xs text-sky-800">
              최근:{" "}
              <a
                href={`/weather/${cached.sido}/${cached.sigungu}`}
                className="font-semibold underline hover:text-sky-900"
              >
                {cached.province} {cached.name}
              </a>
              <span className="ml-1 text-sky-700/70">
                · 6시간 동안 저장
              </span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-sky-800/80">
              GPS로 가까운 시군구를 자동으로 찾아드립니다.
            </p>
          )}
          {status.kind === "error" && (
            <p className="mt-2 text-xs text-rose-700">{status.message}</p>
          )}
        </div>

        <button
          type="button"
          onClick={findMyLocation}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-progress disabled:bg-sky-400"
        >
          {status.kind === "prompt" && (
            <>
              <Spinner /> 권한 확인 중…
            </>
          )}
          {status.kind === "matching" && (
            <>
              <Spinner /> 지역 검색 중…
            </>
          )}
          {(status.kind === "idle" || status.kind === "matched" || status.kind === "error") && (
            <>📍 {cached ? "위치 다시 확인" : "내 위치 찾기"}</>
          )}
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
