"use client";

import { useEffect } from "react";

/**
 * KakaoAdFit 광고 슬롯.
 * env NEXT_PUBLIC_KAKAO_ADFIT_UNIT_300x250 없으면 아무것도 렌더 안 함.
 */
export function KakaoAdSlot({
  size = "300x250",
  className = "",
}: {
  size?: "300x250" | "320x100" | "320x50" | "728x90" | "160x600";
  className?: string;
}) {
  const unitId = process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT_300x250;

  useEffect(() => {
    if (!unitId) return;
    // KakaoAdFit SDK가 <ins> 스캔해서 광고 삽입 — SDK가 layout에서 이미 로드됨
    // 단, 클라이언트 재렌더 시 다시 스캔 필요할 수 있음
    try {
      const win = window as unknown as { adfit?: { loadAd?: () => void } };
      win.adfit?.loadAd?.();
    } catch {
      // ignore
    }
  }, [unitId]);

  if (!unitId) return null;

  const [w, h] = size.split("x");
  return (
    <div
      className={`my-6 flex justify-center ${className}`}
      style={{ minHeight: `${h}px` }}
    >
      <ins
        className="kakao_ad_area"
        style={{ display: "none" }}
        data-ad-unit={unitId}
        data-ad-width={w}
        data-ad-height={h}
      />
    </div>
  );
}
