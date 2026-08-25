import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-14">
      <Hero />
      <FeatureCards />
      <UpdateStrip />
      <SourceNote />
    </div>
  );
}

function Hero() {
  return (
    <section className="pt-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
        <span
          className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"
          aria-hidden
        />
        자동 수집·정리 시스템
      </div>
      <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight text-zinc-900">
        <span className="text-indigo-600">놓치기 쉬운 정보</span>,
        <br className="hidden sm:block" /> 지금 필요한 것만 모아드립니다.
      </h1>
      <p className="mt-4 text-lg text-zinc-600 leading-8 max-w-2xl">
        공공데이터 기반의 최신 <strong className="text-zinc-900">정책·지원금</strong>과
        <strong className="text-zinc-900"> 지역별 날씨</strong>,
        <strong className="text-zinc-900"> 실시간 트렌드</strong>를
        자동으로 정리해서 보여드립니다.
      </p>
    </section>
  );
}

function FeatureCards() {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <FeatureCard
        href="/weather"
        title="날씨"
        desc="전국 250개 시·군·구별 3일 단기예보. 지도에서 클릭 또는 지역 검색."
        freq="매시간 갱신"
        accent="sky"
        icon={
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
            <path
              d="M17 18a4 4 0 100-8h-1.26A6 6 0 106 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="2" />
          </svg>
        }
      />
      <FeatureCard
        href="/policy"
        title="정책·지원금"
        desc="청년정책, 중앙부처 복지서비스 등 오늘 신청 가능한 지원 정보."
        freq="매일 갱신"
        accent="indigo"
        icon={
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
            <path
              d="M4 7h16M4 12h16M4 17h10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        }
      />
      <FeatureCard
        href="/trends"
        title="실시간 트렌드"
        desc="Google Trends, Naver DataLab, Reddit 등 실시간 인기 키워드."
        freq="매시간 갱신"
        accent="amber"
        icon={
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
            <path
              d="M3 17l6-6 4 4 8-8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 7h7v7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
      />
    </section>
  );
}

function FeatureCard({
  href,
  title,
  desc,
  freq,
  accent,
  icon,
}: {
  href: string;
  title: string;
  desc: string;
  freq: string;
  accent: "indigo" | "amber" | "sky";
  icon: React.ReactNode;
}) {
  const styles = {
    indigo: {
      icon: "bg-indigo-100 text-indigo-700",
      hover: "hover:border-indigo-400",
      freqBadge: "bg-indigo-50 text-indigo-700 border-indigo-200",
      dot: "bg-indigo-500",
    },
    amber: {
      icon: "bg-amber-100 text-amber-700",
      hover: "hover:border-amber-400",
      freqBadge: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
    },
    sky: {
      icon: "bg-sky-100 text-sky-700",
      hover: "hover:border-sky-400",
      freqBadge: "bg-sky-50 text-sky-700 border-sky-200",
      dot: "bg-sky-500",
    },
  }[accent];

  return (
    <Link
      href={href}
      className={`group block rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md ${styles.hover} transition-all`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`inline-flex items-center justify-center h-11 w-11 rounded-xl ${styles.icon}`}
        >
          {icon}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles.freqBadge}`}
        >
          <span className={`h-1 w-1 rounded-full ${styles.dot}`} aria-hidden />
          {freq}
        </span>
      </div>
      <div className="mt-4 text-lg font-semibold tracking-tight">{title}</div>
      <div className="mt-1.5 text-sm text-zinc-600 leading-6">{desc}</div>
      <div className="mt-4 text-sm font-medium text-zinc-500 group-hover:text-zinc-900 transition-colors">
        바로가기 →
      </div>
    </Link>
  );
}

function UpdateStrip() {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 sm:p-8 text-white">
      <div className="text-xs font-medium uppercase tracking-wider text-indigo-200">
        Coming Soon
      </div>
      <h2 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight">
        모바일 앱으로 알림까지 받아보세요
      </h2>
      <p className="mt-2 text-indigo-100 text-sm sm:text-base leading-6 max-w-xl">
        관심 카테고리를 등록하면 새로운 정책이 뜰 때 바로 알려드립니다.
        (곧 출시 예정)
      </p>
    </section>
  );
}

function SourceNote() {
  return (
    <section className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 leading-6 shadow-sm">
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
          공공데이터포털(data.go.kr), 온통청년, 기상청 등. 최종 판단은 반드시
          원문 링크에서 확인해주세요.
        </span>
      </div>
    </section>
  );
}
