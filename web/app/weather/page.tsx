import type { Metadata } from "next";
import { KoreaMap } from "@/components/KoreaMap";
import { RegionSelect } from "@/components/RegionSelect";

export const metadata: Metadata = {
  title: "날씨",
  description: "전국 시군구 단위 단기예보 (3일치, 3시간 간격). 지역을 선택하세요.",
};

export default function WeatherIndex() {
  return (
    <div className="space-y-8">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          <span
            className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"
            aria-hidden
          />
          매시간 갱신 · 기상청 단기예보
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          날씨
        </h1>
        <p className="mt-2 text-zinc-600 leading-7">
          지도를 클릭하거나 아래 드롭다운으로 지역을 선택하세요.
        </p>
      </header>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-medium text-zinc-500 mb-2">지역 선택</div>
        <RegionSelect />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
        <KoreaMap />
      </div>

      <p className="text-xs text-zinc-500 text-center">
        출처: 기상청 단기예보 조회서비스 (data.go.kr)
      </p>
    </div>
  );
}
