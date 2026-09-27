import { api, type Draw } from "./api";
import { ballClass } from "./ball";

const RANK_LABEL: Record<number, string> = { 1: "1등", 2: "2등", 3: "3등" };
// 4·5등은 상금이 작아 시뮬레이션에서 의미 없음. 3등 이내만 당첨으로 취급.
const MEANINGFUL_RANKS = [1, 2, 3] as const;
const MIN_TICKETS = 1;
const MAX_TICKETS = 100000;

function generateUniqueTickets(count: number, excludeKeys: Set<string> = new Set()): number[][] {
  const seen = new Set<string>(excludeKeys);
  const out: number[][] = [];
  let guard = 0;
  while (out.length < count && guard < count * 10) {
    guard++;
    const pool: number[] = [];
    while (pool.length < 6) {
      const n = 1 + Math.floor(Math.random() * 45);
      if (!pool.includes(n)) pool.push(n);
    }
    pool.sort((a, b) => a - b);
    const key = pool.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pool);
  }
  return out;
}

function ticketKey(ticket: number[]): string {
  return [...ticket].sort((a, b) => a - b).join(",");
}

// 3등 이내만 반환. 4·5등은 상금이 작아 시뮬레이션 관점에서 꽝(null)으로 처리.
function rankOf(ticket: number[], winSet: Set<number>, bonus: number): number | null {
  let matched = 0;
  for (const n of ticket) if (winSet.has(n)) matched++;
  if (matched === 6) return 1;
  if (matched === 5 && ticket.includes(bonus)) return 2;
  if (matched === 5) return 3;
  return null;
}

interface ParsedUserTicket {
  raw: string;
  numbers: number[] | null;
  error: string | null;
}

function parseUserTickets(text: string): ParsedUserTicket[] {
  const out: ParsedUserTicket[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const raw of lines) {
    const nums = raw.split(/[^0-9]+/).filter(Boolean).map(Number);
    if (nums.length !== 6) {
      out.push({ raw, numbers: null, error: `6개 숫자가 필요합니다 (${nums.length}개 인식)` });
      continue;
    }
    if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) {
      out.push({ raw, numbers: null, error: "1~45 범위의 정수여야 합니다" });
      continue;
    }
    if (new Set(nums).size !== 6) {
      out.push({ raw, numbers: null, error: "중복된 번호가 있습니다" });
      continue;
    }
    out.push({ raw, numbers: nums.sort((a, b) => a - b), error: null });
  }
  return out;
}

function getSessionId(): string {
  const key = "lotto_sid";
  let sid = localStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(key, sid);
  }
  return sid;
}

function fmtWon(v: number | null): string {
  if (v == null) return "-";
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (v >= 10_000) return `${(v / 10_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}만`;
  return v.toLocaleString();
}

