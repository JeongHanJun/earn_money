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
    </>
  );
}
