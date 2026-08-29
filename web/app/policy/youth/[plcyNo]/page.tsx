import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { KakaoAdSlot } from "@/components/KakaoAdSlot";
import { FormattedText } from "@/components/FormattedText";
import {
  allYouthPolicies,
  formatYouthDate,
  getYouthPolicy,
  relatedYouthPolicies,
  youthCategorySlug,
  youthFaq,
} from "@/lib/youth";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return allYouthPolicies().map((p) => ({ plcyNo: p.plcy_no }));
}

export async function generateMetadata(
  props: PageProps<"/policy/youth/[plcyNo]">
): Promise<Metadata> {
  const { plcyNo } = await props.params;
  const policy = getYouthPolicy(plcyNo);
  if (!policy) return { title: "청년정책을 찾을 수 없음" };

  const keywords = [
    policy.name,
    policy.keyword,
    policy.major_category,
    policy.sub_category,
    policy.department,
    "청년정책",
    "청년지원",
    "정부지원",
  ]
    .filter(Boolean)
    .flatMap((k) => k.split(/[,·]/).map((s) => s.trim()))
    .filter(Boolean);

  const description = policy.description.slice(0, 155);

  return {
    title: policy.name,
    description,
    keywords,
    openGraph: {
      title: policy.name,
      description,
      type: "article",
      locale: "ko_KR",
      siteName: "ryanpp",
    },
    alternates: { canonical: `/policy/youth/${plcyNo}` },
  };
}

