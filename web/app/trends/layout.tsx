import Link from "next/link";
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
      <p className="mt-6 text-xs text-zinc-500 text-center">
        데이터 소스 상세는{" "}
        <Link href="/privacy" className="underline hover:text-zinc-700">
          개인정보처리방침
        </Link>
        {" "}참고
      </p>
    </>
  );
}
