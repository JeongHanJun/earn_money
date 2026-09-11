import "./style.css";
import {
  Accuracy,
  Device,
  TossAds,
} from "@apps-in-toss/web-framework";
import { nearestMunicipality, type RegionMatch } from "./lib/regions";
import {
  formatKoreanDate,
  groupByDay,
  pickNowSlot,
  pivotByTime,
  umbrellaLabel,
} from "./lib/weather";
import { pickClosingSoon } from "./lib/youth";
import { pickTopTrends } from "./lib/trends";
import { fetchTrends, fetchWeather, fetchYouth } from "./lib/api";

const AD_GROUP_ID_BANNER =
  import.meta.env.VITE_AD_GROUP_ID_BANNER ?? "ait-ad-test-banner-id";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app 요소를 찾을 수 없어요.");

app.innerHTML = `
  <main class="briefing">
    <header class="briefing-header">
      <div class="briefing-date" id="date"></div>
      <div class="briefing-region" id="region">위치 확인 중…</div>
    </header>
    <section class="card weather-card" id="weather-card">
      <div class="card-title">
        <span class="card-emoji">☁️</span> 오늘 날씨
      </div>
      <div class="card-body" id="weather-body">
        <div class="skeleton skeleton-lg"></div>
      </div>
    </section>
    <section class="card youth-card" id="youth-card">
      <div class="card-title">
        <span class="card-emoji">📮</span> 이번 주 마감 정책
      </div>
      <div class="card-body" id="youth-body">
        <div class="skeleton"></div>
        <div class="skeleton"></div>
      </div>
    </section>
    <section class="card trends-card" id="trends-card">
      <div class="card-title">
        <span class="card-emoji">🔥</span> 지금 뜨는 검색어
      </div>
      <div class="card-body" id="trends-body">
        <div class="skeleton"></div>
        <div class="skeleton"></div>
      </div>
    </section>
    <div class="ad-slot" id="ad-slot"></div>
    <footer class="briefing-footer">
      출처: 기상청 · 온통청년 · Google Trends
    </footer>
  </main>
`;

renderDate();
init();

function renderDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][kst.getDay()];
  const label = `${kst.getMonth() + 1}월 ${kst.getDate()}일 (${dow})`;
  const el = document.getElementById("date");
  if (el) el.textContent = label;
}

async function init() {
  const region = await resolveRegion();
  renderRegion(region);
  await Promise.all([
    loadWeather(region.province.slug, region.municipality.slug),
    loadYouth(),
    loadTrends(),
  ]);
  mountAd();
}

async function resolveRegion(): Promise<RegionMatch> {
  // 브라우저(비-토스 웹뷰) 환경에서는 SDK 호출이 실패 → fallback.
  try {
    const loc = await Device.getLocation({ accuracy: Accuracy.Balanced });
    return nearestMunicipality(loc.coords.latitude, loc.coords.longitude);
  } catch {
    return fallbackRegion();
  }
}

function fallbackRegion(): RegionMatch {
  // Seoul 종로구 좌표
  return nearestMunicipality(37.5968, 126.9778);
}

function renderRegion(region: RegionMatch) {
  const el = document.getElementById("region");
  if (el) el.textContent = `${region.province.name} ${region.municipality.name}`;
}

