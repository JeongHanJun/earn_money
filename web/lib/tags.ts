/**
 * welfare + youth 정책을 아우르는 통합 태그 시스템.
 * SEO 롱테일 목표: 사용자가 "청년 월세" "다자녀 지원금" 같은 태그로 검색해
 * ryanpp.com 을 찾아오게 하려면, 태그별로 관련 정책들을 모아 보여주는
 * /policy/tag/[slug] 라우트가 필요.
 */
import { allServices, type WelfareService } from "./policy";
import { allYouthPolicies, type YouthPolicy } from "./youth";

export type Tag = {
  name: string;
  slug: string;
  count: number;
  welfare: WelfareService[];
  youth: YouthPolicy[];
};

/** 태그 페이지 생성 임계값 — 이 미만이면 그냥 dead-text (SEO 노이즈 방지) */
export const TAG_ACTIVE_THRESHOLD = 3;

/**
 * 한글/영문 혼용 태그를 URL slug 로 변환.
 * 한글은 유지 (Next.js + CF Pages 모두 UTF-8 경로 지원).
 * 공백/특수문자만 '-' 로 대체.
 */
export function slugifyTag(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[·・･]/g, "-") // 다양한 middle dot
    .replace(/[/,]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^\w가-힯-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeTag(raw: string): string {
  return raw.trim();
}

/** welfare 정책 하나에서 태그 이름 목록 뽑기 */
export function tagsForWelfare(s: WelfareService): string[] {
  const set = new Set<string>();
  for (const t of s.interest_topics ?? []) set.add(normalizeTag(t));
  for (const t of s.life_stages ?? []) set.add(normalizeTag(t));
  const dept = (s.department || "").replace(/부$/, "");
  if (dept) set.add(dept);
  return [...set].filter(Boolean);
}

/** youth 정책 하나에서 태그 이름 목록 뽑기 */
export function tagsForYouth(p: YouthPolicy): string[] {
  const set = new Set<string>();
  if (p.major_category) set.add(normalizeTag(p.major_category));
  if (p.sub_category) set.add(normalizeTag(p.sub_category));
  if (p.keyword) {
    for (const k of p.keyword.split(",")) {
      const t = normalizeTag(k);
      if (t) set.add(t);
    }
  }
  set.add("청년정책");
  return [...set].filter(Boolean);
}

let tagCache: Map<string, Tag> | null = null;

/**
 * 모든 태그 계산 (name → Tag 객체 매핑).
 * 같은 slug 로 정규화되는 태그들은 병합 (예: "일자리" 만 하나).
 */
export function allTags(): Map<string, Tag> {
  if (tagCache) return tagCache;

  const bySlug = new Map<string, Tag>();

  const upsert = (rawName: string): Tag | null => {
    const name = normalizeTag(rawName);
    if (!name) return null;
    const slug = slugifyTag(name);
    if (!slug) return null;
    let tag = bySlug.get(slug);
    if (!tag) {
      tag = { name, slug, count: 0, welfare: [], youth: [] };
      bySlug.set(slug, tag);
    }
    return tag;
  };

  for (const s of allServices()) {
    for (const t of tagsForWelfare(s)) {
      const tag = upsert(t);
      if (!tag) continue;
      tag.welfare.push(s);
      tag.count++;
    }
  }
  for (const p of allYouthPolicies()) {
    for (const t of tagsForYouth(p)) {
      const tag = upsert(t);
      if (!tag) continue;
      tag.youth.push(p);
      tag.count++;
    }
  }

  tagCache = bySlug;
  return bySlug;
}

/** SEO 노이즈 방지: 임계값 이상 태그만 반환 (라우트/sitemap 용) */
export function activeTags(): Tag[] {
  return [...allTags().values()]
    .filter((t) => t.count >= TAG_ACTIVE_THRESHOLD)
    .sort((a, b) => b.count - a.count);
}

export function getTag(slug: string): Tag | undefined {
  return allTags().get(slug);
}

export function isActiveTag(name: string): boolean {
  const tag = allTags().get(slugifyTag(name));
  return !!tag && tag.count >= TAG_ACTIVE_THRESHOLD;
}

export function tagHref(name: string): string {
  return `/policy/tag/${encodeURIComponent(slugifyTag(name))}`;
}
