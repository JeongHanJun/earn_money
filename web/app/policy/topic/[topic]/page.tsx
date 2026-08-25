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
        {sorted.map((s) => (
          <ServiceCard key={s.service_id} service={s} />
        ))}
      </div>
    </div>
  );
}
