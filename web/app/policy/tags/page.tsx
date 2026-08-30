import type { Metadata } from "next";
import Link from "next/link";
import { activeTags } from "@/lib/tags";

export const metadata: Metadata = {
  title: "정책·지원금 태그 전체",
  description:
    "복지서비스 461건 + 청년정책 3,000건을 아우르는 태그 인덱스. 관심 주제·생애주기·지원 대상별로 관련 정책 모아보기.",
  alternates: { canonical: "/policy/tags" },
};

export default function TagsIndexPage() {
  const tags = activeTags();
  // count 에 따라 폰트 크기 3단계
  const max = tags[0]?.count ?? 1;
  const size = (c: number) => {
    const r = c / max;
    if (r >= 0.5) return "text-lg sm:text-xl font-bold";
    if (r >= 0.2) return "text-base font-semibold";
    return "text-sm";
  };
  const bg = (c: number) => {
    const r = c / max;
    if (r >= 0.5) return "bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200";
    if (r >= 0.2) return "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100";
    return "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100";
  };

  return (
    <div className="space-y-8">
      <nav className="text-sm text-zinc-500">
        <Link href="/policy" className="hover:text-zinc-900">
          정책·지원금
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900">태그</span>
      </nav>

      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          {tags.length}개 태그
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          태그 인덱스
        </h1>
        <p className="mt-2 text-zinc-600 leading-7">
          관심 주제·생애주기·지원 대상별로 관련 정책을 모아 볼 수 있습니다.
          큰 태그일수록 관련 정책이 많다는 뜻.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Link
              key={t.slug}
              href={`/policy/tag/${encodeURIComponent(t.slug)}`}
              className={`inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 transition-colors ${bg(t.count)} ${size(t.count)}`}
              title={`${t.name} 관련 정책 ${t.count}건`}
            >
              <span>#{t.name}</span>
              <span className="text-xs font-normal opacity-70">{t.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-xs text-zinc-500 text-center">
        태그는 3건 이상 관련 정책이 있는 경우만 표시됩니다.
      </p>
    </div>
  );
}
