import Link from "next/link";
import type { WelfareService } from "@/lib/policy";

export function ServiceCard({ service }: { service: WelfareService }) {
  return (
    <Link
      href={`/policy/${service.service_id}`}
      className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-zinc-900 leading-tight">
          {service.service_name}
        </h3>
        {service.online_apply && (
          <span className="shrink-0 inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            온라인 신청
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-zinc-600 leading-6 line-clamp-2">
        {service.summary}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">{service.department}</span>
        {service.interest_topics.slice(0, 2).map((t) => (
          <span
            key={t}
            className="rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 border border-indigo-100"
          >
            {t}
          </span>
        ))}
        {service.life_stages.length > 0 && (
          <span className="text-zinc-400">·</span>
        )}
        {service.life_stages.slice(0, 2).map((l) => (
          <span
            key={l}
            className="rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 border border-amber-100"
          >
            {l}
          </span>
        ))}
      </div>
    </Link>
  );
}
