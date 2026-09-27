import { api, type Draw, type FrequencyRow } from "./api";
import { ballClass } from "./ball";

type Period = "recent1m" | "recent1y" | "recent5y" | "all" | "custom";
type SortMode = "num-asc" | "num-desc" | "cnt-desc" | "cnt-asc";

export async function initStats(root: HTMLElement) {
  root.innerHTML = `
    <div class="stats-header">
      <h2>번호 통계</h2>
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
      <div class="stats-sort">
        <span class="sort-lbl">정렬</span>
        <button data-sort="num-asc" class="sort-btn active">번호 ↑</button>
        <button data-sort="num-desc" class="sort-btn">번호 ↓</button>
        <button data-sort="cnt-desc" class="sort-btn">횟수 ↓</button>
        <button data-sort="cnt-asc" class="sort-btn">횟수 ↑</button>
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
  const sortBtns = root.querySelectorAll<HTMLButtonElement>(".sort-btn");
  const summary = root.querySelector<HTMLDivElement>("#stats-summary")!;
  const chart = root.querySelector<HTMLDivElement>("#stats-chart")!;
  const lists = root.querySelector<HTMLDivElement>("#stats-lists")!;

  const latest = await api<Draw>("/api/latest").catch(() => null);
  const maxDrw = latest?.drw_no ?? 1200;

  let currentRows: FrequencyRow[] = [];
  let currentRange: [number, number] = [1, maxDrw];
  let sortMode: SortMode = "num-asc";

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

  sortBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      sortMode = btn.dataset.sort as SortMode;
      sortBtns.forEach((b) => b.classList.toggle("active", b === btn));
      renderChart();
    });
  });

  refresh(rangeFor("all"));

  async function refresh(range: [number, number]) {
    currentRange = range;
    summary.textContent = `${range[0]} ~ ${range[1]}회 집계 중…`;
    try {
      const res = await api<{ rows: FrequencyRow[] }>(`/api/stats/frequency?from=${range[0]}&to=${range[1]}`);
      currentRows = res.rows;
      if (currentRows.length === 0) {
        summary.textContent = "해당 기간 데이터가 없습니다.";
        chart.innerHTML = "";
        lists.innerHTML = "";
        return;
      }
      const totalDraws = range[1] - range[0] + 1;
      summary.innerHTML = `<strong>${range[0]}~${range[1]}회 (${totalDraws}회)</strong> · 번호별 출현 빈도`;
      renderChart();
      lists.innerHTML = renderTopBottom(currentRows);
    } catch {
      summary.textContent = "통계 로드 실패";
    }
  }

  function renderChart() {
    if (currentRows.length === 0) return;
    const sorted = sortRows(currentRows, sortMode);
    const maxCnt = Math.max(...currentRows.map((r) => r.cnt));
    chart.innerHTML = renderFrequencyBar(sorted, maxCnt);
  }
}

function sortRows(rows: FrequencyRow[], mode: SortMode): FrequencyRow[] {
  const cp = [...rows];
  switch (mode) {
    case "num-asc": return cp.sort((a, b) => a.n - b.n);
    case "num-desc": return cp.sort((a, b) => b.n - a.n);
    case "cnt-desc": return cp.sort((a, b) => b.cnt - a.cnt || a.n - b.n);
    case "cnt-asc": return cp.sort((a, b) => a.cnt - b.cnt || a.n - b.n);
  }
}

function renderFrequencyBar(rows: FrequencyRow[], maxCnt: number): string {
  return rows.map((r) => {
    const pct = maxCnt ? (r.cnt / maxCnt) * 100 : 0;
    const group = ballClass(r.n).replace("num ", "");
    return `
      <div class="freq-row">
        <span class="freq-ball ${group}">${r.n}</span>
        <div class="freq-bar"><div class="freq-fill ${group}" style="width:${pct.toFixed(1)}%"></div></div>
        <span class="freq-cnt">${r.cnt}</span>
      </div>
    `;
  }).join("");
}

function renderTopBottom(rows: FrequencyRow[]): string {
  const sorted = [...rows].sort((a, b) => b.cnt - a.cnt);
  const top = sorted.slice(0, 5);
  const bottom = [...sorted].reverse().slice(0, 5);
  const li = (r: FrequencyRow) => `<li><span class="${ballClass(r.n)}">${r.n}</span><span>${r.cnt}회</span></li>`;
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
