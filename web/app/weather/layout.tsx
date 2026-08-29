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
    </>
  );
}
