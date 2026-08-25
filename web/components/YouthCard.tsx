import Link from "next/link";
import type { YouthPolicy } from "@/lib/youth";

export function YouthCard({ policy }: { policy: YouthPolicy }) {
  const ageLabel =
    policy.age_limit && policy.min_age > 0 && policy.max_age > 0
      ? `만 ${policy.min_age}~${policy.max_age}세`
      : null;
  return (
    <Link
      href={`/policy/youth/${policy.plcy_no}`}
      className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-amber-400 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-zinc-900 leading-tight">
          {policy.name}
        </h3>
        {policy.apply_url && (
          <span className="shrink-0 inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            신청 가능
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-zinc-600 leading-6 line-clamp-2">
        {policy.description}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">{policy.department}</span>
        {policy.major_category && (
          <span className="rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 border border-amber-100">
            {policy.major_category}
          </span>
        )}
        {ageLabel && <span className="text-zinc-500">· {ageLabel}</span>}
        {policy.apply_period && (
          <span className="text-zinc-500 truncate max-w-[180px]">
            · 신청: {policy.apply_period}
          </span>
        )}
      </div>
    </Link>
  );
}
