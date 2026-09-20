import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api, type RegionRow, type TopStoreRow } from "./api";

let mapInstance: L.Map | null = null;

export async function initMap(root: HTMLElement) {
  root.innerHTML = `
    <div class="map-header">
      <h2>🗺️ 명당 지도</h2>
      <p class="map-desc">1·2등 배출 판매점 랭킹. 판매량 편차가 크기 때문에 통계적 편향이 있으니 재미로만 참고하세요.</p>
    </div>
    <div class="map-controls">
      <label>순위
        <select id="map-rank">
          <option value="">전체</option>
          <option value="1">1등만</option>
          <option value="2">2등만</option>
        </select>
      </label>
      <label>지역
        <select id="map-sido">
          <option value="">전국</option>
        </select>
      </label>
    </div>
    <div id="map-container" class="map-container"></div>
    <div class="map-lists">
      <div class="map-col">
        <h3>시·구 랭킹</h3>
        <ol id="map-region-list" class="rank-list">불러오는 중…</ol>
      </div>
      <div class="map-col">
        <h3>판매점 TOP 30</h3>
        <ol id="map-store-list" class="rank-list">불러오는 중…</ol>
      </div>
    </div>
  `;

  const mapContainer = root.querySelector<HTMLDivElement>("#map-container")!;
  const rankSel = root.querySelector<HTMLSelectElement>("#map-rank")!;
  const sidoSel = root.querySelector<HTMLSelectElement>("#map-sido")!;
  const regionListEl = root.querySelector<HTMLOListElement>("#map-region-list")!;
  const storeListEl = root.querySelector<HTMLOListElement>("#map-store-list")!;

  if (!mapInstance) {
    mapInstance = L.map(mapContainer).setView([36.5, 127.8], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap",
    }).addTo(mapInstance);
  } else {
    mapInstance.setView([36.5, 127.8], 7);
  }
  let markerLayer = L.layerGroup().addTo(mapInstance);

  // 시·구 랭킹은 지역 필터와 무관하게 전체 조회
  try {
    const regionRes = await api<{ rows: RegionRow[] }>("/api/stats/region");
    const rows = regionRes.rows;
    const topSido = new Set(rows.map((r) => r.sido));
    for (const s of [...topSido].sort()) {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      sidoSel.appendChild(opt);
    }
    regionListEl.innerHTML = rows
      .slice(0, 30)
      .map(
        (r, i) => `
          <li>
            <span class="rank-num">${i + 1}</span>
            <span class="rank-name">${r.sido} ${r.sigungu}</span>
            <span class="rank-cnt">1등 ${r.rank1_cnt} / 2등 ${r.rank2_cnt}</span>
          </li>`,
      )
      .join("");
  } catch {
    regionListEl.innerHTML = "<li>지역 데이터 없음</li>";
  }

  async function refresh() {
    markerLayer.clearLayers();
    storeListEl.innerHTML = "불러오는 중…";
    const rank = rankSel.value;
    const sido = sidoSel.value;
    const qs = new URLSearchParams();
    if (rank) qs.set("rank", rank);
    if (sido) qs.set("sido", sido);
    qs.set("limit", "300");
    try {
      const res = await api<{ rows: TopStoreRow[] }>(`/api/stats/top-stores?${qs}`);
      const rows = res.rows;
      const withCoord = rows.filter((r) => r.lat != null && r.lng != null);
      for (const r of withCoord) {
        const label = `${r.name}<br>${r.addr}<br>1등 ${r.rank1_cnt} / 2등 ${r.rank2_cnt}`;
        L.circleMarker([r.lat!, r.lng!], {
          radius: 4 + Math.min(10, Math.log2(1 + r.rank1_cnt * 2)),
          color: r.rank1_cnt > 0 ? "#ffd43b" : "#8892a6",
          fillOpacity: 0.7,
          weight: 1,
        })
          .bindPopup(label)
          .addTo(markerLayer);
      }
      if (withCoord.length) {
        const bounds = L.latLngBounds(withCoord.map((r) => [r.lat!, r.lng!] as [number, number]));
        mapInstance!.fitBounds(bounds, { padding: [20, 20], maxZoom: 12 });
      }
      storeListEl.innerHTML = rows
        .slice(0, 30)
        .map(
          (r, i) => `
            <li>
              <span class="rank-num">${i + 1}</span>
              <span class="rank-name">${r.name}<br><small>${r.addr}</small></span>
              <span class="rank-cnt">1등 ${r.rank1_cnt} / 2등 ${r.rank2_cnt}</span>
            </li>`,
        )
        .join("");
    } catch {
      storeListEl.innerHTML = "<li>판매점 데이터 없음</li>";
    }
  }

  rankSel.addEventListener("change", refresh);
  sidoSel.addEventListener("change", refresh);
  refresh();
}
