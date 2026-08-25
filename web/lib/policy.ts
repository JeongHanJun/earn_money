import fs from "node:fs";
import path from "node:path";

const DATA_FILE = path.join(process.cwd(), "..", "data", "welfare", "list.json");
const DETAIL_DIR = path.join(process.cwd(), "..", "data", "welfare", "detail");

export type WelfareService = {
  service_id: string;
  service_name: string;
  summary: string;
  detail_url: string;
  department: string;
  org_name: string;
  contact: string;
  interest_topics: string[];
  life_stages: string[];
  online_apply: boolean;
  support_cycle: string;
  provision_type: string;
  first_registered: string;   // YYYYMMDD
  inquiry_count: number;
};

type WelfareFile = {
  fetched_at: string;
  data: {
    total_count: number;
    count: number;
    items: WelfareService[];
  };
};

let cache: WelfareFile | null = null;

function load(): WelfareFile {
  if (!cache) {
    const text = fs.readFileSync(DATA_FILE, "utf-8");
    cache = JSON.parse(text) as WelfareFile;
  }
  return cache;
}

export type ApplyMethod = { name: string; description: string };
export type UrlEntry = { name: string; url: string };
export type ContactEntry = { name: string; contact: string };

export type WelfareServiceDetail = {
  service_id: string;
  service_name: string;
  department: string;
  target_detail: string;         // 지원대상
  selection_criteria: string;    // 선정기준
  benefit_detail: string;        // 지원내용
  outline: string;               // 서비스 개요
  reference_year: string;
  contact: string;
  support_cycle: string;
  provision_type: string;
  life_stages: string[];
  target_groups: string[];       // 다자녀, 다문화, 저소득 등
  interest_topics: string[];
  apply_methods: ApplyMethod[];
  inquiry_contacts: ContactEntry[];
  related_sites: UrlEntry[];
  forms: UrlEntry[];
  laws: string[];
};

const detailCache = new Map<string, WelfareServiceDetail | null>();

export function getServiceDetail(serviceId: string): WelfareServiceDetail | null {
  if (detailCache.has(serviceId)) return detailCache.get(serviceId) ?? null;
  const file = path.join(DETAIL_DIR, `${serviceId}.json`);
  try {
    const wrapped = JSON.parse(fs.readFileSync(file, "utf-8"));
    // storage.write_json 이 {fetched_at, data} 래핑함
    const payload = (wrapped.data ?? wrapped) as WelfareServiceDetail;
    detailCache.set(serviceId, payload);
    return payload;
  } catch {
    detailCache.set(serviceId, null);
    return null;
  }
}

export function fetchedAt(): string {
  return load().fetched_at;
}

export function allServices(): WelfareService[] {
  return load().data.items;
}

export function getService(serviceId: string): WelfareService | undefined {
  return allServices().find((s) => s.service_id === serviceId);
}

/** 관심주제 슬러그 매핑 (한글 → URL slug) */
const TOPIC_SLUG_MAP: Record<string, string> = {
  "신체건강": "health",
  "정신건강": "mental-health",
  "생활지원": "living",
  "주거": "housing",
  "일자리": "job",
  "문화·여가": "culture",
  "안전·위기": "safety",
  "임신·출산": "pregnancy",
  "보육": "childcare",
  "보호·돌봄": "care",
  "교육": "education",
  "입양·위탁": "adoption",
  "법률": "legal",
  "서민금융": "finance",
  "에너지": "energy",
};

export function topicSlug(topic: string): string {
  return TOPIC_SLUG_MAP[topic] ?? topic.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function topicFromSlug(slug: string): string | undefined {
  for (const [ko, en] of Object.entries(TOPIC_SLUG_MAP)) {
    if (en === slug) return ko;
  }
  return undefined;
}

/** 생애주기 슬러그 매핑 */
const LIFE_SLUG_MAP: Record<string, string> = {
  "영유아": "infant",
  "아동": "child",
  "청소년": "teen",
  "청년": "youth",
  "중장년": "middle-aged",
  "노년": "senior",
  "임신·출산": "pregnancy",
};

export function lifeSlug(life: string): string {
  return LIFE_SLUG_MAP[life] ?? life.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function lifeFromSlug(slug: string): string | undefined {
  for (const [ko, en] of Object.entries(LIFE_SLUG_MAP)) {
    if (en === slug) return ko;
  }
  return undefined;
}

/**
 * 관심주제별 서비스 그룹핑 (한 서비스가 여러 주제에 속할 수 있음).
 */
export function servicesByTopic(): Map<string, WelfareService[]> {
  const map = new Map<string, WelfareService[]>();
  for (const s of allServices()) {
    for (const t of s.interest_topics) {
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(s);
    }
  }
  return map;
}

export function servicesForTopic(topic: string): WelfareService[] {
  return allServices().filter((s) => s.interest_topics.includes(topic));
}

export function servicesForLife(life: string): WelfareService[] {
  return allServices().filter((s) => s.life_stages.includes(life));
}

/** 인기 서비스 (조회수 기준 상위) */
export function popularServices(limit = 10): WelfareService[] {
  return [...allServices()]
    .sort((a, b) => b.inquiry_count - a.inquiry_count)
    .slice(0, limit);
}

/** 최근 등록 서비스 */
export function recentServices(limit = 10): WelfareService[] {
  return [...allServices()]
    .sort((a, b) => b.first_registered.localeCompare(a.first_registered))
    .slice(0, limit);
}

/** 부처별 서비스 수 */
export function servicesByDepartment(): Array<{ dept: string; count: number }> {
  const map = new Map<string, number>();
  for (const s of allServices()) {
    map.set(s.department, (map.get(s.department) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([dept, count]) => ({ dept, count }))
    .sort((a, b) => b.count - a.count);
}

/** 유사 서비스 추천 (같은 관심주제 or 생애주기) */
export function relatedServices(service: WelfareService, limit = 5): WelfareService[] {
  const scored = allServices()
    .filter((s) => s.service_id !== service.service_id)
    .map((s) => {
      let score = 0;
      for (const t of service.interest_topics) if (s.interest_topics.includes(t)) score += 2;
      for (const l of service.life_stages) if (s.life_stages.includes(l)) score += 1;
      if (s.department === service.department) score += 1;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((x) => x.s);
}
