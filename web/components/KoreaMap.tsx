import Link from "next/link";
import {
  loadProvincesGeo,
  municipalitiesForProvince,
  projectFeatures,
} from "@/lib/map";
import { regions } from "@/lib/regions";

const WIDTH = 640;
const HEIGHT = 720;

// 광역시·특별시·특별자치시 코드 (실제 영역이 작아서 지도에서 확대 표시)
const METRO_CODES = new Set(["11", "21", "22", "23", "24", "25", "26", "29"]);

// 광역시별 폴리곤 확대 배율 (센터 기준).
const METRO_SCALE: Record<string, number> = {
  "11": 2.2, // 서울
  "21": 2.5, // 부산
  "22": 2.6, // 대구
  "23": 1.8, // 인천 (서해 섬 포함이라 크게 하면 충남까지 뻗음)
  "24": 3.0, // 광주
  "25": 2.8, // 대전
  "26": 2.6, // 울산
  "29": 3.0, // 세종
};

/**
 * 광역시 중심점 오프셋 (px). d3 centroid가 폴리곤 형태 때문에 부정확한 경우 수동 보정.
 * 인천은 백령도 등 서해 섬을 포함하므로 자연 centroid가 서해 방향에 있어서,
 * 도심 쪽(동북)으로 이동시켜 확대해도 충남을 침범하지 않도록.
 */
const METRO_CENTROID_OFFSET: Record<string, { dx: number; dy: number }> = {
  "23": { dx: 20, dy: -25 }, // 인천 → 도심(동북) 방향
};

/**
 * 도(道) 라벨 위치 오프셋 (px, 640x720 viewBox 기준).
 * 광역시 확대 폴리곤이 도 중심을 덮는 경우, 라벨을 광역시 반대 방향으로 이동.
 */
const PROVINCE_LABEL_OFFSET: Record<string, { dx: number; dy: number }> = {
  "31": { dx: 30, dy: 30 },    // 경기 (왼쪽 위로)
  "33": { dx: 15, dy: -20 },   // 충북
  "34": { dx: -10, dy: 30 },   // 충남 (더 오른쪽)
  "35": { dx: -20, dy: 10 },   // 전북
  "36": { dx: 20, dy: 40 },    // 전남
  "37": { dx: -20, dy: -10 },  // 경북
  "38": { dx: -20, dy: 30 },   // 경남
};

const SHORT_NAME_MAP: Record<string, string> = {
  "11": "서울",
  "21": "부산",
  "22": "대구",
  "23": "인천",
  "24": "광주",
  "25": "대전",
  "26": "울산",
  "29": "세종",
  "31": "경기",
  "32": "강원",
  "33": "충북",
  "34": "충남",
  "35": "전북",
  "36": "전남",
  "37": "경북",
  "38": "경남",
  "39": "제주",
};

// 색상
const PROVINCE_FILL = "#eef2ff";
const PROVINCE_STROKE = "#c7d2fe";
const PROVINCE_TEXT_FILL = "#3730a3";
const PROVINCE_TEXT_HALO = "#ffffff"; // 흰 halo (배경이 광역시 파랑일 때 판독)
const METRO_FILL = "#4f46e5";
const METRO_STROKE = "#312e81";
const METRO_TEXT_FILL = "#ffffff";
const METRO_TEXT_HALO = "#1e1b4b"; // 다크 네이비 halo

function shortByCode(code: string, fallback: string): string {
  return SHORT_NAME_MAP[code] ?? fallback;
}

/**
 * 전국 시도 지도.
 *
 * 렌더 순서 (중요):
 *  1) 도(道) 폴리곤 + 도 라벨
 *  2) 광역시 폴리곤 (확대, 도 위에 얹힘)
 *  3) 광역시 라벨 (모든 폴리곤 위에, halo 포함)
 *
 * 이렇게 3-pass 로 해야 광역시끼리 겹칠 때 (예: 대전-세종, 서울-인천)
 * 나중 그려진 폴리곤이 이전 라벨을 덮지 않음.
 */
