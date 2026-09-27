type Element = "목" | "화" | "토" | "금" | "수";
type Sipsin = "비겁" | "식상" | "재성" | "관성" | "인성";

const STEM_ELEMENT: Record<string, Element> = {
  "甲": "목", "乙": "목",
  "丙": "화", "丁": "화",
  "戊": "토", "己": "토",
  "庚": "금", "辛": "금",
  "壬": "수", "癸": "수",
};

const BRANCH_ELEMENT: Record<string, Element> = {
  "寅": "목", "卯": "목",
  "巳": "화", "午": "화",
  "辰": "토", "戌": "토", "丑": "토", "未": "토",
  "申": "금", "酉": "금",
  "亥": "수", "子": "수",
};

const STEM_KO: Record<string, string> = {
  "甲": "갑", "乙": "을", "丙": "병", "丁": "정", "戊": "무",
  "己": "기", "庚": "경", "辛": "신", "壬": "임", "癸": "계",
};

const BRANCH_KO: Record<string, string> = {
  "子": "자", "丑": "축", "寅": "인", "卯": "묘", "辰": "진", "巳": "사",
  "午": "오", "未": "미", "申": "신", "酉": "유", "戌": "술", "亥": "해",
};

const GENERATES: Record<Element, Element> = {
  "목": "화", "화": "토", "토": "금", "금": "수", "수": "목",
};
const OVERCOMES: Record<Element, Element> = {
  "목": "토", "화": "금", "토": "수", "금": "목", "수": "화",
};

function sipsinOf(dayMaster: Element, target: Element): Sipsin {
  if (dayMaster === target) return "비겁";
  if (GENERATES[dayMaster] === target) return "식상";
  if (OVERCOMES[dayMaster] === target) return "재성";
  if (OVERCOMES[target] === dayMaster) return "관성";
  return "인성";
}

const FORTUNE: Record<Sipsin, { label: string; body: string; note: string }> = {
  "재성": {
    label: "재성일 (財星日)",
    body: "일간이 극(剋)하는 오행이 자리하는 날. 사주 이론상 재물을 다루는 힘이 부각되는 흐름입니다.",
    note: "다만 이는 흐름의 해석일 뿐, 1등 확률(1/8,145,060)은 변하지 않습니다.",
  },
  "식상": {
    label: "식상일 (食傷日)",
    body: "일간이 생(生)하는 오행이 자리하는 날. 활동·표현·시도의 기운이 부각되는 흐름입니다.",
    note: "재운 자체는 중간. 새로운 시도에 무난한 흐름입니다.",
  },
  "인성": {
    label: "인성일 (印星日)",
    body: "일간을 생(生)해 주는 오행이 자리하는 날. 도움·안정·수용의 기운이 강한 흐름입니다.",
    note: "적극적인 재물 취득보다는 지키는 흐름에 가깝습니다.",
  },
  "관성": {
    label: "관성일 (官星日)",
    body: "일간을 극(剋)하는 오행이 자리하는 날. 규율·부담·긴장의 흐름이 강조됩니다.",
    note: "재물 리스크에 신중한 편이 좋다고 해석됩니다.",
  },
  "비겁": {
    label: "비겁일 (比劫日)",
    body: "일간과 같은 오행이 자리하는 날. 경쟁·공유·분산의 기운이 부각되는 흐름입니다.",
    note: "재물이 흩어질 수 있어 무리한 지출은 삼가는 편이 좋다고 해석됩니다.",
  },
};

export interface SajuResult {
  dayMasterStem: string;
  dayMasterElement: Element;
  drawDate: string;
  drawGanZhi: string;
  drawBranchElement: Element;
  sipsin: Sipsin;
  fortuneLabel: string;
  fortuneBody: string;
  fortuneNote: string;
}

