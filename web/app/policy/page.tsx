import type { Metadata } from "next";
import Link from "next/link";
import { ServiceCard } from "@/components/ServiceCard";
import {
  allServices,
  popularServices,
  recentServices,
  servicesByTopic,
  topicSlug,
} from "@/lib/policy";
import type { WelfareService } from "@/lib/policy";
import { allYouthPolicies } from "@/lib/youth";

export const metadata: Metadata = {
  title: "정책·지원금",
  description:
    "중앙부처 복지서비스 461개. 관심주제·생애주기별 필터. 원문 링크 상단 배치, 신청 조건과 담당부처 정보 완비.",
};

export default function PolicyLanding() {
  const total = allServices().length;
  const youthTotal = allYouthPolicies().length;
  const topicMap = servicesByTopic();
  const topics = Array.from(topicMap.entries())
    .map(([topic, list]) => ({ topic, count: list.length }))
    .sort((a, b) => b.count - a.count);
  const popular = popularServices(6);
  const recent = recentServices(6);

  return (
    <div className="space-y-10">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          <span
            className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"
            aria-hidden
          />
          매일 갱신 · 중앙부처 복지 {total.toLocaleString()}개 · 청년정책 {youthTotal.toLocaleString()}개
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          정책·지원금
        </h1>
        <p className="mt-2 text-zinc-600 leading-7">
          공공데이터 API 기반 · <strong className="text-zinc-900">각 정책마다 실 신청 링크</strong> ·
          신청 조건, 담당부처, 자격 요건까지 한눈에.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/policy/youth"
          className="group block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-amber-400 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-amber-100 text-amber-700">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                <path
                  d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              {youthTotal.toLocaleString()}개
            </span>
          </div>
          <div className="mt-4 text-lg font-semibold tracking-tight">
            청년정책
          </div>
          <div className="mt-1 text-sm text-zinc-600 leading-6">
            일자리·주거·교육·복지 등 청년 대상 정책. 각 정책마다 실 신청 링크.
          </div>
        </Link>
        <a
          href="#topics"
          className="group block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-indigo-100 text-indigo-700">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                <path
                  d="M4 7h16M4 12h16M4 17h10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
              {total.toLocaleString()}개
            </span>
          </div>
          <div className="mt-4 text-lg font-semibold tracking-tight">
            중앙부처 복지
          </div>
          <div className="mt-1 text-sm text-zinc-600 leading-6">
            보건복지부·성평등가족부 등 부처별 복지서비스.
            관심주제로 찾기 ↓
          </div>
        </a>
      </section>

      <section id="topics" className="scroll-mt-16">
        <h2 className="text-lg font-semibold tracking-tight mb-3">
          관심주제로 찾기
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {topics.map((t) => (
            <Link
              key={t.topic}
              href={`/policy/topic/${topicSlug(t.topic)}`}
              className="rounded-lg border border-zinc-200 bg-white p-3 hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <div className="text-sm font-medium text-zinc-900">
                {t.topic}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {t.count}개 서비스
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ServiceList title="인기 서비스" services={popular} />
      <ServiceList title="최근 등록" services={recent} />

      <p className="text-xs text-zinc-500 text-center">
        출처: 한국사회보장정보원 중앙부처복지서비스 (data.go.kr) · 실제 신청은
        원문 링크에서 확인 필수
      </p>
    </div>
  );
}

function ServiceList({
  title,
  services,
}: {
  title: string;
  services: WelfareService[];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight mb-3">{title}</h2>
      <div className="grid gap-3">
        {services.map((s) => (
          <ServiceCard key={s.service_id} service={s} />
        ))}
      </div>
    </section>
  );
}

