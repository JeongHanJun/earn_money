/**
 * DART 한글 계정명 → 영어 필드 매핑.
 * 핵심 재무 항목만 (Balance Sheet · Income Statement).
 * account_id (IFRS taxonomy) 우선, account_nm은 fallback.
 */

export interface EnglishFinancialItem {
  fiscal_year: number;
  report_type: "annual" | "half" | "q1" | "q3";
  fs_type: "consolidated" | "separate";
  statement: "balance_sheet" | "income_statement" | "cash_flow" | "equity";
  account_id: string;
  account_name_ko: string;
  account_name_en: string;
  current_amount: number | null;
  prior_amount: number | null;
  prior_prior_amount: number | null;
  currency: string;
}

const REPORT_CODE: Record<string, EnglishFinancialItem["report_type"]> = {
  "11011": "annual",
  "11012": "half",
  "11013": "q1",
  "11014": "q3",
};

const FS_DIV: Record<string, EnglishFinancialItem["fs_type"]> = {
  CFS: "consolidated",
  OFS: "separate",
};

const SJ_DIV: Record<string, EnglishFinancialItem["statement"]> = {
  BS: "balance_sheet",
  IS: "income_statement",
  CIS: "income_statement",
  CF: "cash_flow",
  SCE: "equity",
};

/**
 * 자주 조회되는 계정 한글→영어. account_id가 있는 IFRS taxonomy 케이스는 그대로,
 * 없는 경우(관리·요약 항목) 한글명으로 매핑.
 */
const ACCOUNT_KO_EN: Record<string, string> = {
  // BS
  "유동자산": "current_assets",
  "비유동자산": "non_current_assets",
  "자산총계": "total_assets",
  "유동부채": "current_liabilities",
  "비유동부채": "non_current_liabilities",
  "부채총계": "total_liabilities",
  "자본금": "paid_in_capital",
  "이익잉여금": "retained_earnings",
  "자본총계": "total_equity",
  // IS
  "매출액": "revenue",
  "매출원가": "cost_of_sales",
  "매출총이익": "gross_profit",
  "판매비와관리비": "sga_expenses",
  "영업이익": "operating_income",
  "영업이익(손실)": "operating_income",
  "당기순이익": "net_income",
  "당기순이익(손실)": "net_income",
  // CF
  "영업활동현금흐름": "operating_cash_flow",
  "투자활동현금흐름": "investing_cash_flow",
  "재무활동현금흐름": "financing_cash_flow",
};

export function accountNameToEn(nameKo: string, accountId?: string): string {
  // IFRS ID가 있으면 lowercased 형태 그대로 노출 (표준화된 식별자)
  if (accountId && accountId.startsWith("ifrs-full_")) {
    return accountId.replace("ifrs-full_", "").replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
  }
  const clean = nameKo.replace(/\s+/g, "");
  return ACCOUNT_KO_EN[clean] ?? `custom__${clean}`;
}

