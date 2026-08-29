import type { Metadata, Viewport } from "next";
import Script from "next/script";
import Link from "next/link";
import { GoogleAnalytics } from "@next/third-parties/google";
import { SearchBar } from "@/components/SearchBar";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const KAKAO_ADFIT_ANY = process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT_300x250;
// Naver: 콤마 구분자로 여러 도메인 코드 지원 (도메인마다 다른 코드 필요)
const NAVER_SITE_VERIFICATIONS = (process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL("https://ryanpp.com"),
  title: {
    default: "ryanpp — 정책·지원금·트렌드 한눈에",
    template: "%s | ryanpp",
  },
  description:
    "공공데이터 기반 최신 정책·지원금 정보와 실시간 트렌드를 매일 자동 정리합니다.",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://ryanpp.com",
    siteName: "ryanpp",
  },
  robots: { index: true, follow: true },
  ...(GOOGLE_SITE_VERIFICATION || NAVER_SITE_VERIFICATIONS.length > 0
    ? {
        verification: {
          ...(GOOGLE_SITE_VERIFICATION && { google: GOOGLE_SITE_VERIFICATION }),
          ...(NAVER_SITE_VERIFICATIONS.length > 0 && {
            other: { "naver-site-verification": NAVER_SITE_VERIFICATIONS },
          }),
        },
      }
    : {}),
  alternates: {
    canonical: "https://ryanpp.com",
    types: {
      "application/rss+xml": [{ url: "/rss.xml", title: "최신 정책·지원금" }],
    },
  },
  manifest: "/manifest.webmanifest",
  applicationName: "ryanpp",
  appleWebApp: {
    capable: true,
    title: "ryanpp",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

const SITE_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://ryanpp.com/#website",
      name: "ryanpp",
      alternateName: "ryanpp — 정책·지원금·트렌드",
      url: "https://ryanpp.com/",
      inLanguage: "ko-KR",
      description:
        "공공데이터 기반 최신 정책·지원금·지역별 날씨·실시간 트렌드를 매일 자동 정리합니다.",
      publisher: { "@id": "https://ryanpp.com/#organization" },
    },
    {
      "@type": "Organization",
      "@id": "https://ryanpp.com/#organization",
      name: "ryanpp",
      url: "https://ryanpp.com/",
      logo: "https://ryanpp.com/favicon.ico",
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col text-zinc-900">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD) }}
        />
        <SiteHeader />
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-10">
          {children}
        </main>
        <SiteFooter />
        {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
        {ADSENSE_ID && (
          <Script
            id="adsense-init"
            async
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`}
            crossOrigin="anonymous"
          />
        )}
        {KAKAO_ADFIT_ANY && (
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script async src="//t1.daumcdn.net/kas/static/ba.min.js" />
        )}
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-zinc-200/70">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="shrink-0 flex items-center gap-2 font-semibold tracking-tight"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "var(--color-brand-600)" }}
            aria-hidden
          />
          <span>ryanpp</span>
        </Link>
        <nav className="shrink-0 hidden sm:flex items-center gap-1 text-sm font-medium">
          <NavLink href="/weather">날씨</NavLink>
          <NavLink href="/policy">정책·지원금</NavLink>
          <NavLink href="/trends">트렌드</NavLink>
        </nav>
        <nav className="shrink-0 flex sm:hidden items-center gap-0.5 text-xs font-medium">
          <NavLink href="/weather">날씨</NavLink>
          <NavLink href="/policy">정책</NavLink>
          <NavLink href="/trends">트렌드</NavLink>
        </nav>
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-2.5">
        <HeaderSearch />
      </div>
    </header>
  );
}

function HeaderSearch() {
  return (
    <SearchBar placeholder="정책·지원금 검색 (예: 청년 주거, 의료비)" />
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
    >
      {children}
    </Link>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 mt-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--color-brand-600)" }}
              aria-hidden
            />
            ryanpp
          </div>
          <p className="mt-2 text-sm text-zinc-500 leading-6 max-w-sm">
            공공데이터포털·기관 공식 API 및 주요 매체 RSS를 기반으로
            자동 정리되는 정보 사이트입니다.
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <Link href="/terms" className="text-zinc-600 hover:text-zinc-900">
            이용약관
          </Link>
          <Link href="/privacy" className="text-zinc-600 hover:text-zinc-900">
            개인정보처리방침
          </Link>
        </div>
      </div>
      <div className="border-t border-zinc-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 text-xs text-zinc-400">
          © {new Date().getFullYear()} ryanpp
        </div>
      </div>
    </footer>
  );
}
