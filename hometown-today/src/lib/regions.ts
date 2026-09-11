import regionsData from "./regions.json";

export type Municipality = {
  code: string;
  name: string;
  name_eng: string;
  slug: string;
  lat: number;
  lon: number;
  nx: number;
  ny: number;
};

export type Province = {
  code: string;
  name: string;
  name_eng: string;
  slug: string;
  lat: number;
  lon: number;
  nx: number;
  ny: number;
  municipalities: Municipality[];
};

type RegionsShape = { provinces: Province[] };

export const regions = regionsData as RegionsShape;

export type RegionMatch = {
  province: Province;
  municipality: Municipality;
  distanceKm: number;
};

/**
 * 위경도로부터 가장 가까운 시군구를 찾는다. 하버사인 근사(위도 1도 ≈ 111km).
 * 250개 전수 스캔 — 규모 작아 KD-tree 등 불필요.
 */
export function nearestMunicipality(lat: number, lon: number): RegionMatch {
  let best: RegionMatch | null = null;
  for (const province of regions.provinces) {
    for (const municipality of province.municipalities) {
      const dLat = (municipality.lat - lat) * 111;
      const dLon = (municipality.lon - lon) * 111 * Math.cos((lat * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      if (best === null || dist < best.distanceKm) {
        best = { province, municipality, distanceKm: dist };
      }
    }
  }
  return best!;
}

export function findMunicipality(
  provinceSlug: string,
  municipalitySlug: string,
): RegionMatch | undefined {
  const province = regions.provinces.find((p) => p.slug === provinceSlug);
  if (!province) return undefined;
  const municipality = province.municipalities.find((m) => m.slug === municipalitySlug);
  if (!municipality) return undefined;
  return { province, municipality, distanceKm: 0 };
}
