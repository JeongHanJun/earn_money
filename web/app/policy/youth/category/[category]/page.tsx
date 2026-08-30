import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { YouthCategoryView } from "@/components/YouthCategoryView";
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
  const total = youthPoliciesForCategory(cat).length;
  if (total === 0) notFound();

  return <YouthCategoryView category={cat} page={1} total={total} />;
}
