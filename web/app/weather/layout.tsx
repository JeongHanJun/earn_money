import { KakaoAdSlot } from "@/components/KakaoAdSlot";

export default function WeatherLayout({
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
            기상청 단기예보 API (공공데이터포털 data.go.kr). 전국 17개 시·도 +
            250개 시·군·구 3일 단기예보. 매시간 자동 갱신. 실제 기상 판단은
            반드시 기상청 원문(kma.go.kr) 확인 필수.
          </span>
        </div>
      </section>
    </>
  );
}