export async function initSimulator(root: HTMLElement) {
  root.innerHTML = `
    <div class="sim-header">
      <h2>시뮬레이션</h2>
      <p class="sim-desc">랜덤 N장과 내 번호 조합을 회차 당첨번호에 대조해 <strong>3등 이내</strong> 당첨 여부를 확인합니다. (4·5등은 상금이 작아 제외)</p>
    </div>
    <div class="sim-form">
      <div class="sim-row">
        <label for="sim-drw">매칭 회차</label>
        <select id="sim-drw"></select>
        <span class="sim-hint" id="sim-drw-hint"></span>
      </div>
      <div class="sim-row">
        <label for="sim-count">뽑기 수 (N)</label>
        <input type="number" id="sim-count" min="${MIN_TICKETS}" max="${MAX_TICKETS}" value="1000" />
        <span class="sim-hint">${MIN_TICKETS.toLocaleString()} ~ ${MAX_TICKETS.toLocaleString()}장</span>
      </div>
      <div class="sim-row sim-user">
        <label for="sim-user">내 번호 (선택)</label>
        <textarea id="sim-user" rows="3" placeholder="한 줄에 6개 숫자 (예: 1 7 15 22 33 40)&#10;여러 조합은 줄바꿈으로 구분"></textarea>
        <span class="sim-hint">내 조합은 랜덤과 별도로 표시됩니다</span>
      </div>
    </div>
    <div id="sim-latest" class="sim-latest">최신 회차 로딩…</div>
    <button id="sim-run" class="sim-btn">뽑기</button>
    <div id="sim-user-result" class="sim-user-result"></div>
    <div id="sim-result" class="sim-result"></div>
    <div id="sim-meta" class="sim-meta"></div>
  `;

  const drwSel = root.querySelector<HTMLSelectElement>("#sim-drw")!;
  const drwHint = root.querySelector<HTMLSpanElement>("#sim-drw-hint")!;
  const countEl = root.querySelector<HTMLInputElement>("#sim-count")!;
  const userEl = root.querySelector<HTMLTextAreaElement>("#sim-user")!;
  const latestEl = root.querySelector<HTMLDivElement>("#sim-latest")!;
  const runBtn = root.querySelector<HTMLButtonElement>("#sim-run")!;
  const userResultEl = root.querySelector<HTMLDivElement>("#sim-user-result")!;
  const resultEl = root.querySelector<HTMLDivElement>("#sim-result")!;
  const metaEl = root.querySelector<HTMLDivElement>("#sim-meta")!;

  // 최신 회차 + 회차 옵션 채우기 (최근 24개)
  let latest: Draw | null = null;
  try {
    latest = await api<Draw>("/api/latest");
  } catch {}
  if (!latest) {
    latestEl.textContent = "회차 정보를 불러오지 못했습니다.";
    runBtn.disabled = true;
    return;
  }

  const maxDrw = latest.drw_no;
  const fromDrw = Math.max(1, maxDrw - 23);
  const dateByDrw = new Map<number, string>();
  try {
    const { rows } = await api<{ rows: { drw_no: number; drw_date: string }[] }>(
      `/api/draws?from=${fromDrw}&to=${maxDrw}`,
    );
    for (const r of rows) dateByDrw.set(r.drw_no, r.drw_date);
  } catch {}
  const options: string[] = [];
  for (let n = maxDrw; n >= fromDrw; n--) {
    const date = dateByDrw.get(n) ?? (n === maxDrw ? latest.drw_date : "");
    const dateTxt = date ? ` (${date})` : "";
    const latestTag = n === maxDrw ? " 최신" : "";
    options.push(`<option value="${n}">${n}회${dateTxt}${latestTag}</option>`);
  }
  options.push(`<option value="__custom">직접 지정…</option>`);
  drwSel.innerHTML = options.join("");

  async function loadDraw(drwNo: number): Promise<Draw | null> {
    try {
      const { draw } = await api<{ draw: Draw }>(`/api/draw/${drwNo}`);
      return draw;
    } catch {
      return null;
    }
  }

  let currentDraw: Draw = latest;

  function renderLatest(d: Draw) {
    latestEl.innerHTML = `
      <div class="latest-title">${d.drw_no}회 · ${d.drw_date}</div>
      <div class="latest-nums">${[d.n1, d.n2, d.n3, d.n4, d.n5, d.n6]
        .map((n) => `<span class="${ballClass(n)}">${n}</span>`)
        .join("")}<span class="${ballClass(d.bonus)} bonus">${d.bonus}</span></div>
      <div class="latest-prize">1등 ${d.first_cnt ?? "-"}명 · 1인당 ${fmtWon(d.first_amt)}원</div>
    `;
  }

  renderLatest(latest);

  drwSel.addEventListener("change", async () => {
    let target = drwSel.value;
    if (target === "__custom") {
      const input = prompt(`회차 번호를 입력하세요 (1 ~ ${maxDrw})`);
      if (!input) {
        drwSel.value = String(currentDraw.drw_no);
        return;
      }
      const n = Number(input);
      if (!Number.isInteger(n) || n < 1 || n > maxDrw) {
        alert(`1 ~ ${maxDrw} 범위의 정수를 입력하세요.`);
        drwSel.value = String(currentDraw.drw_no);
        return;
      }
      target = String(n);
    }
    const d = await loadDraw(Number(target));
    if (!d) {
      alert("해당 회차 데이터를 불러오지 못했습니다.");
      drwSel.value = String(currentDraw.drw_no);
      return;
    }
    currentDraw = d;
    renderLatest(d);
    drwHint.textContent = d.drw_date;
  });

  refreshMeta();

  runBtn.addEventListener("click", async () => {
    runBtn.disabled = true;
    runBtn.textContent = "뽑는 중…";
    userResultEl.innerHTML = "";
    resultEl.innerHTML = "";

    const n = Math.max(MIN_TICKETS, Math.min(MAX_TICKETS, Number(countEl.value) || 1000));
    countEl.value = String(n);

    const userTickets = parseUserTickets(userEl.value);
    const validUser = userTickets.filter((t) => t.numbers);

    const d = currentDraw;
    const winSet = new Set([d.n1, d.n2, d.n3, d.n4, d.n5, d.n6]);

    await new Promise((r) => setTimeout(r, 20));

    // 랜덤 뽑기 (사용자 조합과 중복 방지)
    const userKeys = new Set(validUser.map((t) => ticketKey(t.numbers!)));
    const randomTickets = generateUniqueTickets(n, userKeys);

    let best: { rank: number; index: number; ticket: number[] } | null = null;
    const perRankCount: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < randomTickets.length; i++) {
      const r = rankOf(randomTickets[i], winSet, d.bonus);
      if (r) {
        perRankCount[r]++;
        if (!best || r < best.rank) best = { rank: r, index: i + 1, ticket: randomTickets[i] };
      }
    }
    const firstHundredThreshold = Math.max(1, Math.floor(n / 10));
    const matchedFirstBatch = !!best && best.index <= firstHundredThreshold;

    // 사용자 조합 매칭
    const userResults = userTickets.map((t) => ({
      ...t,
      rank: t.numbers ? rankOf(t.numbers, winSet, d.bonus) : null,
    }));

    renderUserResult(userResultEl, d, userResults);
    renderResult(resultEl, d, best, matchedFirstBatch, perRankCount, n, firstHundredThreshold);

    api("/api/simulations", {
      method: "POST",
      body: JSON.stringify({
        sessionId: getSessionId(),
        drwNo: d.drw_no,
        totalTickets: n,
        bestRank: best?.rank ?? null,
        bestRankIndex: best?.index ?? null,
        matchedFirstHundred: matchedFirstBatch,
      }),
    }).catch(() => {}).finally(refreshMeta);

    runBtn.disabled = false;
    runBtn.textContent = "다시 뽑기";
  });

  async function refreshMeta() {
    try {
      const meta = await api<{ total: number; jackpots: number; distribution: { rank: number; c: number }[] }>(
        "/api/simulations/meta",
      );
      metaEl.innerHTML = `
        <div class="meta-line">
          지금까지 <strong>${meta.total.toLocaleString()}</strong>회 시뮬레이션 ·
          이 중 <strong>${meta.jackpots.toLocaleString()}</strong>명이 1등 조합을 뽑았습니다.
        </div>
      `;
    } catch {}
  }
}

