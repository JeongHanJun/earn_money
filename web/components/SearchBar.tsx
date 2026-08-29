"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type WelfareItem = { i: string; n: string; s: string; d: string; t: string };
type YouthItem = {
  i: string;
  n: string;
  s: string;
  d: string;
  k: string;
  c: string;
};

type Index = {
  welfare: WelfareItem[];
  youth: YouthItem[];
};

type Result = {
  type: "welfare" | "youth";
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  href: string;
  score: number;
};

const MAX_RESULTS = 10;

/**
 * Client-side search across welfare + youth policies.
 * Index loads lazily on first focus (~150-300 KB gzipped).
 * Substring match with soft scoring — sufficient for 3K items.
 */
export function SearchBar({
  placeholder = "정책·지원금 검색 (예: 청년 주거, 의료비 지원)",
  autoFocus = false,
}: {
  placeholder?: string;
  autoFocus?: boolean;
}) {
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
      const res = await fetch("/search-index.json");
      const data = (await res.json()) as Index;
      setIndex(data);
    } catch {
      // fail silent — user can still navigate via menus
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
    const tokens = q.split(/\s+/).filter(Boolean);

    const scoreWelfare = (it: WelfareItem): number => {
      let score = 0;
      const name = it.n.toLowerCase();
      const summary = it.s.toLowerCase();
      const dept = it.d.toLowerCase();
      const topics = it.t.toLowerCase();
      for (const tk of tokens) {
        if (name.includes(tk)) score += name.startsWith(tk) ? 10 : 6;
        if (summary.includes(tk)) score += 2;
        if (dept.includes(tk)) score += 1;
        if (topics.includes(tk)) score += 3;
      }
      return score;
    };
    const scoreYouth = (it: YouthItem): number => {
      let score = 0;
      const name = it.n.toLowerCase();
      const summary = it.s.toLowerCase();
      const dept = it.d.toLowerCase();
      const kw = it.k.toLowerCase();
      const cat = it.c.toLowerCase();
      for (const tk of tokens) {
        if (name.includes(tk)) score += name.startsWith(tk) ? 10 : 6;
        if (summary.includes(tk)) score += 2;
        if (dept.includes(tk)) score += 1;
        if (kw.includes(tk)) score += 4;
        if (cat.includes(tk)) score += 3;
      }
      return score;
    };

    const merged: Result[] = [];
    for (const it of index.welfare) {
      const s = scoreWelfare(it);
      if (s > 0)
        merged.push({
          type: "welfare",
          id: it.i,
          title: it.n,
          subtitle: it.s,
          meta: it.d,
          href: `/policy/${it.i}`,
          score: s,
        });
    }
    for (const it of index.youth) {
      const s = scoreYouth(it);
      if (s > 0)
        merged.push({
          type: "youth",
          id: it.i,
          title: it.n,
          subtitle: it.s,
          meta: it.d || it.c,
          href: `/policy/youth/${it.i}`,
          score: s,
        });
    }
    merged.sort((a, b) => b.score - a.score);
    setResults(merged.slice(0, MAX_RESULTS));
    setActiveIdx(-1);
  }, [query, index]);

  // click outside → close
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
          className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400"
        >
          <circle
            cx="11"
            cy="11"
            r="7"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M20 20l-3.5-3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onFocus={() => {
            setOpen(true);
            loadIndex();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl border border-zinc-300 bg-white pl-11 pr-4 py-3 text-sm sm:text-base shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-colors"
          aria-label="정책·지원금 검색"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
          {loading && (
            <div className="px-4 py-3 text-sm text-zinc-500">
              검색 준비 중…
            </div>
          )}
          {!loading && query.trim().length === 0 && (
            <div className="px-4 py-3 text-sm text-zinc-500">
              검색어를 입력해주세요.
            </div>
          )}
          {!loading && query.trim().length > 0 && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-zinc-500">
              &lsquo;{query}&rsquo; 에 대한 결과가 없습니다.
            </div>
          )}
          {!loading && results.length > 0 && (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-zinc-100">
              {results.map((r, i) => (
                <li key={`${r.type}-${r.id}`}>
                  <Link
                    href={r.href}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 hover:bg-zinc-50 transition-colors ${
                      i === activeIdx ? "bg-zinc-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`shrink-0 mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          r.type === "welfare"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {r.type === "welfare" ? "복지" : "청년"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-zinc-900 leading-snug line-clamp-1">
                          {r.title}
                        </div>
                        {r.subtitle && (
                          <div className="mt-0.5 text-xs text-zinc-500 line-clamp-1">
                            {r.subtitle}
                          </div>
                        )}
                        {r.meta && (
                          <div className="mt-1 text-[11px] text-zinc-400">
                            {r.meta}
                          </div>
                        )}
                      </div>
                    </div>
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
