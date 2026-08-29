import Link from "next/link";
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
      <p className="mt-6 text-xs text-zinc-500 text-center">
        기상청 단기예보 API 기반 · 데이터 소스 상세는{" "}
        <Link href="/privacy" className="underline hover:text-zinc-700">
          개인정보처리방침
        </Link>
      </p>
    </>
  );
}
