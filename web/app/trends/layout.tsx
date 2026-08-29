import { KakaoAdSlot } from "@/components/KakaoAdSlot";

export default function TrendsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <KakaoAdSlot />
      <section className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-4 mt-8 text-sm text-zinc-600 leading-6 shadow-sm">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5 shrink-0 mt-0.5 text-zinc-400"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 8v5M12 16v.01"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <div>
          <strong className="text-zinc-900">데이터 출처:</strong>
          <span className="text-zinc-600">
            {" "}
            Google Trends (RSS), YouTube Data API v3, Google News (RSS),
            각국 주요 매체 공식 RSS (Yahoo Japan, NHK, NYT, HackerNews, BBC,
            CNA, Liberty Times, Der Spiegel, VnExpress, Naver, Daum).
            매시간 자동 갱신. 각 항목은 새 탭에서 원문 페이지로 이동합니다.
          </span>
        </div>
      </section>
    </>
  );
}
