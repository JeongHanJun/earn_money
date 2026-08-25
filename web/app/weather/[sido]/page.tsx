import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProvinceMap } from "@/components/KoreaMap";
import { RegionSelect } from "@/components/RegionSelect";
import { getProvinceBySlug, regions } from "@/lib/regions";

export function generateStaticParams() {
  return regions.provinces.map((p) => ({ sido: p.slug }));
}

export async function generateMetadata(
  props: PageProps<"/weather/[sido]">
): Promise<Metadata> {
  const { sido } = await props.params;
  const province = getProvinceBySlug(sido);
  if (!province) return { title: "지역을 찾을 수 없음" };
  return {
    title: `${province.name} 날씨`,
    description: `${province.name} 시군구 단기예보. 지역을 선택하세요.`,
  };
}

export default async function ProvincePage(
  props: PageProps<"/weather/[sido]">
) {
  const { sido } = await props.params;
  const province = getProvinceBySlug(sido);
  if (!province) notFound();

  return (
    <div className="space-y-8">
      <nav className="text-sm text-zinc-500">
        <Link href="/weather" className="hover:text-zinc-900">
          날씨
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900">{province.name}</span>
      </nav>

      <header>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {province.name} 날씨
        </h1>
        <p className="mt-2 text-zinc-600">
          시군구를 선택하세요 (
          {province.municipalities.length}개)
        </p>
      </header>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-medium text-zinc-500 mb-2">지역 선택</div>
        <RegionSelect initialProvince={province.slug} />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
        <ProvinceMap provinceSlug={province.slug} />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight mb-3">
          전체 목록
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {province.municipalities.map((m) => (
            <Link
              key={m.code}
              href={`/weather/${province.slug}/${m.slug}`}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              {m.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