function toNum(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * DART 한글 응답 하나 → 영어 표준 응답.
 */
export function toEnglish(item: {
  bsns_year: string;
  reprt_code: string;
  sj_div: string;
  account_id: string;
  account_nm: string;
  thstrm_amount: string;
  frmtrm_amount: string;
  bfefrmtrm_amount: string;
  currency: string;
}, fs_div: "CFS" | "OFS" = "CFS"): EnglishFinancialItem {
  return {
    fiscal_year: Number(item.bsns_year),
    report_type: REPORT_CODE[item.reprt_code] ?? "annual",
    fs_type: FS_DIV[fs_div],
    statement: SJ_DIV[item.sj_div] ?? "balance_sheet",
    account_id: item.account_id,
    account_name_ko: item.account_nm,
    account_name_en: accountNameToEn(item.account_nm, item.account_id),
    current_amount: toNum(item.thstrm_amount),
    prior_amount: toNum(item.frmtrm_amount),
    prior_prior_amount: toNum(item.bfefrmtrm_amount),
    currency: item.currency || "KRW",
  };
}

/**
 * 위험 공시 이벤트 감지: report_nm 패턴 → event_type + severity.
 * 완전하진 않지만 MVP로 충분한 최소 셋. 5주차에 확장.
 */
export interface RiskEventPattern {
  type: string;
  severity: number;
  patterns: RegExp[];
}

export const RISK_PATTERNS: RiskEventPattern[] = [
  {
    type: "DELISTING_RISK",
    severity: 5,
    patterns: [/상장폐지/, /관리종목/, /매매거래정지.*상장폐지/, /상장적격성.*실질심사/, /주권.*정리매매/],
  },
  {
    type: "GOING_CONCERN",
    severity: 5,
    patterns: [/계속기업.*불확실/, /계속기업존속능력/, /감사의견.*의견거절/, /감사의견.*부적정/, /감사의견.*한정/, /계속기업.*의문/],
  },
  {
    type: "AUDIT_OPINION",
    severity: 4,
    patterns: [/감사보고서/, /감사의견/, /감사인.*변경/, /감사인.*지정/, /재감사/, /감사범위.*제한/],
  },
  {
    type: "MAJOR_SHAREHOLDER",
    severity: 3,
    patterns: [/최대주주.*변경/, /경영권.*양수도/, /주식양수도계약/, /최대주주.*보유주식.*변동/, /지배구조.*변경/],
  },
  {
    type: "COLLATERAL",
    severity: 3,
    patterns: [/담보제공/, /채무보증/, /타법인.*채무보증/, /담보권.*설정/],
  },
  {
    type: "LAWSUIT",
    severity: 3,
    patterns: [/소송.*제기/, /소송.*판결/, /형사.*고소/, /민사.*소송/, /가처분.*신청/],
  },
  {
    type: "CAPITAL_REDUCTION",
    severity: 4,
    patterns: [/감자결정/, /무상감자/, /주식병합/, /자본감소/, /주식.*병합.*결정/],
  },
  {
    type: "CAPITAL_INCREASE",
    severity: 2,
    patterns: [/유상증자.*결정/, /주주배정.*유상증자/, /제3자배정.*유상증자/, /무상증자.*결정/],
  },
  {
    type: "CONVERTIBLE_BOND",
    severity: 2,
    patterns: [/전환사채.*발행/, /신주인수권부사채/, /교환사채.*발행/, /CB.*발행/, /BW.*발행/],
  },
  {
    type: "UNFAIR_TRADE",
    severity: 5,
    patterns: [/불공정거래/, /시세조종/, /미공개정보/, /주가조작/, /내부자거래/],
  },
  {
    type: "INVESTMENT_WARNING",
    severity: 4,
    patterns: [/투자주의/, /투자경고/, /투자위험/, /소수지점.*거래집중/, /단기과열/],
  },
  {
    type: "IMPAIRMENT",
    severity: 3,
    patterns: [/손상차손/, /자산.*손상/, /영업권.*손상/, /무형자산.*손상/],
  },
  {
    type: "DIVIDEND_CUT",
    severity: 2,
    patterns: [/배당금.*감소/, /무배당/, /배당.*중단/, /현금배당.*미결정/],
  },
  {
    type: "EARNINGS_SHOCK",
    severity: 3,
    patterns: [/영업손실.*확대/, /적자.*지속/, /적자.*전환/, /매출.*급감/, /영업이익.*급감/],
  },
  {
    type: "GOVERNANCE",
    severity: 3,
    patterns: [/대표이사.*변경/, /대표이사.*사임/, /임원.*횡령/, /배임/, /사외이사.*전원.*사임/],
  },
];

/**
 * report_nm에서 이벤트 감지. 여러 패턴 매칭되면 최고 severity 순 반환.
 */
export function detectRiskEvents(report_nm: string): Array<{ type: string; severity: number }> {
  const hits: Array<{ type: string; severity: number }> = [];
  for (const p of RISK_PATTERNS) {
    if (p.patterns.some((re) => re.test(report_nm))) {
      hits.push({ type: p.type, severity: p.severity });
    }
  }
  return hits.sort((a, b) => b.severity - a.severity);
}