async function loadWeather(sidoSlug: string, muniSlug: string) {
  const body = document.getElementById("weather-body");
  if (!body) return;
  try {
    const raw = await fetchWeather(sidoSlug, muniSlug);
    const points = pivotByTime(raw.data.items);
    const days = groupByDay(points);
    const today = days[0];
    if (!today) throw new Error("no data");
    const now = pickNowSlot(today.points);
    const tmp = now?.tmp ?? today.tmax ?? "-";
    const tmax = today.tmax ?? "-";
    const tmin = today.tmin ?? "-";
    const summary = today.summary ?? "예보";
    const umbrella = umbrellaLabel(today.umbrella);
    const popText = today.max_pop >= 30 ? `강수확률 ${today.max_pop}%` : "";
    body.innerHTML = `
      <div class="weather-hero">
        <div class="weather-temp">${tmp}<span class="deg">°</span></div>
        <div class="weather-summary">
          <div class="weather-cond">${summary}</div>
          <div class="weather-range">최고 ${tmax}° / 최저 ${tmin}°</div>
        </div>
      </div>
      ${umbrella ? `<div class="weather-umbrella umbrella-${today.umbrella}">☂ ${umbrella}${popText ? ` · ${popText}` : ""}</div>` : ""}
      <div class="weather-forecast">
        ${days.slice(0, 3).map((d) => `
          <div class="forecast-day">
            <div class="forecast-date">${formatKoreanDate(d.date)}</div>
            <div class="forecast-cond">${d.summary ?? "-"}</div>
            <div class="forecast-range">${d.tmax ?? "-"}° / ${d.tmin ?? "-"}°</div>
          </div>
        `).join("")}
      </div>
    `;
  } catch (e) {
    body.innerHTML = `<div class="error">날씨 데이터를 불러오지 못했어요.</div>`;
    console.error(e);
  }
}

async function loadYouth() {
  const body = document.getElementById("youth-body");
  if (!body) return;
  try {
    const { items } = await fetchYouth();
    const picks = pickClosingSoon(items, 3);
    if (picks.length === 0) {
      body.innerHTML = `<div class="empty">이번 주 마감 임박 정책이 없어요.</div>`;
      return;
    }
    body.innerHTML = picks
      .map(({ policy, status }) => `
        <div class="youth-item" data-url="${escapeAttr(policy.apply_url)}">
          <div class="youth-status status-${status.kind}">${status.label}</div>
          <div class="youth-name">${escapeHtml(policy.name)}</div>
          <div class="youth-dept">${escapeHtml(policy.department)}</div>
        </div>
      `).join("");
    body.querySelectorAll<HTMLElement>(".youth-item").forEach((el) => {
      el.addEventListener("click", () => {
        const url = el.dataset.url;
        if (url) openExternal(url);
      });
    });
  } catch (e) {
    body.innerHTML = `<div class="error">정책 데이터를 불러오지 못했어요.</div>`;
    console.error(e);
  }
}

async function loadTrends() {
  const body = document.getElementById("trends-body");
  if (!body) return;
  try {
    const file = await fetchTrends();
    const trends = pickTopTrends(file, 5);
    if (trends.length === 0) {
      body.innerHTML = `<div class="empty">트렌드 데이터가 없어요.</div>`;
      return;
    }
    body.innerHTML = trends
      .map((t) => `
        <div class="trend-item">
          <span class="trend-rank">${t.rank}</span>
          <span class="trend-keyword">${escapeHtml(t.keyword)}</span>
          ${t.traffic ? `<span class="trend-traffic">${escapeHtml(t.traffic)}</span>` : ""}
        </div>
      `).join("");
  } catch (e) {
    body.innerHTML = `<div class="error">트렌드 데이터를 불러오지 못했어요.</div>`;
    console.error(e);
  }
}

function openExternal(url: string) {
  // 토스 웹뷰: Device.openURL 사용, 실패 시 새 창으로 fallback (브라우저 dev용).
  Device.openURL(url).catch(() => window.open(url, "_blank"));
}

function mountAd() {
  const slot = document.getElementById("ad-slot");
  if (!slot) return;
  const supported = TossAds.initialize?.isSupported?.() ?? false;
  if (!supported) return;
  TossAds.initialize({
    callbacks: {
      onInitialized: () => {
        TossAds.attachBanner(AD_GROUP_ID_BANNER, slot, {
          theme: "auto",
          tone: "blackAndWhite",
          variant: "card",
          callbacks: {},
        });
      },
      onInitializationFailed: (e: unknown) => console.error("ad init failed", e),
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
