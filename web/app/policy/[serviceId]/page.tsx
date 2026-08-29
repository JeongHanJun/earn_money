import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { KakaoAdSlot } from "@/components/KakaoAdSlot";
import { FormattedText } from "@/components/FormattedText";
import { decodeEntities } from "@/lib/text";
import {
  allServices,
  getService,
  getServiceDetail,
  relatedServices,
  serviceFaq,
  topicSlug,
  type ApplyMethod,
  type ContactEntry,
  type UrlEntry,
} from "@/lib/policy";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return allServices().map((s) => ({ serviceId: s.service_id }));
}

export async function generateMetadata(
  props: PageProps<"/policy/[serviceId]">
): Promise<Metadata> {
  const { serviceId } = await props.params;
  const service = getService(serviceId);
  if (!service) return { title: "서비스를 찾을 수 없음" };

  const detail = getServiceDetail(serviceId);
  // 해시태그가 될 키워드들 (검색 노출용)
  const keywords = [
    service.service_name,
    ...service.interest_topics,
    ...service.life_stages,
    service.department,
    "지원금",
    "복지",
    "정부지원",
    detail?.target_groups?.[0],
  ].filter(Boolean) as string[];

  const description = (detail?.outline || service.summary).slice(0, 155);

  return {
    title: service.service_name,
    description,
    keywords,
    openGraph: {
      title: service.service_name,
      description,
      type: "article",
      locale: "ko_KR",
      siteName: "ryanpp",
    },
    twitter: {
      card: "summary",
      title: service.service_name,
      description,
    },
    alternates: {
      canonical: `/policy/${serviceId}`,
    },
  };
}

