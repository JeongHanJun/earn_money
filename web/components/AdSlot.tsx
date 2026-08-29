"use client";

import { useEffect } from "react";

/**
 * AdSense 광고 슬롯. env NEXT_PUBLIC_ADSENSE_CLIENT_ID 없으면 아무것도 렌더 안 함.
 * 심사 통과 후 .env 에 ID 넣으면 즉시 활성화.
 */
export function AdSlot({
  slot,
  format = "auto",
  responsive = true,
  className = "",
}: {
  slot: string;
  format?: "auto" | "rectangle" | "vertical" | "horizontal" | "autorelaxed";
  responsive?: boolean;
  className?: string;
}) {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    try {
      const win = window as unknown as { adsbygoogle?: unknown[] };
      win.adsbygoogle = win.adsbygoogle || [];
      win.adsbygoogle.push({});
    } catch {
      // ignore duplicate init errors
    }
  }, [clientId, slot]);

  if (!clientId) return null;

  return (
    <div className={`my-4 min-h-[100px] flex justify-center items-center ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%" }}
        data-ad-client={clientId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}