export default async function YouthDetail(
  props: PageProps<"/policy/youth/[plcyNo]">
) {
  const { plcyNo } = await props.params;
  const policy = getYouthPolicy(plcyNo);
  if (!policy) notFound();

  const related = relatedYouthPolicies(policy, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name: policy.name,
    description: policy.description,
    provider: {
      "@type": "GovernmentOrganization",
      name: policy.department,
    },
    ...(policy.apply_url && { url: policy.apply_url }),
    ...(policy.min_age > 0 &&
      policy.max_age > 0 && {
        audience: {
          "@type": "PeopleAudience",
          requiredMinAge: policy.min_age,
          requiredMaxAge: policy.max_age,
        },
      }),
  };

  const hashtags = [
    policy.major_category,
    policy.sub_category,
    ...(policy.keyword ? policy.keyword.split(",").map((k) => k.trim()) : []),
    "청년정책",
  ].filter(Boolean);

  const ageText =
    policy.age_limit && policy.min_age > 0 && policy.max_age > 0
      ? `만 ${policy.min_age}세 ~ ${policy.max_age}세`
      : "연령 제한 없음";

  const earnText =
    policy.earn_min > 0 || policy.earn_max > 0
      ? `연 ${policy.earn_min.toLocaleString()}원 ~ ${policy.earn_max.toLocaleString()}원`
      : policy.earn_note || "소득 조건 없음";

  const faq = youthFaq(policy);
  const breadcrumb = breadcrumbJsonLd([
    { name: "홈", url: "/" },
    { name: "정책·지원금", url: "/policy" },
    { name: "청년정책", url: "/policy/youth" },
    { name: policy.name },
  ]);
  const faqLd = faq.length > 0 ? faqJsonLd(faq) : null;

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}

      <nav className="text-sm text-zinc-500">
        <Link href="/policy" className="hover:text-zinc-900">
          정책·지원금
        </Link>
        <span className="mx-2">/</span>
        <Link href="/policy/youth" className="hover:text-zinc-900">
          청년정책
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900">{policy.name}</span>
      </nav>

      <header>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {policy.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">{policy.department}</span>
          {policy.major_category && (
            <>
              <span className="text-zinc-400">·</span>
              <Link
                href={`/policy/youth/category/${youthCategorySlug(policy.major_category)}`}
                className="text-amber-700 hover:underline"
              >
                {policy.major_category}
              </Link>
            </>
          )}
          {policy.sub_category && (
            <span className="text-zinc-500">/ {policy.sub_category}</span>
          )}
        </div>
      </header>

      {/* 최상단 신청 CTA */}
      <PrimaryApplyCTA
        applyUrl={policy.apply_url}
        refUrls={policy.ref_urls}
        applyPeriod={policy.apply_period}
      />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">정책 개요</h2>
        <div className="mt-3">
          <FormattedText raw={policy.description} />
        </div>
      </section>

      {policy.support_content && (
        <ContentSection
          title="지원 내용"
          body={policy.support_content}
          accent="amber"
        />
      )}

      {(policy.apply_method || policy.apply_url || policy.ref_urls.length > 0) && (
        <ApplyMethodSection
          method={policy.apply_method}
          applyUrl={policy.apply_url}
          refUrls={policy.ref_urls}
        />
      )}

      <AdSlot slot="8051785333" />


      <section className="grid gap-4 sm:grid-cols-2">
        <InfoCard title="지원 대상 연령" value={ageText} />
        <InfoCard title="소득 조건" value={earnText} />
        <InfoCard
          title="사업 기간"
          value={
            policy.biz_start && policy.biz_end
              ? `${formatYouthDate(policy.biz_start)} ~ ${formatYouthDate(policy.biz_end)}`
              : "-"
          }
        />
        <InfoCard title="신청 기간" value={policy.apply_period || "-"} />
      </section>

      {policy.add_qual && (
        <ContentSection title="추가 자격 조건" body={policy.add_qual} />
      )}
      {policy.submission_docs && (
        <ContentSection title="제출 서류" body={policy.submission_docs} />
      )}
      {policy.screening && (
        <ContentSection title="심사 방법" body={policy.screening} />
      )}
      {policy.etc && <ContentSection title="기타 사항" body={policy.etc} />}

      {faq.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-3">자주 묻는 질문</h2>
          <div className="space-y-3">
            {faq.map((item, i) => (
              <details
                key={i}
                className="group rounded-xl border border-zinc-200 bg-white p-4 open:shadow-sm"
                {...(i === 0 ? { open: true } : {})}
              >
                <summary className="cursor-pointer list-none flex items-start justify-between gap-3">
                  <span className="font-semibold text-zinc-900 leading-snug">
                    Q. {item.question}
                  </span>
                  <span className="mt-0.5 shrink-0 text-zinc-400 group-open:rotate-180 transition-transform">
                    ▾
                  </span>
                </summary>
                <div className="mt-3 pt-3 border-t border-zinc-100 text-sm text-zinc-700 leading-6 whitespace-pre-wrap">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      <HashtagSection tags={hashtags} />

      <KakaoAdSlot />

      {related.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-3">
            관련 청년정책
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.plcy_no}
                href={`/policy/youth/${r.plcy_no}`}
                className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-amber-400 hover:bg-amber-50/40 transition-colors"
              >
                <div className="text-sm font-semibold text-zinc-900 leading-tight">
                  {r.name}
                </div>
                <div className="mt-1 text-xs text-zinc-500 line-clamp-1">
                  {r.description}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <AdSlot slot="2799458650" format="autorelaxed" responsive={false} />

      <p className="text-xs text-zinc-400 text-center">
        정보 오류·최신성 확인 필수. 실 신청은 상단 신청 링크에서.
      </p>
    </div>
  );
}

function PrimaryApplyCTA({
  applyUrl,
  refUrls,
  applyPeriod,
}: {
  applyUrl: string;
  refUrls: string[];
  applyPeriod: string;
}) {
  if (!applyUrl && refUrls.length === 0) return null;
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
      {applyUrl && (
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-xl px-5 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M14 3h7v7M10 14L21 3M21 14v6a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            신청하러 가기
          </span>
          <span aria-hidden>→</span>
        </a>
      )}
      {refUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {refUrls.map((u, i) => (
            <a
              key={i}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-emerald-500 hover:text-emerald-800 transition-colors"
            >
              참고 링크 {refUrls.length > 1 ? i + 1 : ""}
            </a>
          ))}
        </div>
      )}
      {applyPeriod && (
        <p className="mt-3 text-xs text-emerald-900">
          <strong>신청 기간:</strong> {applyPeriod}
        </p>
      )}
    </section>
  );
}

function ApplyMethodSection({
  method,
  applyUrl,
  refUrls,
}: {
  method: string;
  applyUrl: string;
  refUrls: string[];
}) {
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-emerald-600">
          <path
            d="M9 12l2 2 4-4M20 12a8 8 0 11-16 0 8 8 0 0116 0z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h2 className="text-lg font-semibold tracking-tight">신청 방법</h2>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {applyUrl && (
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
          >
            신청 사이트 →
          </a>
        )}
        {refUrls.map((u, i) => (
          <a
            key={i}
            href={u}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:border-emerald-500 transition-colors"
          >
            참고 링크 {refUrls.length > 1 ? i + 1 : ""}
          </a>
        ))}
      </div>

      {method && (
        <div className="mt-5">
          <div className="text-xs font-medium text-emerald-900 uppercase tracking-wider">
            신청 절차 상세
          </div>
          <div className="mt-2 text-sm">
            <FormattedText raw={method} />
          </div>
        </div>
      )}
    </section>
  );
}

function ContentSection({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent?: "amber";
}) {
  const borderCls =
    accent === "amber"
      ? "border-amber-200 bg-amber-50/40"
      : "border-zinc-200 bg-white";
  return (
    <section className={`rounded-xl border ${borderCls} p-5 shadow-sm`}>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3">
        <FormattedText raw={body} />
      </div>
    </section>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="text-xs font-medium text-zinc-500">{title}</div>
      <div className="mt-1 text-sm text-zinc-900">{value}</div>
    </div>
  );
}

function HashtagSection({ tags }: { tags: string[] }) {
  const unique = Array.from(new Set(tags));
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-zinc-500 mb-3">관련 태그</h2>
      <div className="flex flex-wrap gap-2">
        {unique.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full px-3 py-1 text-sm border bg-amber-50 text-amber-700 border-amber-200"
          >
            #{tag}
          </span>
        ))}
      </div>
    </section>
  );
}
