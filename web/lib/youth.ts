import fs from "node:fs";
import path from "node:path";

const DATA_FILE = path.join(process.cwd(), "..", "data", "youth", "list.json");

export type YouthPolicy = {
  plcy_no: string;
  name: string;
  keyword: string;
  description: string;
  support_content: string;
  apply_method: string;
  apply_url: string;             // ★ 실 신청 링크
  ref_urls: string[];
  department: string;
  biz_start: string;              // YYYYMMDD
  biz_end: string;
  apply_period: string;
  min_age: number;
  max_age: number;
  age_limit: boolean;
  earn_min: number;
  earn_max: number;
  earn_note: string;
  add_qual: string;
  submission_docs: string;
  screening: string;
  etc: string;
  major_category: string;
  sub_category: string;
  inquiry_count: number;
  zip_codes: string[];
  first_reg: string;
};

type YouthFile = {
  fetched_at: string;
  data: {
    total_count: number;
    count: number;
    items: YouthPolicy[];
  };
};

let cache: YouthFile | null = null;

function load(): YouthFile {
  if (!cache) {
    const text = fs.readFileSync(DATA_FILE, "utf-8");
    cache = JSON.parse(text) as YouthFile;
  }
  return cache;
}

export function fetchedAt(): string {
  return load().fetched_at;
}

export function allYouthPolicies(): YouthPolicy[] {
  return load().data.items;
}

export function getYouthPolicy(plcyNo: string): YouthPolicy | undefined {
  return allYouthPolicies().find((p) => p.plcy_no === plcyNo);
}

export function popularYouthPolicies(limit = 10): YouthPolicy[] {
  return [...allYouthPolicies()]
    .sort((a, b) => b.inquiry_count - a.inquiry_count)
    .slice(0, limit);
}

export function recentYouthPolicies(limit = 10): YouthPolicy[] {
  return [...allYouthPolicies()]
    .sort((a, b) => (b.first_reg || "").localeCompare(a.first_reg || ""))
    .slice(0, limit);
}

/**
 * 원본 카테고리 정규화.
 * - 콤마 결합("일자리,교육", "참여권리,참여권리") → 첫 값
 * - 반각 middle dot(U+FF65) 포함 신규 분류를 구 분류에 병합
 * - 결과: 5개 통합 카테고리 (일자리 / 주거 / 교육 / 복지 / 참여)
 */
function normalizeYouthCategory(raw: string): string {
  if (!raw) return "기타";
  const first = raw.split(",")[0].trim();
  const map: Record<string, string> = {
    "일자리": "일자리",
    "주거": "주거",
    "교육": "교육",
    "교육･직업훈련": "교육",           // 반각 dot 신규 분류
    "교육·직업훈련": "교육",           // 전각 dot 변형
    "복지문화": "복지",
    "금융･복지･문화": "복지",
    "금융·복지·문화": "복지",
    "참여권리": "참여",
    "참여･기반": "참여",
    "참여·기반": "참여",
  };
  return map[first] ?? first;
}

export function youthPoliciesByCategory(): Map<string, YouthPolicy[]> {
  const map = new Map<string, YouthPolicy[]>();
  for (const p of allYouthPolicies()) {
    const key = normalizeYouthCategory(p.major_category);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

const YOUTH_CATEGORY_SLUG: Record<string, string> = {
  "일자리": "job",
  "주거": "housing",
  "교육": "education",
  "복지": "welfare",
  "참여": "participation",
  "기타": "etc",
};

export function youthCategorySlug(name: string): string {
  const normalized = normalizeYouthCategory(name);
  return YOUTH_CATEGORY_SLUG[normalized] ?? "etc";
}

export function youthCategoryFromSlug(slug: string): string | undefined {
  for (const [ko, en] of Object.entries(YOUTH_CATEGORY_SLUG)) {
    if (en === slug) return ko;
  }
  return undefined;
}

export function youthPoliciesForCategory(category: string): YouthPolicy[] {
  return allYouthPolicies().filter(
    (p) => normalizeYouthCategory(p.major_category) === category
  );
}

export const YOUTH_CATEGORY_PAGE_SIZE = 30;

export function youthCategoryPageCount(category: string): number {
  const total = youthPoliciesForCategory(category).length;
  return Math.max(1, Math.ceil(total / YOUTH_CATEGORY_PAGE_SIZE));
}

/**
 * 카테고리 정책을 조회수 순으로 정렬하고 페이지네이션을 적용한다.
 * page 는 1-based. 범위를 벗어나면 빈 배열.
 */
export function youthCategoryPage(
  category: string,
  page: number,
): YouthPolicy[] {
  const sorted = [...youthPoliciesForCategory(category)].sort(
    (a, b) => b.inquiry_count - a.inquiry_count,
  );
  const start = (page - 1) * YOUTH_CATEGORY_PAGE_SIZE;
  return sorted.slice(start, start + YOUTH_CATEGORY_PAGE_SIZE);
}

export function relatedYouthPolicies(
  policy: YouthPolicy,
  limit = 4
): YouthPolicy[] {
  return allYouthPolicies()
    .filter((p) => p.plcy_no !== policy.plcy_no)
    .map((p) => {
      let score = 0;
      if (p.major_category === policy.major_category) score += 2;
      if (p.sub_category === policy.sub_category) score += 2;
      if (p.department === policy.department) score += 1;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

export function youthFaq(
  policy: YouthPolicy
): Array<{ question: string; answer: string }> {
  const faq: Array<{ question: string; answer: string }> = [];

  const ageText =
    policy.age_limit && policy.min_age > 0 && policy.max_age > 0
      ? `만 ${policy.min_age}세 ~ ${policy.max_age}세가 신청 가능합니다.`
      : "연령 제한 없이 신청 가능합니다.";
  faq.push({
    question: `${policy.name}, 누가 신청할 수 있나요?`,
    answer:
      `${ageText}` +
      (policy.add_qual ? ` 추가 자격 요건: ${policy.add_qual}` : ""),
  });

  if (policy.earn_min > 0 || policy.earn_max > 0 || policy.earn_note) {
    const earnText =
      policy.earn_min > 0 || policy.earn_max > 0
        ? `연 소득 ${policy.earn_min.toLocaleString()}원 ~ ${policy.earn_max.toLocaleString()}원 구간이 지원 대상입니다.`
        : policy.earn_note || "소득 조건 없음";
    faq.push({ question: "소득 조건은 어떻게 되나요?", answer: earnText });
  }

  if (policy.support_content) {
    faq.push({
      question: "무엇을 지원받나요?",
      answer: policy.support_content.trim(),
    });
  }

  if (policy.apply_method || policy.apply_url) {
    faq.push({
      question: "어떻게 신청하나요?",
      answer:
        (policy.apply_method || "온라인 또는 오프라인으로 신청 가능합니다.") +
        (policy.apply_url ? ` (신청 링크: ${policy.apply_url})` : ""),
    });
  }

  if (policy.apply_period || policy.biz_start || policy.biz_end) {
    const period = policy.apply_period || "";
    const biz =
      policy.biz_start && policy.biz_end
        ? `사업 기간: ${formatYouthDate(policy.biz_start)} ~ ${formatYouthDate(policy.biz_end)}`
        : "";
    faq.push({
      question: "언제까지 신청할 수 있나요?",
      answer: [period, biz].filter(Boolean).join(" · "),
    });
  }

  if (policy.submission_docs) {
    faq.push({
      question: "어떤 서류가 필요한가요?",
      answer: policy.submission_docs.trim(),
    });
  }

  return faq;
}

export function formatYouthDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length < 8) return "";
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}