export default async function ServiceDetail(
  props: PageProps<"/policy/[serviceId]">
) {
  const { serviceId } = await props.params;
  const service = getService(serviceId);
  if (!service) notFound();

  const detail = getServiceDetail(serviceId);
  const related = relatedServices(service, 4);

  // JSON-LD 구조화 데이터 (Google 검색 리치 결과용)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name: service.service_name,
    description: detail?.outline || service.summary,
    provider: {
      "@type": "GovernmentOrganization",
      name: service.department,
      ...(service.org_name && { department: service.org_name }),
    },
    audience: {
      "@type": "PeopleAudience",
      ...(detail?.target_detail && { audienceType: detail.target_detail.slice(0, 200) }),
    },
    url: `https://ryanpp.com/policy/${serviceId}`,
    ...(service.detail_url && { sameAs: [service.detail_url] }),
    ...(service.contact && {
      contactPoint: {
        "@type": "ContactPoint",
        telephone: service.contact,
        contactType: "customer service",
      },
    }),
  };

  // 해시태그
  const hashtags = [
    ...service.interest_topics,
    ...service.life_stages,
    ...(detail?.target_groups ?? []),
    service.department.replace(/부$/, ""),
  ].filter(Boolean);

  const faq = serviceFaq(service, detail);
  const breadcrumb = breadcrumbJsonLd([
    { name: "홈", url: "/" },
    { name: "정책·지원금", url: "/policy" },
    { name: service.service_name },
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
        <span className="text-zinc-900">{service.service_name}</span>
      </nav>

      <header>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {service.service_name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">{service.department}</span>
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-500">{service.org_name}</span>
          {service.online_apply && (
            <span className="ml-1 inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              온라인 신청 가능
            </span>
          )}
        </div>
      </header>

      {/* 최상단 CTA: 신청/원문 링크 */}
      <PrimaryApplyCTA
        primaryUrl={service.detail_url}
        online={service.online_apply}
        relatedSites={detail?.related_sites ?? []}
      />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">서비스 요약</h2>
        <div className="mt-3">
          <FormattedText raw={detail?.outline || service.summary} />
        </div>
      </section>

      {detail?.target_detail && (
        <ContentSection title="지원 대상" body={detail.target_detail} />
      )}
      {detail?.selection_criteria && (
        <ContentSection title="선정 기준" body={detail.selection_criteria} />
      )}
      {detail?.benefit_detail && (
        <ContentSection title="지원 내용" body={detail.benefit_detail} accent="indigo" />
      )}

      {(detail?.apply_methods?.length ||
        detail?.related_sites?.length ||
        service.detail_url) && (
        <ApplyMethodsSection
          methods={detail?.apply_methods ?? []}
          primaryUrl={service.detail_url}
          online={service.online_apply}
          relatedSites={detail?.related_sites ?? []}
        />
      )}

      {detail?.inquiry_contacts && detail.inquiry_contacts.length > 0 && (
        <ContactsSection contacts={detail.inquiry_contacts} />
      )}

      <AdSlot slot="9364867007" />


      {detail?.forms && detail.forms.length > 0 && (
        <FormsSection forms={detail.forms} />
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <InfoCard title="지원 주기" value={service.support_cycle || "-"} />
        <InfoCard title="지원 유형" value={service.provision_type || "-"} />
        <InfoCard title="담당 부처" value={service.department} />
        <InfoCard title="담당 조직" value={service.org_name || "-"} />
        <InfoCard title="대표 문의처" value={service.contact || "-"} />
        <InfoCard title="최초 등록일" value={formatDate(service.first_registered)} />
      </section>

      {detail?.laws && detail.laws.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-3">근거 법령</h2>
          <ul className="space-y-1.5">
            {detail.laws.map((law) => (
              <li key={law} className="text-sm text-zinc-700 leading-6">
                · {law}
              </li>
            ))}
          </ul>
        </section>
      )}

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
                <div className="mt-3 pt-3 border-t border-zinc-100 text-sm text-zinc-700 leading-6">
                  <FormattedText raw={item.answer} />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      <HashtagSection tags={hashtags} interestTopics={service.interest_topics} />

      <KakaoAdSlot />

      {related.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-3">관련 서비스</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.service_id}
                href={`/policy/${r.service_id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors"
              >
                <div className="text-sm font-semibold text-zinc-900 leading-tight">
                  {r.service_name}
                </div>
                <div className="mt-1 text-xs text-zinc-500 line-clamp-1">
                  {r.summary}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <AdSlot slot="2799458650" format="autorelaxed" responsive={false} />

      <p className="text-xs text-zinc-400 text-center">
        정보 오류·최신성 확인 필수. 실 신청은 상단 원문 링크에서.
      </p>
    </div>
  );
}

function PrimaryApplyCTA({
  primaryUrl,
  online,
  relatedSites,
}: {
  primaryUrl: string;
  online: boolean;
  relatedSites: UrlEntry[];
}) {
  const ctaLabel = online ? "온라인 신청하러 가기" : "복지로에서 자세히 보기";
  const ctaBg = online
    ? "bg-emerald-600 hover:bg-emerald-700"
    : "bg-indigo-600 hover:bg-indigo-700";
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <a
        href={primaryUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-between gap-3 rounded-xl px-5 py-4 text-white font-semibold transition-colors ${ctaBg}`}
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
          {ctaLabel}
        </span>
        <span aria-hidden>→</span>
      </a>
      {relatedSites.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {relatedSites.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-indigo-400 hover:text-indigo-700 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                <path
                  d="M14 3h7v7M10 14L21 3M21 14v6a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {s.name || "관련 사이트"}
            </a>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-zinc-500">
        정확한 자격조건·신청기한은 반드시 원문에서 확인해주세요.
      </p>
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
  accent?: "indigo";
}) {
  const borderCls =
    accent === "indigo" ? "border-indigo-200 bg-indigo-50/40" : "border-zinc-200 bg-white";
  return (
    <section className={`rounded-xl border ${borderCls} p-5 shadow-sm`}>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3">
        <FormattedText raw={body} />
      </div>
    </section>
  );
}

function ApplyMethodsSection({
  methods,
  primaryUrl,
  online,
  relatedSites,
}: {
  methods: ApplyMethod[];
  primaryUrl: string;
  online: boolean;
  relatedSites: UrlEntry[];
}) {
  const ctaLabel = online ? "온라인 신청" : "복지로 상세페이지";
  const ctaBg = online
    ? "bg-emerald-600 hover:bg-emerald-700"
    : "bg-indigo-600 hover:bg-indigo-700";
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

      {/* 신청 링크 CTA (본문 안에도 재노출 - 아래에서 바로 신청 가능) */}
      <div className="mt-4 flex flex-wrap gap-2">
        {primaryUrl && (
          <a
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${ctaBg}`}
          >
            {ctaLabel} →
          </a>
        )}
        {relatedSites.map((s, i) => (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:border-emerald-500 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
              <path
                d="M14 3h7v7M10 14L21 3M21 14v6a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {s.name || "관련 사이트"}
          </a>
        ))}
      </div>

      {methods.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="text-xs font-medium text-emerald-900 uppercase tracking-wider">
            신청 절차 상세
          </div>
          {methods.map((m, i) => (
            <div
              key={`${m.name}-${i}`}
              className="rounded-lg border border-emerald-200 bg-white p-4"
            >
              <div className="text-sm font-semibold text-emerald-900">
                {decodeEntities(m.name)}
              </div>
              <div className="mt-1.5 text-sm">
                <FormattedText raw={m.description} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ContactsSection({ contacts }: { contacts: ContactEntry[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight mb-3">문의처</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {contacts.map((c, i) => (
          <div
            key={`c-${i}`}
            className="rounded-lg border border-zinc-200 bg-white p-3 flex items-center gap-3"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-zinc-500">
              <path
                d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0122 16.92z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-zinc-500">{c.name}</div>
              <div className="text-sm font-medium text-zinc-900 truncate">{c.contact}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FormsSection({ forms }: { forms: UrlEntry[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight mb-3">서식·자료 다운로드</h2>
      <div className="grid gap-2">
        {forms.map((f, i) => (
          <a
            key={`f-${i}`}
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-zinc-600">
              <path
                d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="text-sm text-zinc-900 truncate">{f.name}</div>
          </a>
        ))}
      </div>
    </section>
  );
}

function HashtagSection({
  tags,
  interestTopics,
}: {
  tags: string[];
  interestTopics: string[];
}) {
  const unique = Array.from(new Set(tags));
  const topicSet = new Set(interestTopics);
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-zinc-500 mb-3">관련 태그</h2>
      <div className="flex flex-wrap gap-2">
        {unique.map((tag) => {
          const isTopic = topicSet.has(tag);
          const content = (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm border ${
                isTopic
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                  : "bg-zinc-50 text-zinc-700 border-zinc-200"
              }`}
            >
              #{tag}
            </span>
          );
          return isTopic ? (
            <Link key={tag} href={`/policy/topic/${topicSlug(tag)}`}>
              {content}
            </Link>
          ) : (
            <span key={tag}>{content}</span>
          );
        })}
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

function formatDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length < 8) return "-";
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}
