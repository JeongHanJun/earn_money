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

export function getProvinceBySlug(slug: string): Province | undefined {
  return regions.provinces.find((p) => p.slug === slug);
}

export function getMunicipality(
  provinceSlug: string,
  municipalitySlug: string
): { province: Province; municipality: Municipality } | undefined {
  const province = getProvinceBySlug(provinceSlug);
  if (!province) return undefined;
  const municipality = province.municipalities.find(
    (m) => m.slug === municipalitySlug
  );
  if (!municipality) return undefined;
  return { province, municipality };
}

export function allMunicipalityPaths(): Array<{
  sido: string;
  sigungu: string;
}> {
  return regions.provinces.flatMap((p) =>
    p.municipalities.map((m) => ({ sido: p.slug, sigungu: m.slug }))
  );
}
