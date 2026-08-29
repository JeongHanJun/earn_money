import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceCard } from "@/components/ServiceCard";
import {
  servicesByTopic,
  servicesForTopic,
  topicFromSlug,
  topicSlug,
} from "@/lib/policy";

export function generateStaticParams() {
  const topics = Array.from(servicesByTopic().keys());
  return topics.map((t) => ({ topic: topicSlug(t) }));
}

export async function generateMetadata(
  props: PageProps<"/policy/topic/[topic]">
): Promise<Metadata> {
  const { topic: slug } = await props.params;
  const topic = topicFromSlug(slug);
  if (!topic) return { title: "주제를 찾을 수 없음" };
  return {
    title: `${topic} 지원금·정책`,
    description: `${topic} 관련 중앙부처 복지서비스 전체 목록. 신청 조건과 원문 링크.`,
  };
}

export default async function TopicPage(
  props: PageProps<"/policy/topic/[topic]">
) {
  const { topic: slug } = await props.params;
  const topic = topicFromSlug(slug);
  if (!topic) notFound();

  const services = servicesForTopic(topic);
  if (services.length === 0) notFound();

  const sorted = [...services].sort(
    (a, b) => b.inquiry_count - a.inquiry_count
  );

  return (
    <div className="space-y-8">
      <nav className="text-sm text-zinc-500">
        <Link href="/policy" className="hover:text-zinc-900">
          정책·지원금
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900">{topic}</span>
      </nav>

      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          {services.length}개 서비스
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
          {topic}
        </h1>
        <p className="mt-2 text-zinc-600">
          {topic} 관련 중앙부처 복지서비스 · 조회수 순
        </p>
      </header>

      <div className="grid gap-3">
        {sorted.slice(0, 50).map((s) => (
          <ServiceCard key={s.service_id} service={s} />
        ))}
      </div>

      {sorted.length > 50 && (
        <section aria-labelledby="more-heading" className="mt-8">
          <h2
            id="more-heading"
            className="text-lg font-semibold tracking-tight mb-3"
          >
            더 많은 {topic} 서비스 ({sorted.length - 50}개)
          </h2>
          <p className="text-xs text-zinc-500 mb-4 leading-5">
            상단 검색바에서 키워드로 빠르게 찾을 수 있습니다.
          </p>
          <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {sorted.slice(50).map((s) => (
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
        </section>
      )}
    </div>
  );
}
