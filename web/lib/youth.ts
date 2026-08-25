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

export function formatYouthDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length < 8) return "";
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}
