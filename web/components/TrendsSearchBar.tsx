"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Item = {
  c: string;   // country code
  cn: string;  // country name
  k: string;   // keyword
  r: number;   // rank
  tr?: string; // traffic (trends only)
  ch?: string; // channel (youtube only)
  vid?: string; // video_id (youtube only)
  t: "trend" | "youtube";
};
type Index = { items: Item[] };
type Result = {
  href: string;
  external: boolean;
  keyword: string;
  country: string;
  countryCode: string;
  rank: number;
  type: "trend" | "youtube";
  meta?: string;
  score: number;
};

const MAX_RESULTS = 10;

export function TrendsSearchBar() {
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
      const res = await fetch("/trends-index.json");
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
    for (const it of index.items) {
      const kw = it.k.toLowerCase();
      const cn = it.cn.toLowerCase();
      let score = 0;
      if (kw.startsWith(q)) score += 10;
      else if (kw.includes(q)) score += 6;
      if (cn.includes(q)) score += 3;
      if (it.ch && it.ch.toLowerCase().includes(q)) score += 4;
      // 순위 boost (rank 1이 rank 10보다 우선)
      if (score > 0) {
        score += Math.max(0, 3 - Math.floor(it.r / 5));
        const isYoutube = it.t === "youtube" && it.vid;
        merged.push({
          href: isYoutube
            ? `https://www.youtube.com/watch?v=${it.vid}`
            : `/trends/${it.c}/hot`,
          external: Boolean(isYoutube),
          keyword: it.k,
          country: it.cn,
          countryCode: it.c,
          rank: it.r,
          type: it.t,
          meta: it.t === "youtube" ? it.ch : it.tr,
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
      const r = results[activeIdx];
      if (r.external) window.open(r.href, "_blank");
      else window.location.href = r.href;
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
          className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-rose-500"
        >
          <path
            d="M3 17l6-6 4 4 8-8M14 7h7v7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="트렌드 검색 (예: AI, 선거, K-pop)"
          onFocus={() => {
            setOpen(true);
            loadIndex();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl border border-zinc-300 bg-white pl-11 pr-4 py-3 text-sm sm:text-base shadow-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-200 focus:outline-none transition-colors"
          aria-label="트렌드 키워드 검색"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
          {loading && <div className="px-4 py-3 text-sm text-zinc-500">트렌드 로드 중…</div>}
          {!loading && query.trim().length === 0 && (
            <div className="px-4 py-3 text-sm text-zinc-500">키워드를 입력해주세요.</div>
          )}
          {!loading && query.trim().length > 0 && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-zinc-500">
              &lsquo;{query}&rsquo; 관련 트렌드가 현재 없습니다.
            </div>
          )}
          {!loading && results.length > 0 && (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-zinc-100">
              {results.map((r, i) => {
                const external = r.external;
                return (
                  <li key={`${r.countryCode}-${r.type}-${i}`}>
                    {external ? (
                      <a
                        href={r.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setOpen(false)}
                        className={`block px-4 py-3 hover:bg-rose-50 transition-colors ${
                          i === activeIdx ? "bg-rose-50" : ""
                        }`}
                      >
                        <ResultRow r={r} />
                      </a>
                    ) : (
                      <Link
                        href={r.href}
                        onClick={() => setOpen(false)}
                        className={`block px-4 py-3 hover:bg-rose-50 transition-colors ${
                          i === activeIdx ? "bg-rose-50" : ""
                        }`}
                      >
                        <ResultRow r={r} />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ r }: { r: Result }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`shrink-0 mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
          r.type === "youtube"
            ? "bg-red-50 text-red-700 border border-red-200"
            : "bg-rose-50 text-rose-700 border border-rose-200"
        }`}
      >
        {r.type === "youtube" ? "YouTube" : "급상승"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-zinc-900 line-clamp-1">
          {r.keyword}
        </div>
        <div className="text-[11px] text-zinc-500">
          {r.country} · #{r.rank}
          {r.meta && ` · ${r.meta}`}
        </div>
      </div>
    </div>
  );
}
