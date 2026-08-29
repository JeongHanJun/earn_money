import Link from "next/link";
import { Flag } from "@/components/Flag";
import { COUNTRIES } from "@/lib/trends";

export function CountryTabs({ active }: { active: string }) {
  return (
    <nav
      aria-label="국가 선택"
      className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
    >
      {COUNTRIES.map((c) => {
        const isActive = c.code === active;
        return (
          <Link
            key={c.code}
            href={`/trends/${c.code}`}
            className={
              "shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
              (isActive
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900")
            }
          >
            <Flag code={c.code} size={20} alt={`${c.name} 국기`} />
            <span>{c.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