function renderUserResult(
  el: HTMLElement,
  draw: Draw,
  results: Array<ParsedUserTicket & { rank: number | null }>,
) {
  if (results.length === 0) return;
  const winSet = new Set([draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6]);
  const rows = results
    .map((r, i) => {
      if (!r.numbers) {
        return `<tr class="err"><td>${i + 1}</td><td colspan="2"><code>${escape(r.raw)}</code> — ${r.error}</td></tr>`;
      }
      const nums = r.numbers
        .map((n) => {
          const hit = winSet.has(n);
          const isBonus = n === draw.bonus;
          return `<span class="${ballClass(n)} ${hit ? "hit" : ""} ${isBonus && r.rank === 2 ? "bonus" : ""}">${n}</span>`;
        })
        .join("");
      const rankTxt = r.rank ? `<strong class="rank-${r.rank}">${RANK_LABEL[r.rank]}</strong>` : "—";
      return `<tr><td>${i + 1}</td><td>${nums}</td><td class="user-rank">${rankTxt}</td></tr>`;
    })
    .join("");
  el.innerHTML = `
    <h3 class="sub-h">내 번호 결과 (${results.length}조합)</h3>
    <table class="user-tbl">
      <thead><tr><th>#</th><th>번호</th><th>등수</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderResult(
  el: HTMLElement,
  draw: Draw,
  best: { rank: number; index: number; ticket: number[] } | null,
  matchedFirstBatch: boolean,
  perRank: Record<number, number>,
  totalN: number,
  firstBatchSize: number,
) {
  let headline = "";
  if (best) {
    if (matchedFirstBatch) {
      headline = `<div class="result-hero good">축하합니다. 로또 사셨나요?<br><strong>${best.index}번째</strong> 조합이 <strong>${RANK_LABEL[best.rank]}</strong>에 당첨됐습니다.</div>`;
    } else {
      const extra = best.index - firstBatchSize;
      headline = `<div class="result-hero mid">아쉽네요. <strong>${extra.toLocaleString()}장</strong>만 더 있었다면 <strong>${RANK_LABEL[best.rank]}</strong>이었을 겁니다.</div>`;
    }
  } else {
    headline = `<div class="result-hero none">${totalN.toLocaleString()}장 모두 <strong>3등 이내</strong> 당첨이 없습니다.<br>사주 풀이라도 해볼까요? (준비 중)</div>`;
  }

  const winSet = new Set([draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6]);
  const bestHtml = best
    ? `<div class="best-ticket">
         <span class="lbl">${best.index.toLocaleString()}번째</span>
         ${best.ticket.map((n) => `<span class="${ballClass(n)} ${winSet.has(n) ? "hit" : ""}">${n}</span>`).join("")}
       </div>`
    : "";

  const rankRows = MEANINGFUL_RANKS
    .map((r) => `<tr><td>${RANK_LABEL[r]}</td><td>${perRank[r].toLocaleString()}장</td></tr>`)
    .join("");

  el.innerHTML = `
    ${headline}
    ${bestHtml}
    <table class="rank-tbl">
      <thead><tr><th>등수</th><th>랜덤 매칭</th></tr></thead>
      <tbody>${rankRows}</tbody>
    </table>
    <p class="result-note">랜덤 ${totalN.toLocaleString()}장 · 첫 ${firstBatchSize.toLocaleString()}장 안 3등 이내 = "축하", 나머지에 있으면 "아쉬움" · 4·5등은 계산에서 제외</p>
  `;
}

function escape(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
}
