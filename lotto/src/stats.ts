import { api, type Draw, type FrequencyRow } from "./api";

type Period = "recent1m" | "recent1y" | "recent5y" | "all" | "custom";

export async function initStats(root: HTMLElement) {
  root.innerHTML = `
    <div class="stats-header">
      <h2>📊 통계</h2>
      <div class="stats-controls">
        <label>기간
          <select id="stats-period">
            <option value="recent1m">최근 1개월</option>
            <option value="recent1y">최근 1년</option>
            <option value="recent5y">최근 5년</option>
            <option value="all" selected>전체</option>
            <option value="custom">직접 지정</option>
          </select>
        </label>
        <span id="stats-custom" class="hidden">
          <input type="number" id="stats-from" min="1" placeholder="시작 회차" />
          <span>~</span>
          <input type="number" id="stats-to" min="1" placeholder="끝 회차" />
          <button id="stats-apply">적용</button>
        </span>
      </div>
    </div>
    <div id="stats-summary" class="stats-summary">로딩…</div>
    <div id="stats-chart" class="stats-chart"></div>
    <div id="stats-lists" class="stats-lists"></div>
  `;

  const select = root.querySelector<HTMLSelectElement>("#stats-period")!;
  const custom = root.querySelector<HTMLSpanElement>("#stats-custom")!;
  const fromEl = root.querySelector<HTMLInputElement>("#stats-from")!;
  const toEl = root.querySelector<HTMLInputElement>("#stats-to")!;
  const applyBtn = root.querySelector<HTMLButtonElement>("#stats-apply")!;

  const latest = await api<Draw>("/api/latest").catch(() => null);
  const maxDrw = latest?.drw_no ?? 1200;

  function rangeFor(period: Period): [number, number] {
    if (period === "recent1m") return [Math.max(1, maxDrw - 4), maxDrw];
    if (period === "recent1y") return [Math.max(1, maxDrw - 52), maxDrw];
    if (period === "recent5y") return [Math.max(1, maxDrw - 260), maxDrw];
    if (period === "all") return [1, maxDrw];
    const f = Number(fromEl.value) || 1;
    const t = Number(toEl.value) || maxDrw;
    return [Math.min(f, t), Math.max(f, t)];
  }

  select.addEventListener("change", () => {
    custom.classList.toggle("hidden", select.value !== "custom");
    if (select.value !== "custom") refresh(rangeFor(select.value as Period));
  });
  applyBtn.addEventListener("click", () => refresh(rangeFor("custom")));

  refresh(rangeFor("all"));

  async function refresh([from, to]: [number, number]) {
    const summary = root.querySelector<HTMLDivElement>("#stats-summary")!;
    const chart = root.querySelector<HTMLDivElement>("#stats-chart")!;
    const lists = root.querySelector<HTMLDivElement>("#stats-lists")!;
    summary.textContent = `${from} ~ ${to}회 집계 중…`;
    try {
      const res = await api<{ rows: FrequencyRow[] }>(`/api/stats/frequency?from=${from}&to=${to}`);
      const rows = res.rows;
      if (rows.length === 0) {
        summary.textContent = "해당 기간 데이터가 없습니다.";
        chart.innerHTML = "";
        lists.innerHTML = "";
        return;
      }
      const totalDraws = to - from + 1;
      const maxCnt = Math.max(...rows.map((r) => r.cnt));
      summary.innerHTML = `<strong>${from}~${to}회 (${totalDraws}회)</strong> · 번호별 출현 빈도`;
      chart.innerHTML = renderFrequencyBar(rows, maxCnt);
      lists.innerHTML = renderTopBottom(rows);
    } catch (e) {
      summary.textContent = "통계 로드 실패";
    }
  }
}

function renderFrequencyBar(rows: FrequencyRow[], maxCnt: number): string {
  const map = new Map(rows.map((r) => [r.n, r.cnt]));
  const bars: string[] = [];
  for (let n = 1; n <= 45; n++) {
    const cnt = map.get(n) ?? 0;
    const pct = maxCnt ? (cnt / maxCnt) * 100 : 0;
    bars.push(`
      <div class="freq-row">
        <span class="freq-n">${n.toString().padStart(2, "0")}</span>
        <div class="freq-bar"><div class="freq-fill" style="width:${pct.toFixed(1)}%"></div></div>
        <span class="freq-cnt">${cnt}</span>
      </div>
    `);
  }
  return bars.join("");
}

function renderTopBottom(rows: FrequencyRow[]): string {
  const sorted = [...rows].sort((a, b) => b.cnt - a.cnt);
  const top = sorted.slice(0, 5);
  const bottom = [...sorted].reverse().slice(0, 5);
  const li = (r: FrequencyRow) => `<li><span class="num">${r.n.toString().padStart(2, "0")}</span> · ${r.cnt}회</li>`;
  return `
    <div class="stat-col">
      <h3>가장 많이 나온 번호</h3>
      <ul>${top.map(li).join("")}</ul>
    </div>
    <div class="stat-col">
      <h3>가장 적게 나온 번호</h3>
      <ul>${bottom.map(li).join("")}</ul>
    </div>
  `;
}
