"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Region = { s: string; m: string; n: string; p: string };
type Index = { regions: Region[] };
type Result = { sido: string; sigungu: string; name: string; province: string; href: string; score: number };

const MAX_RESULTS = 10;

export function WeatherSearchBar() {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<Index | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadIndex = async () => {
    if (index || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/weather-index.json");
      const data = (await res.json()) as Index;
      setIndex(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!query.trim() || !index) {
      setResults([]);
      setActiveIdx(-1);
      return;
    }
    const q = query.trim().toLowerCase();
    const merged: Result[] = [];
    for (const r of index.regions) {
      const name = r.n.toLowerCase();
      const province = r.p.toLowerCase();
      let score = 0;
      if (name.startsWith(q)) score += 10;
      else if (name.includes(q)) score += 6;
      if (province.startsWith(q)) score += 5;
      else if (province.includes(q)) score += 3;
      // "서울 종로" 처럼 결합 검색 지원
      if (`${province} ${name}`.includes(q)) score += 2;
      if (score > 0) {
        merged.push({
          sido: r.s,
          sigungu: r.m,
          name: r.n,
          province: r.p,
          href: `/weather/${r.s}/${r.m}`,
          score,
        });
      }
    }
    merged.sort((a, b) => b.score - a.score);
    setResults(merged.slice(0, MAX_RESULTS));
    setActiveIdx(-1);
  }, [query, index]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      window.location.href = results[activeIdx].href;
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showDropdown = open && (loading || query.trim().length > 0);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-sky-500"
        >
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="지역 검색 (예: 서울 종로, 부산, 제주)"
          onFocus={() => {
            setOpen(true);
            loadIndex();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl border border-zinc-300 bg-white pl-11 pr-4 py-3 text-sm sm:text-base shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none transition-colors"
          aria-label="날씨 지역 검색"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
          {loading && <div className="px-4 py-3 text-sm text-zinc-500">지역 목록 로드 중…</div>}
          {!loading && query.trim().length === 0 && (
            <div className="px-4 py-3 text-sm text-zinc-500">지역 이름을 입력해주세요.</div>
          )}
          {!loading && query.trim().length > 0 && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-zinc-500">
              &lsquo;{query}&rsquo; 에 대한 지역이 없습니다.
            </div>
          )}
          {!loading && results.length > 0 && (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-zinc-100">
              {results.map((r, i) => (
                <li key={`${r.sido}-${r.sigungu}`}>
                  <Link
                    href={r.href}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 hover:bg-sky-50 transition-colors ${
                      i === activeIdx ? "bg-sky-50" : ""
                    }`}
                  >
                    <div className="text-sm font-semibold text-zinc-900">{r.name}</div>
                    <div className="text-xs text-zinc-500">{r.province}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
