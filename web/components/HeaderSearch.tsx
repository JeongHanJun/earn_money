"use client";

import { usePathname } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";
import { TrendsSearchBar } from "@/components/TrendsSearchBar";
import { WeatherSearchBar } from "@/components/WeatherSearchBar";

/**
 * pathname 기반으로 적절한 검색바 렌더:
 * - /weather* → 지역 검색 (250 시·군·구)
 * - /trends*  → 트렌드 키워드 검색 (7개국 급상승 + YouTube)
 * - 그 외    → 정책·지원금 검색 (welfare + youth)
 */
export function HeaderSearch() {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/weather")) return <WeatherSearchBar />;
  if (pathname.startsWith("/trends")) return <TrendsSearchBar />;
  return <SearchBar />;
}
