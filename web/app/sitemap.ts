import type { MetadataRoute } from "next";
import { allMunicipalityPaths, regions } from "@/lib/regions";

export const dynamic = "force-static";
import {
  allServices,
  servicesByTopic,
  topicSlug,
} from "@/lib/policy";
import {
  allYouthPolicies,
  youthCategoryPageCount,
  youthCategorySlug,
  youthPoliciesByCategory,
} from "@/lib/youth";

const BASE = "https://ryanpp.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, priority: 1.0, changeFrequency: "daily", lastModified: now },
    { url: `${BASE}/weather`, priority: 0.9, changeFrequency: "hourly", lastModified: now },
    { url: `${BASE}/policy`, priority: 0.9, changeFrequency: "daily", lastModified: now },
    { url: `${BASE}/policy/youth`, priority: 0.9, changeFrequency: "daily", lastModified: now },
    { url: `${BASE}/trends`, priority: 0.7, changeFrequency: "hourly", lastModified: now },
    { url: `${BASE}/terms`, priority: 0.2, changeFrequency: "yearly", lastModified: now },
    { url: `${BASE}/privacy`, priority: 0.2, changeFrequency: "yearly", lastModified: now },
  ];

  const provincePages: MetadataRoute.Sitemap = regions.provinces.map((p) => ({
    url: `${BASE}/weather/${p.slug}`,
    priority: 0.6,
    changeFrequency: "daily",
    lastModified: now,
  }));

  const weatherPages: MetadataRoute.Sitemap = allMunicipalityPaths().map(
    ({ sido, sigungu }) => ({
      url: `${BASE}/weather/${sido}/${sigungu}`,
      priority: 0.7,
      changeFrequency: "hourly",
      lastModified: now,
    })
  );

  const policyPages: MetadataRoute.Sitemap = allServices().map((s) => ({
    url: `${BASE}/policy/${s.service_id}`,
    priority: 0.8,
    changeFrequency: "weekly",
    lastModified: now,
  }));

  const topicPages: MetadataRoute.Sitemap = Array.from(
    servicesByTopic().keys()
  ).map((t) => ({
    url: `${BASE}/policy/topic/${topicSlug(t)}`,
    priority: 0.7,
    changeFrequency: "daily",
    lastModified: now,
  }));

  const youthPages: MetadataRoute.Sitemap = allYouthPolicies().map((p) => ({
    url: `${BASE}/policy/youth/${p.plcy_no}`,
    priority: 0.8,
    changeFrequency: "weekly",
    lastModified: now,
  }));

  const youthCategoryPages: MetadataRoute.Sitemap = [];
  for (const cat of youthPoliciesByCategory().keys()) {
    const slug = youthCategorySlug(cat);
    const pages = youthCategoryPageCount(cat);
    youthCategoryPages.push({
      url: `${BASE}/policy/youth/category/${slug}`,
      priority: 0.7,
      changeFrequency: "daily",
      lastModified: now,
    });
    for (let n = 2; n <= pages; n++) {
      youthCategoryPages.push({
        url: `${BASE}/policy/youth/category/${slug}/page/${n}`,
        priority: 0.5,
        changeFrequency: "daily",
        lastModified: now,
      });
    }
  }

  return [
    ...staticPages,
    ...provincePages,
    ...weatherPages,
    ...policyPages,
    ...topicPages,
    ...youthPages,
    ...youthCategoryPages,
  ];
}
