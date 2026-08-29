import Link from "next/link";
import { KakaoAdSlot } from "@/components/KakaoAdSlot";
import { recentServices } from "@/lib/policy";
import { recentYouthPolicies } from "@/lib/youth";
import type { WelfareService } from "@/lib/policy";
import type { YouthPolicy } from "@/lib/youth";

export default function HomePage() {
  const newPolicies = recentServices(3);
  const newYouth = recentYouthPolicies(3);
  return (
    <div className="space-y-14">
      <Hero />
      <FeatureCards />
      <FreshPolicies services={newPolicies} youth={newYouth} />
      <UpdateStrip />
      <KakaoAdSlot />
      <SourceNote />
    </div>
  );
}

function FreshPolicies({
  services,
  youth,
}: {
  services: WelfareService[];
  youth: YouthPolicy[];
}) {
  return (
    <section aria-labelledby="fresh-heading">
      <div className="flex items-baseline justify-between mb-4">
        <h2 id="fresh-heading" className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
          최근 등록된 정책·지원금
        </h2>
        <Link href="/policy" className="text-sm text-indigo-600 hover:underline font-medium">
          전체 보기 →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <Link
            key={s.service_id}
            href={`/policy/${s.service_id}`}
            className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors"
          >
            <div className="text-xs font-medium text-indigo-600 mb-1">복지 서비스</div>
            <div className="text-base font-semibold text-zinc-900 leading-snug line-clamp-2">
              {s.service_name}
            </div>
            <div className="mt-1.5 text-xs text-zinc-500 line-clamp-2 leading-5">
              {s.summary}
            </div>
            <div className="mt-2.5 text-[11px] text-zinc-500">
              {s.department}
              {s.online_apply && (
                <span className="ml-1.5 inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                  온라인 신청
                </span>
              )}
            </div>
          </Link>
        ))}
        {youth.map((p) => (
          <Link
            key={p.plcy_no}
            href={`/policy/youth/${p.plcy_no}`}
            className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-amber-400 hover:bg-amber-50/40 transition-colors"
          >
            <div className="text-xs font-medium text-amber-600 mb-1">청년정책</div>
            <div className="text-base font-semibold text-zinc-900 leading-snug line-clamp-2">
              {p.name}
            </div>
            <div className="mt-1.5 text-xs text-zinc-500 line-clamp-2 leading-5">
              {p.description}
            </div>
            <div className="mt-2.5 text-[11px] text-zinc-500">
              {p.department}
              {p.major_category && <span className="ml-1.5">· {p.major_category}</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
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
        매시간 자동 갱신
      </div>
      <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight text-zinc-900">
        놓치기 쉬운 <span className="text-indigo-600">정책·지원금</span>,
        <br className="hidden sm:block" /> 지금 확인해보세요.
      </h1>
      <p className="mt-4 text-base sm:text-lg text-zinc-600 leading-7 sm:leading-8 max-w-2xl">
        공공데이터 기반 <strong className="text-zinc-900">3,200개 정책·지원금</strong>,
        <strong className="text-zinc-900"> 전국 250 시·군·구 날씨</strong>,
        <strong className="text-zinc-900"> 실시간 트렌드</strong>를
        한곳에서 확인하세요.
      </p>
      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link
          href="/policy"
          className="inline-flex items-center rounded-lg bg-indigo-600 text-white px-4 py-2 font-medium hover:bg-indigo-700 transition-colors"
        >
          정책 둘러보기 →
        </Link>
        <Link
          href="/weather"
          className="inline-flex items-center rounded-lg border border-zinc-300 bg-white text-zinc-700 px-4 py-2 font-medium hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
        >
          우리 동네 날씨
        </Link>
      </div>
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
        desc="청년정책 2,700+, 중앙부처 복지 461개. 실 신청 링크 포함."
        freq="매시간 갱신"
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
        desc="Google Trends·YouTube·Naver·Daum·HN 6개 소스 실시간 랭킹."
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
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-indigo-200">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-4 w-4"
          aria-hidden
        >
          <rect
            x="4"
            y="2"
            width="16"
            height="20"
            rx="3"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="12" cy="18" r="1" fill="currentColor" />
        </svg>
        홈 스크린에 추가
      </div>
      <h2 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight">
        앱처럼 편하게 열어보세요
      </h2>
      <p className="mt-2 text-indigo-100 text-sm sm:text-base leading-6 max-w-xl">
        모바일 브라우저의 <strong>공유 → 홈 화면에 추가</strong>를 누르면
        앱 아이콘으로 바로 접근 가능합니다. 별도 다운로드 필요 없음.
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
