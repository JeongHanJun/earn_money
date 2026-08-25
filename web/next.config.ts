import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 정적 배포 (모든 페이지 SSG)
  output: "export",
  // 정적 export에서는 next/image 최적화 비활성화 필요
  images: {
    unoptimized: true,
  },
  // trailingSlash: false → /weather/seoul (더 짧고 canonical)
  trailingSlash: false,
};

export default nextConfig;
