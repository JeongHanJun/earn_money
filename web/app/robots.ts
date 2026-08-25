import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/"],
      },
      // Naver 크롤러 명시적 허용 (한국 SEO)
      {
        userAgent: "Yeti",
        allow: "/",
      },
      // Google 크롤러 명시적 허용
      {
        userAgent: "Googlebot",
        allow: "/",
      },
    ],
    sitemap: "https://ryanpp.com/sitemap.xml",
    host: "https://ryanpp.com",
  };
}
