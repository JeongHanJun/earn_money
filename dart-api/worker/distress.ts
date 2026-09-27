/**
 * Distress score 계산: Altman Z-Score (EM 판) + Piotroski F-Score.
 *
 * MVP 스코어. 학계 논문 기반이지만 KOSPI 특화 튜닝은 W6+ 이후 backtest 후 조정.
 */

export interface FinancialInputs {
  // BS
  current_assets: number | null;
  current_liabilities: number | null;
  total_assets: number | null;
  total_liabilities: number | null;
  retained_earnings: number | null;
  total_equity: number | null;
  // IS
  revenue: number | null;
  operating_income: number | null;
  net_income: number | null;
  // CF
  operating_cash_flow: number | null;
  // 시장가 (선택; 없으면 book value 사용)
  market_cap?: number | null;
  // 전기 대비 비교용
  prior_total_assets?: number | null;
  prior_net_income?: number | null;
  prior_revenue?: number | null;
  prior_current_ratio?: number | null;
  prior_debt_to_asset?: number | null;
  prior_operating_margin?: number | null;
  prior_shares_outstanding?: number | null;
  shares_outstanding?: number | null;
}

/**
 * Altman Z-Score for Emerging Markets (Altman 2005):
 *   Z" = 3.25 + 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4
 *   X1 = 운전자본/총자산 = (유동자산 - 유동부채) / 총자산
 *   X2 = 이익잉여금 / 총자산
 *   X3 = EBIT / 총자산       (여기선 영업이익 ≈ EBIT 근사)
 *   X4 = 장부가 자기자본 / 총부채
 *
 * 등급 (EM 판):
 *   Z > 2.60 → SAFE
 *   1.10 < Z <= 2.60 → GREY
 *   Z <= 1.10 → DISTRESS
 */
export interface AltmanResult {
  z_score: number | null;
  grade: "SAFE" | "GREY" | "DISTRESS" | "N/A";
  components: { x1: number | null; x2: number | null; x3: number | null; x4: number | null };
}

export function altmanZEm(f: FinancialInputs): AltmanResult {
  const {
    current_assets: ca, current_liabilities: cl, total_assets: ta,
    total_liabilities: tl, retained_earnings: re, total_equity: te,
    operating_income: oi,
  } = f;
  if (!ta || ta <= 0) return { z_score: null, grade: "N/A", components: { x1: null, x2: null, x3: null, x4: null } };

  const x1 = ca !== null && cl !== null ? (ca - cl) / ta : null;
  const x2 = re !== null ? re / ta : null;
  const x3 = oi !== null ? oi / ta : null;
  const x4 = te !== null && tl && tl > 0 ? te / tl : null;

  if (x1 === null || x2 === null || x3 === null || x4 === null) {
    return { z_score: null, grade: "N/A", components: { x1, x2, x3, x4 } };
  }

  const z = 3.25 + 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4;
  const grade: AltmanResult["grade"] = z > 2.60 ? "SAFE" : z > 1.10 ? "GREY" : "DISTRESS";
  return { z_score: z, grade, components: { x1, x2, x3, x4 } };
}

/**
 * Piotroski F-Score (0~9): 9개 회계 시그널의 이진 합.
 * 각 시그널 = 1 point when true.
 *
 * Profitability (4):
 *   1) ROA > 0                    (당기순이익 > 0)
 *   2) CFO > 0                    (영업활동현금흐름 > 0)
 *   3) ΔROA > 0                   (당기 ROA > 전기 ROA)
 *   4) CFO > NI                   (accrual quality)
 *
 * Leverage / Liquidity / Source of Funds (3):
 *   5) ΔLTD ≤ 0                   (장기부채 비율 감소; 여기선 debt/asset 감소로 근사)
 *   6) ΔCurrent Ratio > 0
 *   7) No new shares issued        (전기 대비 발행주식수 증가 없음)
 *
 * Operating Efficiency (2):
 *   8) ΔGross Margin > 0          (영업이익률 증가로 근사)
 *   9) ΔAsset Turnover > 0        (매출/자산 회전율 증가)
 */
export interface PiotroskiResult {
  score: number | null;
  grade: "STRONG" | "MID" | "WEAK" | "N/A";
  signals: Record<string, boolean | null>;
}

