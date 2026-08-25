import fs from "node:fs";
import path from "node:path";
import { geoMercator, geoPath, type GeoProjection } from "d3-geo";

const GEOJSON_DIR = path.join(process.cwd(), "lib", "geojson");

type Feature = {
  type: "Feature";
  properties: {
    code: string | number;
    name: string;
    name_eng?: string;
  };
  geometry: unknown;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: Feature[];
};

let provincesCache: FeatureCollection | null = null;
let muniCache: FeatureCollection | null = null;

export function loadProvincesGeo(): FeatureCollection {
  if (!provincesCache) {
    const text = fs.readFileSync(
      path.join(GEOJSON_DIR, "provinces.geojson"),
      "utf-8"
    );
    provincesCache = JSON.parse(text) as FeatureCollection;
  }
  return provincesCache;
}

export function loadMunicipalitiesGeo(): FeatureCollection {
  if (!muniCache) {
    const text = fs.readFileSync(
      path.join(GEOJSON_DIR, "municipalities.geojson"),
      "utf-8"
    );
    muniCache = JSON.parse(text) as FeatureCollection;
  }
  return muniCache;
}

/**
 * GeoJSON features를 SVG viewBox에 맞게 projection.
 * width/height 안에 fit 되도록 자동 scale.
 */
export type SvgFeature = {
  code: string;
  name: string;
  name_eng: string;
  d: string;
  cx: number;
  cy: number;
};

export function projectFeatures(
  features: Feature[],
  width: number,
  height: number
): SvgFeature[] {
  // 임시 projection으로 bbox 계산 후 fit 조정
  const projection = geoMercator();
  const pathGen = geoPath(projection);

  // fitSize expects a GeoJSON object
  projection.fitSize(
    [width, height],
    { type: "FeatureCollection", features } as never
  );

  const out: SvgFeature[] = [];
  for (const feat of features) {
    const d = pathGen(feat as never);
    if (!d) continue;
    const [cx, cy] = pathGen.centroid(feat as never);
    out.push({
      code: String(feat.properties.code),
      name: feat.properties.name,
      name_eng: feat.properties.name_eng ?? "",
      d,
      cx: Number.isFinite(cx) ? cx : width / 2,
      cy: Number.isFinite(cy) ? cy : height / 2,
    });
  }
  return out;
}

/**
 * 특정 province code prefix (예: "11")로 필터링하여 시군구만.
 */
export function municipalitiesForProvince(
  provinceCode: string
): Feature[] {
  const all = loadMunicipalitiesGeo();
  return all.features.filter((f) =>
    String(f.properties.code).startsWith(provinceCode)
  );
}
