import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "ryanpp 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <article className="space-y-8">
      <header className="border-b border-zinc-200 pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          개인정보처리방침
        </h1>
        <p className="mt-2 text-sm text-zinc-500">최종 업데이트: 2026-08-23</p>
      </header>

      <Callout>
        본 사이트는 <strong className="text-zinc-900">회원가입 절차가 없으며</strong>,
        이용자의 이름·이메일·연락처 등을 직접 수집하지 않습니다.
      </Callout>

      <Section title="1. 수집하는 개인정보 항목">
        <p className="text-zinc-700 leading-8">
          서비스 개선을 위해 다음과 같은 정보가 자동 수집될 수 있습니다.
        </p>
        <BulletList
          items={[
            "접속 기록 (방문 시각, 요청 URL, 리퍼러)",
            "브라우저 유형·버전, 기기 유형, 화면 해상도",
            "IP 주소 (익명화된 형태)",
          ]}
        />
      </Section>

      <Section title="2. 개인정보의 수집 및 이용 목적">
        <BulletList
          items={[
            "서비스 이용 통계 분석 및 콘텐츠 개선",
            "비정상 접근 탐지 및 서비스 안정성 확보",
            "광고 게재 및 광고 성과 측정",
          ]}
        />
      </Section>

      <Section title="3. 제3자 서비스 이용">
        <p className="text-zinc-700 leading-8">
          본 사이트는 다음의 제3자 서비스를 통해 방문 통계 및 광고를
          처리합니다. 각 서비스는 자체 개인정보처리방침을 따릅니다.
        </p>
        <BulletList
          items={[
            "Google Analytics 4 (방문 통계)",
            "Google AdSense (광고 게재)",
            "Cloudflare (배포 및 CDN, 접속 로그 처리)",
          ]}
        />
      </Section>

      <Section title="4. 쿠키의 사용">
        <p className="text-zinc-700 leading-8">
          본 사이트는 서비스 이용 통계 수집과 광고 개인화를 위해 쿠키를
          사용합니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수
          있습니다.
        </p>
      </Section>

      <Section title="5. 개인정보의 보유 기간">
        <p className="text-zinc-700 leading-8">
          접속 로그는 최대 <strong className="text-zinc-900">12개월</strong>간
          보관되며, 이후 자동 삭제됩니다. 통계 처리 데이터는 개인 식별이
          불가능한 형태로 익명화되어 별도 보관될 수 있습니다.
        </p>
      </Section>

      <Section title="6. 이용자의 권리">
        <p className="text-zinc-700 leading-8">
          본 사이트는 개인정보를 직접 수집하지 않으므로, 이용자가 별도의
          열람·정정 요청을 할 대상 정보는 없습니다. Google Analytics 데이터
          수집 거부는 브라우저에 Google Analytics 옵트아웃 부가기능을 설치하여
          처리하실 수 있습니다.
        </p>
      </Section>

      <Section title="7. 문의처">
        <p className="text-zinc-700 leading-8">
          개인정보 처리에 관한 문의는 이메일로 접수됩니다.
        </p>
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
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
        {title}
      </h2>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2.5 text-zinc-700 leading-7"
        >
          <span className="mt-2.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5 shrink-0 mt-0.5 text-indigo-600"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 8v5M12 16v.01"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div className="text-sm text-indigo-900 leading-7">{children}</div>
    </div>
  );
}