export function piotroskiF(f: FinancialInputs): PiotroskiResult {
  const signals: Record<string, boolean | null> = {};
  let score = 0;
  let usable = 0;

  const add = (name: string, v: boolean | null) => {
    signals[name] = v;
    if (v !== null) {
      usable++;
      if (v) score++;
    }
  };

  // 1) ROA > 0
  add("roa_positive", f.net_income !== null ? f.net_income > 0 : null);

  // 2) CFO > 0
  add("cfo_positive", f.operating_cash_flow !== null ? f.operating_cash_flow > 0 : null);

  // 3) ΔROA > 0
  const roaCur = f.net_income !== null && f.total_assets ? f.net_income / f.total_assets : null;
  const roaPri = f.prior_net_income !== null && f.prior_net_income !== undefined && f.prior_total_assets
    ? f.prior_net_income / f.prior_total_assets
    : null;
  add("roa_increased", roaCur !== null && roaPri !== null ? roaCur > roaPri : null);

  // 4) CFO > NI (accrual quality)
  add("cfo_gt_ni",
    f.operating_cash_flow !== null && f.net_income !== null
      ? f.operating_cash_flow > f.net_income
      : null
  );

  // 5) Δ(부채/자산) ≤ 0  = leverage 감소 or 유지
  const dtaCur = f.total_liabilities !== null && f.total_assets ? f.total_liabilities / f.total_assets : null;
  add("leverage_decreased",
    dtaCur !== null && f.prior_debt_to_asset !== undefined && f.prior_debt_to_asset !== null
      ? dtaCur <= f.prior_debt_to_asset
      : null
  );

  // 6) Δcurrent ratio > 0
  const crCur = f.current_assets !== null && f.current_liabilities && f.current_liabilities > 0
    ? f.current_assets / f.current_liabilities
    : null;
  add("current_ratio_improved",
    crCur !== null && f.prior_current_ratio !== undefined && f.prior_current_ratio !== null
      ? crCur > f.prior_current_ratio
      : null
  );

  // 7) No new shares
  add("no_dilution",
    f.shares_outstanding !== undefined && f.shares_outstanding !== null &&
    f.prior_shares_outstanding !== undefined && f.prior_shares_outstanding !== null
      ? f.shares_outstanding <= f.prior_shares_outstanding
      : null
  );

  // 8) Δoperating margin > 0
  const omCur = f.operating_income !== null && f.revenue && f.revenue > 0 ? f.operating_income / f.revenue : null;
  add("margin_improved",
    omCur !== null && f.prior_operating_margin !== undefined && f.prior_operating_margin !== null
      ? omCur > f.prior_operating_margin
      : null
  );

  // 9) Δasset turnover > 0
  const atCur = f.revenue !== null && f.total_assets ? f.revenue / f.total_assets : null;
  const atPri = f.prior_revenue !== null && f.prior_revenue !== undefined && f.prior_total_assets
    ? f.prior_revenue / f.prior_total_assets
    : null;
  add("turnover_improved", atCur !== null && atPri !== null ? atCur > atPri : null);

  if (usable < 5) return { score: null, grade: "N/A", signals };
  const grade: PiotroskiResult["grade"] = score >= 7 ? "STRONG" : score >= 4 ? "MID" : "WEAK";
  return { score, grade, signals };
}

/**
 * 종합 위험 스코어 (0~100). 요소:
 *   - Altman: SAFE=0, GREY=30, DISTRESS=70, N/A=15
 *   - Piotroski: STRONG=0, MID=10, WEAK=20, N/A=10
 *   - 90일 위험 이벤트: severity 합 (5당 +5, cap 30)
 * Grade: LOW <25, MEDIUM <50, HIGH <75, CRITICAL >=75
 */
export function compositeRisk(
  altman: AltmanResult,
  pio: PiotroskiResult,
  risk_events_severity_sum: number
): { score: number; grade: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" } {
  let s = 0;
  s += altman.grade === "SAFE" ? 0 : altman.grade === "GREY" ? 30 : altman.grade === "DISTRESS" ? 70 : 15;
  s += pio.grade === "STRONG" ? 0 : pio.grade === "MID" ? 10 : pio.grade === "WEAK" ? 20 : 10;
  s += Math.min(30, risk_events_severity_sum);
  const grade = s < 25 ? "LOW" : s < 50 ? "MEDIUM" : s < 75 ? "HIGH" : "CRITICAL";
  return { score: s, grade };
}
