import fs from "node:fs";
import path from "node:path";

const DATA_FILE = path.join(process.cwd(), "..", "data", "trends", "list.json");

export type TrendItem = {
  title: string;
  link: string;
  description: string;
  source: string;
  category: string;
  category_name: string;
  publisher: string;
  pub_date: string;
  fetched_at: string;
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

export type NaverPressGroup = {
  press: string;
  items: Array<{ rank: number; title: string; link: string }>;
};

export type DaumRankingItem = {
  rank: number;
  title: string;
  link: string;
};

type TrendsFile = {
  fetched_at: string;
  data: {
    google_news: Record<string, TrendItem[]>;
    hackernews: TrendItem[];
    google_trends?: GoogleTrend[];
    youtube_popular?: YouTubeVideo[];
    naver_ranking?: NaverPressGroup[];
    daum_ranking?: DaumRankingItem[];
    fetched_at: string;
  };
};

let cache: TrendsFile | null = null;

function load(): TrendsFile {
  if (!cache) {
    const text = fs.readFileSync(DATA_FILE, "utf-8");
    cache = JSON.parse(text) as TrendsFile;
  }
  return cache;
}

export function fetchedAt(): string {
  return load().fetched_at;
}

export const CATEGORY_META: Array<{ slug: string; name: string }> = [
  { slug: "top", name: "주요 뉴스" },
  { slug: "nation", name: "국내" },
  { slug: "world", name: "세계" },
  { slug: "business", name: "경제" },
  { slug: "technology", name: "IT·과학" },
  { slug: "entertainment", name: "연예" },
  { slug: "sports", name: "스포츠" },
  { slug: "health", name: "건강" },
];

export function itemsByCategory(slug: string): TrendItem[] {
  return load().data.google_news[slug] ?? [];
}

export function allCategories(): Array<{ slug: string; name: string; items: TrendItem[] }> {
  return CATEGORY_META.map((c) => ({
    slug: c.slug,
    name: c.name,
    items: itemsByCategory(c.slug),
  }));
}

export function hackerNewsItems(): TrendItem[] {
  return load().data.hackernews ?? [];
}

export function googleTrends(): GoogleTrend[] {
  return load().data.google_trends ?? [];
}

export function youtubePopular(): YouTubeVideo[] {
  return load().data.youtube_popular ?? [];
}

export function naverRanking(): NaverPressGroup[] {
  return load().data.naver_ranking ?? [];
}

export function daumRanking(): DaumRankingItem[] {
  return load().data.daum_ranking ?? [];
}

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
