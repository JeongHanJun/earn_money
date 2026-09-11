/**
 * 청년정책 순수 로직. 이번 주 마감 임박 top N만 표시하는 MVP 버전.
 * 원본 web/lib/youth.ts에서 필요한 부분만 발췌.
 */

export type YouthPolicy = {
  plcy_no: string;
  name: string;
  keyword: string;
  description: string;
  support_content: string;
  apply_method: string;
  apply_url: string;
  ref_urls: string[];
  department: string;
  biz_start: string;
  biz_end: string;
  apply_period: string;
  min_age: number;
  max_age: number;
  age_limit: boolean;
  earn_min: number;
  earn_max: number;
  earn_note: string;
  add_qual: string;
  submission_docs: string;
  screening: string;
  etc: string;
  major_category: string;
  sub_category: string;
  inquiry_count: number;
  zip_codes: string[];
  first_reg: string;
};

export type YouthApplyStatusKind =
  | "active"
  | "closing_soon"
  | "upcoming"
  | "expired"
  | "always"
  | "unknown";

export type YouthApplyStatus = {
  kind: YouthApplyStatusKind;
  label: string;
  detail?: string;
  daysToStart?: number;
  daysToEnd?: number;
};

const APPLY_PERIOD_RE = /^(\d{8})\s*~\s*(\d{8})$/;

function parseYYYYMMDD(s: string): Date | null {
  if (!/^\d{8}$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6)) - 1;
  const d = Number(s.slice(6, 8));
  const dt = new Date(y, m, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function daysBetween(from: Date, to: Date): number {
  const MS = 24 * 60 * 60 * 1000;
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / MS);
}

export function formatYouthDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length < 8) return "";
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

export function youthApplyStatus(
  applyPeriod: string,
  now: Date = new Date(),
): YouthApplyStatus {
  const raw = (applyPeriod || "").trim();
  if (!raw) return { kind: "unknown", label: "" };
  const m = raw.match(APPLY_PERIOD_RE);
  if (!m) {
    if (/상시|수시|연중/.test(raw)) {
      return { kind: "always", label: "상시 접수", detail: raw };
    }
    return { kind: "unknown", label: raw };
  }
  const start = parseYYYYMMDD(m[1]);
  const end = parseYYYYMMDD(m[2]);
  if (!start || !end) return { kind: "unknown", label: raw };
  const detail = `${formatYouthDate(m[1])} ~ ${formatYouthDate(m[2])}`;
  const daysToStart = daysBetween(now, start);
  const daysToEnd = daysBetween(now, end);
  if (daysToEnd < 0) return { kind: "expired", label: "접수 종료", detail, daysToEnd };
  if (daysToStart > 0) {
    const label = daysToStart <= 7 ? `D-${daysToStart} 시작 예정` : `${daysToStart}일 뒤 시작`;
    return { kind: "upcoming", label, detail, daysToStart };
  }
  if (daysToEnd === 0) return { kind: "closing_soon", label: "오늘 마감", detail, daysToEnd };
  if (daysToEnd <= 7) return { kind: "closing_soon", label: `D-${daysToEnd} 마감 임박`, detail, daysToEnd };
  return { kind: "active", label: "신청 중", detail, daysToEnd };
}

export function youthPolicyStatus(
  policy: Pick<YouthPolicy, "apply_period" | "biz_start" | "biz_end">,
  now: Date = new Date(),
): YouthApplyStatus {
  const primary = youthApplyStatus(policy.apply_period, now);
  if (primary.kind !== "unknown") return primary;
  const start = (policy.biz_start || "").trim();
  const end = (policy.biz_end || "").trim();
  if (!/^\d{8}$/.test(start) || !/^\d{8}$/.test(end)) return primary;
  const fallback = youthApplyStatus(`${start} ~ ${end}`, now);
  if (fallback.kind === "unknown") return primary;
  return {
    ...fallback,
    detail: fallback.detail ? `사업 기간 ${fallback.detail}` : fallback.detail,
  };
}

/**
 * 이번 주 마감 임박 정책 top N. closing_soon 우선, 그 다음 active daysToEnd 오름차순.
 */
export function pickClosingSoon(
  policies: YouthPolicy[],
  limit = 3,
  now: Date = new Date(),
): Array<{ policy: YouthPolicy; status: YouthApplyStatus }> {
  return policies
    .map((p) => ({ policy: p, status: youthPolicyStatus(p, now) }))
    .filter(({ status }) => status.kind === "closing_soon" || status.kind === "active")
    .sort((a, b) => {
      const kindOrder = (k: YouthApplyStatusKind) => (k === "closing_soon" ? 0 : 1);
      const ko = kindOrder(a.status.kind) - kindOrder(b.status.kind);
      if (ko !== 0) return ko;
      return (a.status.daysToEnd ?? 999) - (b.status.daysToEnd ?? 999);
    })
    .slice(0, limit);
}
