import { api, type Draw } from "./api";

const RANK_LABEL: Record<number, string> = { 1: "1등", 2: "2등", 3: "3등", 4: "4등", 5: "5등" };

function generateUniqueTickets(count: number): number[][] {
  const seen = new Set<string>();
  const out: number[][] = [];
  while (out.length < count) {
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

function rankOf(ticket: number[], winSet: Set<number>, bonus: number): number | null {
  let matched = 0;
  for (const n of ticket) if (winSet.has(n)) matched++;
  if (matched === 6) return 1;
  if (matched === 5 && ticket.includes(bonus)) return 2;
  if (matched === 5) return 3;
  if (matched === 4) return 4;
  if (matched === 3) return 5;
  return null;
}

interface Result {
  drwNo: number;
  drwDate: string;
  totalTickets: number;
  best: { rank: number; index: number; ticket: number[] } | null;
  matchedFirstHundred: boolean;
  perRankCount: Record<number, number>;
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

function fmtNum(n: number[]): string {
  return n.map((v) => v.toString().padStart(2, "0")).join(" ");
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
      <h2>🎰 시뮬레이터</h2>
      <p class="sim-desc">랜덤 1,000장(100 + 900)을 뽑아 최신 회차와 매칭합니다.</p>
    </div>
    <div class="sim-latest" id="sim-latest">최신 회차 로딩…</div>
    <button id="sim-run" class="sim-btn">1,000장 뽑기</button>
    <div id="sim-result" class="sim-result"></div>
    <div id="sim-meta" class="sim-meta"></div>
  `;

  const latestEl = root.querySelector<HTMLDivElement>("#sim-latest")!;
  const runBtn = root.querySelector<HTMLButtonElement>("#sim-run")!;
  const resultEl = root.querySelector<HTMLDivElement>("#sim-result")!;
  const metaEl = root.querySelector<HTMLDivElement>("#sim-meta")!;

  let latest: Draw | null = null;
  try {
    latest = await api<Draw>("/api/latest");
    latestEl.innerHTML = `
      <div class="latest-title">최신 <strong>${latest.drw_no}</strong>회 (${latest.drw_date})</div>
      <div class="latest-nums">${[latest.n1, latest.n2, latest.n3, latest.n4, latest.n5, latest.n6]
        .map((n) => `<span class="num">${n}</span>`)
        .join("")}<span class="num bonus">+${latest.bonus}</span></div>
      <div class="latest-prize">1등 ${latest.first_cnt ?? "-"}명 · 1인당 ${fmtWon(latest.first_amt)}원</div>
    `;
  } catch {
    latestEl.textContent = "회차 정보를 불러오지 못했습니다.";
    runBtn.disabled = true;
  }

  refreshMeta();

  runBtn.addEventListener("click", async () => {
    if (!latest) return;
    runBtn.disabled = true;
    runBtn.textContent = "뽑는 중…";
    resultEl.innerHTML = "";
    await new Promise((r) => setTimeout(r, 30));

    const tickets = generateUniqueTickets(1000);
    const winSet = new Set([latest.n1, latest.n2, latest.n3, latest.n4, latest.n5, latest.n6]);
    let best: Result["best"] = null;
    const perRankCount: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (let i = 0; i < tickets.length; i++) {
      const r = rankOf(tickets[i], winSet, latest.bonus);
      if (r) {
        perRankCount[r]++;
        if (!best || r < best.rank) best = { rank: r, index: i + 1, ticket: tickets[i] };
      }
    }
    const matchedFirstHundred = !!best && best.index <= 100;

    renderResult(resultEl, latest, tickets, best, matchedFirstHundred, perRankCount);

    api("/api/simulations", {
      method: "POST",
      body: JSON.stringify({
        sessionId: getSessionId(),
        drwNo: latest.drw_no,
        totalTickets: 1000,
        bestRank: best?.rank ?? null,
        bestRankIndex: best?.index ?? null,
        matchedFirstHundred,
      }),
    }).catch(() => {}).finally(refreshMeta);

    runBtn.disabled = false;
    runBtn.textContent = "다시 1,000장 뽑기";
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

function renderResult(
  el: HTMLElement,
  latest: Draw,
  tickets: number[][],
  best: Result["best"],
  matchedFirstHundred: boolean,
  perRank: Record<number, number>,
) {
  let headline = "";
  if (best) {
    if (matchedFirstHundred) {
      headline = `<div class="result-hero good">🎉 축하해요! 로또 사셨나요?<br><strong>${best.index}번째</strong>가 <strong>${RANK_LABEL[best.rank]}</strong> 당첨이에요!</div>`;
    } else {
      const extraNeeded = best.index - 100;
      headline = `<div class="result-hero mid">😢 아쉬워요! <strong>${extraNeeded}장</strong>만 더 샀으면 <strong>${RANK_LABEL[best.rank]}</strong> 당첨이었어요.</div>`;
    }
  } else {
    headline = `<div class="result-hero none">😩 1,000장에 당첨이 하나도 없네요.<br>운이 없으신데… 사주 풀이라도 하실래요? (준비 중)</div>`;
  }

  const winSet = new Set([latest.n1, latest.n2, latest.n3, latest.n4, latest.n5, latest.n6]);
  const bestTicketHtml = best
    ? `<div class="best-ticket">
         <span class="lbl">${best.index}번째 조합</span>
         ${best.ticket
           .map((n) => `<span class="num ${winSet.has(n) ? "hit" : ""}">${n}</span>`)
           .join("")}
       </div>`
    : "";

  const rankRows = [1, 2, 3, 4, 5]
    .map((r) => `<tr><td>${RANK_LABEL[r]}</td><td>${perRank[r]}장</td></tr>`)
    .join("");

  el.innerHTML = `
    ${headline}
    ${bestTicketHtml}
    <table class="rank-tbl">
      <thead><tr><th>등수</th><th>매칭</th></tr></thead>
      <tbody>${rankRows}</tbody>
    </table>
  `;
}
