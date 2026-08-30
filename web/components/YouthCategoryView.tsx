import Link from "next/link";
import { Pagination } from "@/components/Pagination";
import { YouthCard } from "@/components/YouthCard";
import {
  YOUTH_CATEGORY_PAGE_SIZE,
  youthCategoryPage,
  youthCategoryPageCount,
  youthCategorySlug,
} from "@/lib/youth";

export function YouthCategoryView({
  category,
  page,
  total,
}: {
  category: string;
  page: number;
  total: number;
}) {
  const slug = youthCategorySlug(category);
  const totalPages = youthCategoryPageCount(category);
  const policies = youthCategoryPage(category, page);
  const startIdx = (page - 1) * YOUTH_CATEGORY_PAGE_SIZE + 1;
  const endIdx = Math.min(page * YOUTH_CATEGORY_PAGE_SIZE, total);

  const href = (n: number) =>
    n === 1
      ? `/policy/youth/category/${slug}`
      : `/policy/youth/category/${slug}/page/${n}`;

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
        {page === 1 ? (
          <span className="text-zinc-900">{category}</span>
        ) : (
          <>
            <Link
              href={`/policy/youth/category/${slug}`}
              className="hover:text-zinc-900"
            >
              {category}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-900">{page}페이지</span>
          </>
        )}
      </nav>

      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          {total}개 정책
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          {category} 청년정책
          {page > 1 && (
            <span className="ml-2 text-lg font-semibold text-zinc-500">
              — {page} / {totalPages}
            </span>
          )}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          조회수 순 · {startIdx}–{endIdx}번째 (전체 {total}개 중)
        </p>
      </header>

      <div className="grid gap-3">
        {policies.map((p) => (
          <YouthCard key={p.plcy_no} policy={p} />
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} href={href} />
    </div>
  );
}