export function KoreaMap() {
  const geo = loadProvincesGeo();
  const features = projectFeatures(geo.features, WIDTH, HEIGHT);
  const codeToSlug = new Map(regions.provinces.map((p) => [p.code, p.slug]));
  const codeToName = new Map(regions.provinces.map((p) => [p.code, p.name]));

  const provinces = features.filter((f) => !METRO_CODES.has(f.code));
  const metros = features.filter((f) => METRO_CODES.has(f.code));

  return (
    <div>
      <div className="text-xs font-medium text-zinc-500 mb-2 text-center">
        지도에서 광역시·도 클릭
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="전국 광역시·도 지도"
        className="w-full h-auto"
      >
        {/* Pass 1: 도(道) 폴리곤 (라벨 별도 Pass) */}
        <g>
          {provinces.map((f) => {
            const slug = codeToSlug.get(f.code) ?? "";
            return (
              <Link key={`prov-path-${f.code}`} href={`/weather/${slug}`}>
                <g className="map-region-province">
                  <title>{codeToName.get(f.code) ?? f.name}</title>
                  <path
                    d={f.d}
                    fill={PROVINCE_FILL}
                    stroke={PROVINCE_STROKE}
                    strokeWidth={0.8}
                    className="transition-colors"
                  />
                </g>
              </Link>
            );
          })}
        </g>

        {/* Pass 2: 광역시 확대 폴리곤 (centroid override 적용) */}
        <g>
          {metros.map((f) => {
            const slug = codeToSlug.get(f.code) ?? "";
            const scale = METRO_SCALE[f.code] ?? 2.5;
            const cOff = METRO_CENTROID_OFFSET[f.code] ?? { dx: 0, dy: 0 };
            // 폴리곤 자연 centroid (cx, cy)에서 scale 후, 결과를 (cx+dx, cy+dy)로 이동
            const scaleTransform = `translate(${f.cx + cOff.dx} ${f.cy + cOff.dy}) scale(${scale}) translate(${-f.cx} ${-f.cy})`;
            return (
              <Link key={`metro-path-${f.code}`} href={`/weather/${slug}`}>
                <g className="map-region-metro">
                  <title>{codeToName.get(f.code) ?? f.name}</title>
                  <g transform={scaleTransform}>
                    <path
                      d={f.d}
                      fill={METRO_FILL}
                      stroke={METRO_STROKE}
                      strokeWidth={0.6 / scale}
                      className="transition-colors"
                    />
                  </g>
                </g>
              </Link>
            );
          })}
        </g>

        {/* Pass 3: 광역시 라벨 (centroid override 적용) */}
        <g>
          {metros.map((f) => {
            const slug = codeToSlug.get(f.code) ?? "";
            const label = shortByCode(f.code, f.name);
            const cOff = METRO_CENTROID_OFFSET[f.code] ?? { dx: 0, dy: 0 };
            return (
              <Link key={`metro-label-${f.code}`} href={`/weather/${slug}`}>
                <text
                  x={f.cx + cOff.dx}
                  y={f.cy + cOff.dy + 6}
                  textAnchor="middle"
                  fontSize={18}
                  fontWeight={800}
                  fill={METRO_TEXT_FILL}
                  stroke={METRO_TEXT_HALO}
                  strokeWidth={4}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  className="cursor-pointer"
                >
                  {label}
                </text>
              </Link>
            );
          })}
        </g>

        {/* Pass 4: 도 라벨 (오프셋 + white halo). 광역시 위에 그려서 판독 보장. */}
        <g>
          {provinces.map((f) => {
            const slug = codeToSlug.get(f.code) ?? "";
            const label = shortByCode(f.code, f.name);
            const offset = PROVINCE_LABEL_OFFSET[f.code] ?? { dx: 0, dy: 4 };
            return (
              <Link key={`prov-label-${f.code}`} href={`/weather/${slug}`}>
                <text
                  x={f.cx + offset.dx}
                  y={f.cy + offset.dy}
                  textAnchor="middle"
                  fontSize={15}
                  fontWeight={700}
                  fill={PROVINCE_TEXT_FILL}
                  stroke={PROVINCE_TEXT_HALO}
                  strokeWidth={4}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  className="cursor-pointer"
                >
                  {label}
                </text>
              </Link>
            );
          })}
        </g>
      </svg>
      <style>{`
        .map-region-province:hover path { fill: #c7d2fe; }
        .map-region-metro:hover path { fill: #4338ca; }
      `}</style>

      <ProvinceQuickStrip />
    </div>
  );
}

/**
 * 도(道) 바로가기 - 지도에서 광역시가 도를 덮어 클릭이 어려울 때 안전망.
 * 광역시는 지도만으로도 충분히 클릭 가능하므로 여기엔 도만 노출.
 */
function ProvinceQuickStrip() {
  const provinceCodes = ["31", "32", "33", "34", "35", "36", "37", "38", "39"];
  const items = provinceCodes
    .map((code) => regions.provinces.find((p) => p.code === code))
    .filter((p): p is (typeof regions.provinces)[number] => Boolean(p));

  return (
    <div className="mt-4 pt-4 border-t border-zinc-100">
      <div className="text-xs font-medium text-zinc-500 mb-2 text-center">
        도(道) 바로가기
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
        {items.map((p) => (
          <Link
            key={p.code}
            href={`/weather/${p.slug}`}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 text-center hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-900 transition-colors"
          >
            {SHORT_NAME_MAP[p.code]}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * 특정 시도의 시군구 지도.
 */
export function ProvinceMap({ provinceSlug }: { provinceSlug: string }) {
  const province = regions.provinces.find((p) => p.slug === provinceSlug);
  if (!province) return null;

  const features = municipalitiesForProvince(province.code);
  if (features.length === 0) return null;

  const projected = projectFeatures(features, WIDTH, HEIGHT);
  const codeToSlug = new Map(
    province.municipalities.map((m) => [m.code, m.slug])
  );

  return (
    <div>
      <div className="text-xs font-medium text-zinc-500 mb-2 text-center">
        지도에서 시·군·구 클릭
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`${province.name} 시·군·구 지도`}
        className="w-full h-auto"
      >
        <g>
          {projected.map((f) => {
            const slug = codeToSlug.get(f.code);
            const shortLabel = stripSuffix(f.name);
            const content = (
              <g className="map-region-muni">
                <title>{f.name}</title>
                <path
                  d={f.d}
                  fill="#fef3c7"
                  stroke="#d97706"
                  strokeWidth="0.5"
                  className="transition-colors"
                />
                <text
                  x={f.cx}
                  y={f.cy + 3}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="500"
                  fill="#92400e"
                  pointerEvents="none"
                >
                  {shortLabel}
                </text>
              </g>
            );
            return slug ? (
              <Link key={f.code} href={`/weather/${provinceSlug}/${slug}`}>
                {content}
              </Link>
            ) : (
              <g key={f.code}>{content}</g>
            );
          })}
        </g>
      </svg>
      <style>{`
        .map-region-muni:hover path { fill: #fcd34d; }
      `}</style>
    </div>
  );
}

function stripSuffix(name: string): string {
  return name.replace(/(시|구|군)$/, "");
}
