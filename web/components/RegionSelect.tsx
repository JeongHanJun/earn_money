"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { regions, type Province } from "@/lib/regions";

/**
 * 광역시도 → 시군구 2단 드롭다운. 선택 시 즉시 이동.
 */
export function RegionSelect({
  initialProvince,
  initialMunicipality,
}: {
  initialProvince?: string;
  initialMunicipality?: string;
}) {
  const router = useRouter();
  const [provinceSlug, setProvinceSlug] = useState(initialProvince ?? "");
  const [muniSlug, setMuniSlug] = useState(initialMunicipality ?? "");

  const province: Province | undefined = regions.provinces.find(
    (p) => p.slug === provinceSlug
  );

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <select
        aria-label="광역시/도 선택"
        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        value={provinceSlug}
        onChange={(e) => {
          const slug = e.target.value;
          setProvinceSlug(slug);
          setMuniSlug("");
          if (slug) router.push(`/weather/${slug}`);
        }}
      >
        <option value="">광역시/도 선택</option>
        {regions.provinces.map((p) => (
          <option key={p.code} value={p.slug}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        aria-label="시/군/구 선택"
        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-400"
        disabled={!province}
        value={muniSlug}
        onChange={(e) => {
          const slug = e.target.value;
          setMuniSlug(slug);
          if (slug && provinceSlug) {
            router.push(`/weather/${provinceSlug}/${slug}`);
          }
        }}
      >
        <option value="">
          {province ? "시/군/구 선택" : "먼저 광역시/도 선택"}
        </option>
        {province?.municipalities.map((m) => (
          <option key={m.code} value={m.slug}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
