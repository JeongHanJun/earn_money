import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "..", "data", "trends");

// ===== 타입 =====

export type GoogleNewsItem = {
  title: string;
  link: string;
  description: string;
  publisher: string;
  pub_date: string;
};

export type GoogleTrend = {
  rank: number;
  keyword: string;
  traffic: string;
  pub_date: string;
  articles: Array<{ title: string; url: string; source: string }>;
};

export type YouTubeVideo = {
  rank: number;
  video_id: string;
  title: string;
  channel: string;
  thumbnail: string;
  published_at: string;
  view_count: number;
  like_count: number;
};

export type Article = {
  title: string;
  link: string;
  description: string;
  publisher?: string;
  pub_date: string;
};

export type PressGroup = {
  press: string;
  items: Array<{ rank: number; title: string; link: string }>;
};

export type CustomSourceType = "articles" | "press_groups";

export type CustomSource = {
  name: string;
  type: CustomSourceType;
  items: Article[] | PressGroup[];
};

export type CountryData = {
  country_code: string;
  country_name: string;
  flag: string;
  google_trends: GoogleTrend[];
  youtube_popular: YouTubeVideo[];
  google_news: Record<string, GoogleNewsItem[]>;
  custom: Record<string, CustomSource>;
};

type CountryFile = {
  fetched_at: string;
  data: CountryData;
};

// ===== 국가 registry (UI ordering) =====

export const COUNTRIES: Array<{
  code: string;
  name: string;
  flag: string;
  language: string;
}> = [
  { code: "kr", name: "한국", flag: "🇰🇷", language: "한국어" },
  { code: "us", name: "미국", flag: "🇺🇸", language: "English" },
  { code: "jp", name: "일본", flag: "🇯🇵", language: "日本語" },
  { code: "uk", name: "영국", flag: "🇬🇧", language: "English" },
  { code: "tw", name: "대만", flag: "🇹🇼", language: "繁體中文" },
  { code: "de", name: "독일", flag: "🇩🇪", language: "Deutsch" },
  { code: "vn", name: "베트남", flag: "🇻🇳", language: "Tiếng Việt" },
];

export const DEFAULT_COUNTRY = "kr";

// ===== Google News 카테고리 (한글 표시명) =====

export const CATEGORY_META: Array<{ slug: string; name: string }> = [
  { slug: "top", name: "주요" },
  { slug: "nation", name: "국내" },
  { slug: "world", name: "세계" },
  { slug: "business", name: "경제" },
  { slug: "technology", name: "IT·과학" },
  { slug: "entertainment", name: "연예" },
  { slug: "sports", name: "스포츠" },
  { slug: "health", name: "건강" },
];

// ===== 소스 slug (URL friendly) → source key =====

export const SOURCE_SLUG_TO_KEY: Record<string, string> = {
  hot: "google_trends",
  youtube: "youtube_popular",
  news: "google_news",
  // custom sources
  naver: "naver_ranking",
  daum: "daum_ranking",
  yahoo: "yahoo_japan",
  nhk: "nhk",
  nyt: "nyt",
  hn: "hackernews",
  bbc: "bbc",
  cna: "cna",
  ltn: "ltn",
  spiegel: "der_spiegel",
  vnexpress: "vnexpress",
};

export const SOURCE_KEY_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SOURCE_SLUG_TO_KEY).map(([k, v]) => [v, k])
);

// ===== 국가별 소스 순서 (배치 순서 = 중요도 순) =====
// Google Trends + YouTube + Google News가 최상위 (모든 국가 공통)
// 그다음 국가 특화 소스

export const COUNTRY_SOURCES: Record<string, string[]> = {
  kr: ["hot", "youtube", "news", "naver", "daum"],
  jp: ["hot", "youtube", "news", "yahoo", "nhk"],
  us: ["hot", "youtube", "news", "nyt", "hn"],
  uk: ["hot", "youtube", "news", "bbc"],
  tw: ["hot", "youtube", "news", "cna", "ltn"],
  de: ["hot", "youtube", "news", "spiegel"],
  vn: ["hot", "youtube", "news", "vnexpress"],
};

// 소스 표시명 (dashboard 카드용)
export const SOURCE_LABELS: Record<string, string> = {
  hot: "Google 급상승",
  youtube: "YouTube 인기",
  news: "Google News",
  naver: "Naver 언론사",
  daum: "Daum 랭킹",
  yahoo: "Yahoo! Japan",
  nhk: "NHK",
  nyt: "NY Times",
  hn: "HackerNews",
  bbc: "BBC",
  cna: "CNA 中央社",
  ltn: "自由時報",
  spiegel: "Der Spiegel",
  vnexpress: "VnExpress",
};

// ===== 로더 =====

const cache = new Map<string, CountryFile>();

export function loadCountry(code: string): CountryFile {
  const cached = cache.get(code);
  if (cached) return cached;
  const file = path.join(DATA_DIR, `${code}.json`);
  const text = fs.readFileSync(file, "utf-8");
  const parsed = JSON.parse(text) as CountryFile;
  cache.set(code, parsed);
  return parsed;
}

export function isValidCountry(code: string): boolean {
  return COUNTRIES.some((c) => c.code === code);
}

export function isValidSource(code: string, slug: string): boolean {
  return COUNTRY_SOURCES[code]?.includes(slug) ?? false;
}

export function countryMeta(code: string) {
  return COUNTRIES.find((c) => c.code === code);
}

// ===== 유틸 =====

export function formatRelative(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  } catch {
    return "";
  }
}

export function formatCount(n: number): string {
  if (!n) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 10_000_000) return `${Math.floor(n / 10_000_000)}천만`;
  if (n >= 10_000) return `${Math.floor(n / 10_000)}만`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
