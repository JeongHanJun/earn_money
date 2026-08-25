import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관",
  description: "ryanpp 이용약관",
};

export default function TermsPage() {
  return (
    <article className="space-y-8">
      <header className="border-b border-zinc-200 pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          이용약관
        </h1>
        <p className="mt-2 text-sm text-zinc-500">최종 업데이트: 2026-08-23</p>
      </header>

      <Section title="제1조 (목적)">
        본 약관은 ryanpp(이하 &quot;사이트&quot;)이 제공하는 모든 서비스의
        이용 조건 및 절차, 이용자와 사이트의 권리·의무·책임 사항을 규정함을
        목적으로 합니다.
      </Section>

      <Section title="제2조 (서비스의 성격)">
        본 사이트는 <strong className="text-zinc-900">공공데이터포털 및 각 기관의 공개 API</strong>를
        통해 수집한 정보를 재가공하여 제공하는 정보 안내 서비스입니다. 게시된
        정보는 참고용이며, 실제 신청·집행 시 반드시 원문 출처 및 관할 기관의
        최신 공고를 확인해야 합니다.
      </Section>

      <Section title="제3조 (면책)">
        사이트는 게시된 정보의 정확성·완전성·최신성을 보장하지 않으며, 이를
        기반으로 한 이용자의 결정 및 행위에 대해 책임지지 않습니다.{" "}
        <strong className="text-zinc-900">
          정책·지원금 신청 결과, 세무 판단, 투자·재정 결정 등은 전적으로 이용자
          본인의 책임입니다.
        </strong>
      </Section>

      <Section title="제4조 (저작권)">
        본 사이트가 자체 생산한 요약·정리 콘텐츠의 저작권은 사이트에 있습니다.
        원문 자료의 저작권은 각 원 출처에 있으며, 본 사이트는 각 자료의 출처와
        원문 링크를 함께 제공합니다.
      </Section>

      <Section title="제5조 (문의)">
        약관 및 서비스 관련 문의는 사이트 하단 개인정보처리방침에 명시된
        연락처를 통해 접수됩니다.
      </Section>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
        {title}
      </h2>
      <p className="mt-3 text-zinc-700 leading-8">{children}</p>
    </section>
  );
}
