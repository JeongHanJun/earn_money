import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceCard } from "@/components/ServiceCard";
import { YouthCard } from "@/components/YouthCard";
import { activeTags, getTag } from "@/lib/tags";

export function generateStaticParams() {
  return activeTags().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(
  props: PageProps<"/policy/tag/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const decoded = decodeURIComponent(slug);
  const tag = getTag(decoded);
  if (!tag) return { title: "태그를 찾을 수 없음" };

  const description = `${tag.name} 관련 정책·지원금 ${tag.count}건. 신청 조건·기간·방법 정리. 온라인 신청 링크 포함.`;

  return {
    title: `${tag.name} 관련 정책·지원금 ${tag.count}건`,
    description,
    keywords: [tag.name, `${tag.name} 지원`, `${tag.name} 정책`, `${tag.name} 신청`, "정부지원"],
    openGraph: {
      title: `#${tag.name} — ryanpp`,
      description,
      type: "website",
      locale: "ko_KR",
      siteName: "ryanpp",
    },
    alternates: { canonical: `/policy/tag/${encodeURIComponent(tag.slug)}` },
  };
}

export default async function TagPage(
  props: PageProps<"/policy/tag/[slug]">,
) {
  const { slug } = await props.params;
  const decoded = decodeURIComponent(slug);
  const tag = getTag(decoded);
  if (!tag) notFound();

  const welfare = [...tag.welfare].sort(
    (a, b) => b.inquiry_count - a.inquiry_count,
  );
  const youth = [...tag.youth].sort(
    (a, b) => b.inquiry_count - a.inquiry_count,
  );

  return (
    <div className="space-y-8">
      <nav className="text-sm text-zinc-500">
        <Link href="/policy" className="hover:text-zinc-900">
          정책·지원금
        </Link>
        <span className="mx-2">/</span>
        <Link href="/policy/tags" className="hover:text-zinc-900">
          태그
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900">#{tag.name}</span>
      </nav>

      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          {tag.count}건
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          <span className="text-indigo-600">#</span>
          {tag.name}
        </h1>
        <p className="mt-2 text-zinc-600 leading-7">
          {tag.name} 관련 중앙부처 복지서비스와 청년정책 모음. 조회수 순.
        </p>
      </header>

      {welfare.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-3">
            복지서비스 ({welfare.length})
          </h2>
          <div className="grid gap-3">
            {welfare.slice(0, 20).map((s) => (
              <ServiceCard key={s.service_id} service={s} />
            ))}
          </div>
          {welfare.length > 20 && (
            <>
              <ul className="mt-4 grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {welfare.slice(20, 120).map((s) => (
                  <li key={s.service_id}>
                    <Link
                      href={`/policy/${s.service_id}`}
                      className="block text-zinc-700 hover:text-indigo-700 hover:underline leading-6 truncate"
                      title={s.service_name}
                    >
                      {s.service_name}
                    </Link>
                  </li>
                ))}
              </ul>
              {welfare.length > 120 && (
                <p className="mt-3 text-xs text-zinc-500">
                  그 외 {welfare.length - 120}건은 상단 검색바로 찾아보세요.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {youth.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-3">
            청년정책 ({youth.length})
          </h2>
          <div className="grid gap-3">
            {youth.slice(0, 20).map((p) => (
              <YouthCard key={p.plcy_no} policy={p} />
            ))}
          </div>
          {youth.length > 20 && (
            <>
              <ul className="mt-4 grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {youth.slice(20, 120).map((p) => (
                  <li key={p.plcy_no}>
                    <Link
                      href={`/policy/youth/${p.plcy_no}`}
                      className="block text-zinc-700 hover:text-amber-700 hover:underline leading-6 truncate"
                      title={p.name}
                    >
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
              {youth.length > 120 && (
                <p className="mt-3 text-xs text-zinc-500">
                  그 외 {youth.length - 120}건은 상단 검색바로 찾아보세요.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