function nextDrawDate(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const daysUntilSat = (6 - dow + 7) % 7;
  d.setDate(d.getDate() + daysUntilSat);
  return d;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function computeSaju(birthYmd: string): Promise<SajuResult> {
  const mod = await import("lunar-javascript");
  const { Solar } = mod;
  const [y, m, d] = birthYmd.split("-").map(Number);
  if (!y || !m || !d) throw new Error("잘못된 날짜 형식");
  if (y < 1900 || y > 2100) throw new Error("연도 범위(1900~2100)를 벗어났습니다");

  const birth = Solar.fromYmd(y, m, d).getLunar();
  const dayGZ = birth.getDayInGanZhi();
  const dayStem = dayGZ[0];
  const dayElem = STEM_ELEMENT[dayStem];
  if (!dayElem) throw new Error("일간 계산 실패");

  const draw = nextDrawDate();
  const drawLunar = Solar.fromYmd(draw.getFullYear(), draw.getMonth() + 1, draw.getDate()).getLunar();
  const drawGZ = drawLunar.getDayInGanZhi();
  const drawBranch = drawGZ[1];
  const drawBranchElem = BRANCH_ELEMENT[drawBranch];
  if (!drawBranchElem) throw new Error("일지 계산 실패");

  const sipsin = sipsinOf(dayElem, drawBranchElem);
  const f = FORTUNE[sipsin];

  return {
    dayMasterStem: STEM_KO[dayStem] ?? dayStem,
    dayMasterElement: dayElem,
    drawDate: ymd(draw),
    drawGanZhi: (STEM_KO[drawGZ[0]] ?? drawGZ[0]) + (BRANCH_KO[drawBranch] ?? drawBranch),
    drawBranchElement: drawBranchElem,
    sipsin,
    fortuneLabel: f.label,
    fortuneBody: f.body,
    fortuneNote: f.note,
  };
}

export function initSaju(root: HTMLElement) {
  root.innerHTML = `
    <div class="saju-header">
      <h2>이번 회차 재운</h2>
      <p class="saju-tagline">생년월일(양력)로 이번 토요일 추첨일 일진과의 오행 관계를 확인합니다.</p>
    </div>
    <form id="saju-form" class="saju-form">
      <label>생년월일 (양력)
        <input type="date" id="saju-birth" min="1900-01-01" max="2100-12-31" required />
      </label>
      <button type="submit" class="btn-primary">재운 보기</button>
    </form>
    <div id="saju-result" class="saju-result hidden"></div>
    <p class="saju-disclaimer">사주는 통계·해석 이론이며, 로또 당첨 확률을 실제로 바꾸지 않습니다.</p>
  `;

  const form = root.querySelector<HTMLFormElement>("#saju-form")!;
  const input = root.querySelector<HTMLInputElement>("#saju-birth")!;
  const result = root.querySelector<HTMLDivElement>("#saju-result")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = input.value;
    if (!val) return;
    result.classList.remove("hidden");
    result.innerHTML = `<p class="muted">계산 중…</p>`;
    try {
      const r = await computeSaju(val);
      result.innerHTML = renderResult(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "계산 실패";
      result.innerHTML = `<p class="muted">${msg}</p>`;
    }
  });
}

function renderResult(r: SajuResult): string {
  return `
    <div class="saju-card">
      <div class="saju-meta">
        <div><span class="saju-key">일간</span><span class="saju-val">${r.dayMasterStem} (${r.dayMasterElement})</span></div>
        <div><span class="saju-key">추첨일</span><span class="saju-val">${r.drawDate}</span></div>
        <div><span class="saju-key">일진</span><span class="saju-val">${r.drawGanZhi} (일지 ${r.drawBranchElement})</span></div>
        <div><span class="saju-key">관계</span><span class="saju-val">${r.sipsin}</span></div>
      </div>
      <h3 class="saju-title">${r.fortuneLabel}</h3>
      <p class="saju-body">${r.fortuneBody}</p>
      <p class="saju-note">${r.fortuneNote}</p>
    </div>
  `;
}
