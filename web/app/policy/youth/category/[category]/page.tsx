import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { YouthCard } from "@/components/YouthCard";
import {
  youthCategoryFromSlug,
  youthCategorySlug,
  youthPoliciesByCategory,
  youthPoliciesForCategory,
} from "@/lib/youth";

export function generateStaticParams() {
  const cats = Array.from(youthPoliciesByCategory().keys());
  return cats.map((c) => ({ category: youthCategorySlug(c) }));
}

export async function generateMetadata(
  props: PageProps<"/policy/youth/category/[category]">
): Promise<Metadata> {
  const { category: slug } = await props.params;
  const cat = youthCategoryFromSlug(slug);
  if (!cat) return { title: "카테고리를 찾을 수 없음" };
  return {
    title: `${cat} 청년정책`,
    description: `${cat} 분야 청년정책 전체 목록. 신청 링크 포함.`,
  };
}

export default async function YouthCategoryPage(
  props: PageProps<"/policy/youth/category/[category]">
) {
  const { category: slug } = await props.params;
  const cat = youthCategoryFromSlug(slug);
  if (!cat) notFound();
  const policies = youthPoliciesForCategory(cat);
  if (policies.length === 0) notFound();

  const sorted = [...policies].sort(
    (a, b) => b.inquiry_count - a.inquiry_count
  );

  return (
    <div className="space-y-8">
      <nav className="text-sm text-zinc-500">
        <Link href="/policy" className="hover:text-zinc-900">
          정책·지원금
        </Link>
        <span className="mx-2">/</span>
        <Link href="/policy/youth" className="hover:text-zinc-900">
          청년정책
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900">{cat}</span>
      </nav>

      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          {policies.length}개 정책
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          {cat} 청년정책
        </h1>
        <p className="mt-2 text-zinc-600">조회수 순</p>
      </header>

      <div className="grid gap-3">
        {sorted.slice(0, 50).map((p) => (
          <YouthCard key={p.plcy_no} policy={p} />
        ))}
      </div>

      {sorted.length > 50 && (
        <section aria-labelledby="more-heading" className="mt-8">
          <h2
            id="more-heading"
            className="text-lg font-semibold tracking-tight mb-3"
          >
            더 많은 {cat} 정책 ({sorted.length - 50}개)
          </h2>
          <p className="text-xs text-zinc-500 mb-4 leading-5">
            상단 검색바에서 키워드로 빠르게 찾을 수 있습니다.
          </p>
          <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {sorted.slice(50).map((p) => (
              <li key={p.plcy_no}>
                <Link
                  href={`/policy/youth/${p.plcy_no}`}
                  className="block text-zinc-700 hover:text-amber-700 hover:underline leading-6 truncate"
                  title={p.name}
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
