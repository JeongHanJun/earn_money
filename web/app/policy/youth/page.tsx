import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { YouthCard } from "@/components/YouthCard";
import {
  allYouthPolicies,
  popularYouthPolicies,
  recentYouthPolicies,
  youthCategorySlug,
  youthPoliciesByCategory,
  type YouthPolicy,
} from "@/lib/youth";

export const metadata: Metadata = {
  title: "청년정책",
  description:
    "온통청년 기반 청년정책 2,700+개. 일자리·주거·교육·복지 카테고리별 필터. 각 정책마다 실 신청 링크 제공.",
};

export default function YouthLanding() {
  const total = allYouthPolicies().length;
  const categoryMap = youthPoliciesByCategory();
  const categories = Array.from(categoryMap.entries())
    .map(([cat, list]) => ({ cat, count: list.length }))
    .sort((a, b) => b.count - a.count);
  const popular = popularYouthPolicies(6);
  const recent = recentYouthPolicies(6);

  return (
    <div className="space-y-10">
      <nav className="text-sm text-zinc-500">
        <Link href="/policy" className="hover:text-zinc-900">
          정책·지원금
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900">청년정책</span>
      </nav>

      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          <span
            className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"
            aria-hidden
          />
          매일 갱신 · 총 {total.toLocaleString()}개 정책
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          청년정책
        </h1>
        <p className="mt-2 text-zinc-600 leading-7">
          온통청년 기반 · 일자리·주거·교육·복지·참여 5개 분야 ·
          <strong className="text-zinc-900"> 각 정책마다 실 신청 링크</strong>.
        </p>
        <div className="mt-5 max-w-2xl">
          <SearchBar placeholder="청년정책 검색 (예: 주거, 창업, 취업지원)" />
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-3">분야별</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {categories.map((c) => (
            <Link
              key={c.cat}
              href={`/policy/youth/category/${youthCategorySlug(c.cat)}`}
              className="rounded-lg border border-zinc-200 bg-white p-3 hover:border-amber-400 hover:bg-amber-50/40 transition-colors"
            >
              <div className="text-sm font-medium text-zinc-900">{c.cat}</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {c.count}개
              </div>
            </Link>
          ))}
        </div>
      </section>

      <YouthList title="인기 정책" policies={popular} />
      <YouthList title="최근 등록" policies={recent} />

      <p className="text-xs text-zinc-500 text-center">
        출처: 온통청년 (youthcenter.go.kr) · 실제 신청은 각 정책의 원문 링크
      </p>
    </div>
  );
}

function YouthList({
  title,
  policies,
}: {
  title: string;
  policies: YouthPolicy[];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight mb-3">{title}</h2>
      <div className="grid gap-3">
        {policies.map((p) => (
          <YouthCard key={p.plcy_no} policy={p} />
        ))}
      </div>
    </section>
  );
}

