import Link from "next/link";

/**
 * page: 1-based
 * href(page): "/foo" for page 1, "/foo/page/N" for N>=2 (컨벤션은 호출부가 정함)
 */
export function Pagination({
  page,
  totalPages,
  href,
}: {
  page: number;
  totalPages: number;
  href: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const windowSize = 2;
  const nums = new Set<number>([1, totalPages, page]);
  for (let i = 1; i <= windowSize; i++) {
    if (page - i >= 1) nums.add(page - i);
    if (page + i <= totalPages) nums.add(page + i);
  }
  const sorted = [...nums].sort((a, b) => a - b);

  const items: Array<{ type: "page"; n: number } | { type: "gap" }> = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) items.push({ type: "gap" });
    items.push({ type: "page", n });
    prev = n;
  }

  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  return (
    <nav
      aria-label="페이지 이동"
      className="mt-8 flex flex-wrap items-center justify-center gap-1.5 text-sm"
    >
      {prevPage ? (
        <Link
          href={href(prevPage)}
          rel="prev"
          className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-700 hover:border-amber-400 hover:bg-amber-50 transition-colors"
        >
          ← 이전
        </Link>
      ) : (
        <span className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-400">
          ← 이전
        </span>
      )}

      {items.map((it, i) =>
        it.type === "gap" ? (
          <span key={`gap-${i}`} className="px-1.5 text-zinc-400">
            …
          </span>
        ) : it.n === page ? (
          <span
            key={it.n}
            aria-current="page"
            className="inline-flex min-w-[36px] items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white"
          >
            {it.n}
          </span>
        ) : (
          <Link
            key={it.n}
            href={href(it.n)}
            className="inline-flex min-w-[36px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-zinc-700 hover:border-amber-400 hover:bg-amber-50 transition-colors"
          >
            {it.n}
          </Link>
        ),
      )}

      {nextPage ? (
        <Link
          href={href(nextPage)}
          rel="next"
          className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-700 hover:border-amber-400 hover:bg-amber-50 transition-colors"
        >
          다음 →
        </Link>
      ) : (
        <span className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-400">
          다음 →
        </span>
      )}
    </nav>
  );
}
