import type { MetadataRoute } from "next";
import { allMunicipalityPaths, regions } from "@/lib/regions";

export const dynamic = "force-static";
import {
  allServices,
  servicesByTopic,
  topicSlug,
} from "@/lib/policy";
import { activeTags } from "@/lib/tags";
import {
  allYouthPolicies,
  youthCategoryPageCount,
  youthCategorySlug,
  youthPoliciesByCategory,
} from "@/lib/youth";

const BASE = "https://ryanpp.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // 크롤 예산 최적화 (2026-09-24):
  // - Policy/Youth 상세 페이지는 실제 콘텐츠 변경 드묾 → monthly
  // - 카테고리 페이지네이션 (page 2+)은 저가치 → priority 하향
  // - 홈/랜딩/날씨 랜딩만 high priority 유지
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, priority: 1.0, changeFrequency: "daily", lastModified: now },
    { url: `${BASE}/weather`, priority: 0.9, changeFrequency: "daily", lastModified: now },
    { url: `${BASE}/policy`, priority: 0.9, changeFrequency: "daily", lastModified: now },
    { url: `${BASE}/policy/youth`, priority: 0.9, changeFrequency: "daily", lastModified: now },
    { url: `${BASE}/policy/tags`, priority: 0.5, changeFrequency: "weekly", lastModified: now },
    { url: `${BASE}/trends`, priority: 0.7, changeFrequency: "daily", lastModified: now },
    { url: `${BASE}/terms`, priority: 0.2, changeFrequency: "yearly", lastModified: now },
    { url: `${BASE}/privacy`, priority: 0.2, changeFrequency: "yearly", lastModified: now },
  ];

  const provincePages: MetadataRoute.Sitemap = regions.provinces.map((p) => ({
    url: `${BASE}/weather/${p.slug}`,
    priority: 0.5,
    changeFrequency: "weekly",
    lastModified: now,
  }));

  const weatherPages: MetadataRoute.Sitemap = allMunicipalityPaths().map(
    ({ sido, sigungu }) => ({
      url: `${BASE}/weather/${sido}/${sigungu}`,
      priority: 0.6,
      changeFrequency: "daily",
      lastModified: now,
    })
  );

  const policyPages: MetadataRoute.Sitemap = allServices().map((s) => ({
    url: `${BASE}/policy/${s.service_id}`,
    priority: 0.6,
    changeFrequency: "monthly",
    lastModified: now,
  }));

  const topicPages: MetadataRoute.Sitemap = Array.from(
    servicesByTopic().keys()
  ).map((t) => ({
    url: `${BASE}/policy/topic/${topicSlug(t)}`,
    priority: 0.6,
    changeFrequency: "weekly",
    lastModified: now,
  }));

  const youthPages: MetadataRoute.Sitemap = allYouthPolicies().map((p) => ({
    url: `${BASE}/policy/youth/${p.plcy_no}`,
    priority: 0.6,
    changeFrequency: "monthly",
    lastModified: now,
  }));

  const youthCategoryPages: MetadataRoute.Sitemap = [];
  for (const cat of youthPoliciesByCategory().keys()) {
    const slug = youthCategorySlug(cat);
    const pages = youthCategoryPageCount(cat);
    youthCategoryPages.push({
      url: `${BASE}/policy/youth/category/${slug}`,
      priority: 0.6,
      changeFrequency: "weekly",
      lastModified: now,
    });
    for (let n = 2; n <= pages; n++) {
      youthCategoryPages.push({
        url: `${BASE}/policy/youth/category/${slug}/page/${n}`,
        priority: 0.3,
        changeFrequency: "weekly",
        lastModified: now,
      });
    }
  }

  const tagPages: MetadataRoute.Sitemap = activeTags().map((t) => ({
    url: `${BASE}/policy/tag/${encodeURIComponent(t.slug)}`,
    priority: 0.4,
    changeFrequency: "monthly",
    lastModified: now,
  }));

  return [
    ...staticPages,
    ...provincePages,
    ...weatherPages,
    ...policyPages,
    ...topicPages,
    ...youthPages,
    ...youthCategoryPages,
    ...tagPages,
  ];
}
