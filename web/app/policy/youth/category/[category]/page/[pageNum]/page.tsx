import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { YouthCategoryView } from "@/components/YouthCategoryView";
import {
  youthCategoryFromSlug,
  youthCategoryPageCount,
  youthCategorySlug,
  youthPoliciesByCategory,
  youthPoliciesForCategory,
} from "@/lib/youth";

export function generateStaticParams() {
  const params: Array<{ category: string; pageNum: string }> = [];
  for (const cat of youthPoliciesByCategory().keys()) {
    const slug = youthCategorySlug(cat);
    const pages = youthCategoryPageCount(cat);
    for (let n = 2; n <= pages; n++) {
      params.push({ category: slug, pageNum: String(n) });
    }
  }
  return params;
}

export async function generateMetadata(
  props: PageProps<"/policy/youth/category/[category]/page/[pageNum]">
): Promise<Metadata> {
  const { category: slug, pageNum } = await props.params;
  const cat = youthCategoryFromSlug(slug);
  if (!cat) return { title: "카테고리를 찾을 수 없음" };
  return {
    title: `${cat} 청년정책 · ${pageNum}페이지`,
    description: `${cat} 분야 청년정책 목록 (${pageNum}페이지).`,
  };
}

export default async function YouthCategoryPagedPage(
  props: PageProps<"/policy/youth/category/[category]/page/[pageNum]">
) {
  const { category: slug, pageNum } = await props.params;
  const cat = youthCategoryFromSlug(slug);
  if (!cat) notFound();

  const page = Number(pageNum);
  if (!Number.isInteger(page) || page < 2) notFound();

  const total = youthPoliciesForCategory(cat).length;
  const totalPages = youthCategoryPageCount(cat);
  if (page > totalPages) notFound();

  return <YouthCategoryView category={cat} page={page} total={total} />;
}
