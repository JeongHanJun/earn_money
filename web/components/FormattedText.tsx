import { decodeEntities, inlineHighlight, parseBlocks } from "@/lib/text";

/**
 * 관공서 텍스트를 구조화된 블록으로 렌더.
 * - 헤더, 노트(※), 불릿, 번호 매김, 문단으로 분리
 * - 중요 키워드 인라인 강조 (필수/주의/금액/퍼센트)
 */
export function FormattedText({ raw }: { raw: string }) {
  const blocks = parseBlocks(raw);

  return (
    <div className="space-y-2 text-zinc-700 leading-7">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "header":
            return (
              <div
                key={i}
                className="mt-3 first:mt-0 text-sm font-bold text-zinc-900 border-l-2 border-indigo-500 pl-2"
              >
                {decodeEntities(b.text)}
              </div>
            );
          case "note":
            return (
              <div
                key={i}
                className="flex gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-sm"
              >
                <span className="shrink-0 text-amber-700 font-bold">※</span>
                <HighlightedSpan text={b.text} />
              </div>
            );
          case "bullet":
            return (
              <div
                key={i}
                className={`flex gap-2 ${b.indent === 1 ? "ml-5" : ""}`}
              >
                <span
                  className={`mt-2 shrink-0 h-1.5 w-1.5 rounded-full ${
                    b.indent === 0 ? "bg-indigo-500" : "bg-zinc-400"
                  }`}
                />
                <HighlightedSpan text={b.text} />
              </div>
            );
          case "numbered":
            return (
              <div key={i} className="flex gap-2">
                <span className="shrink-0 font-semibold text-indigo-700 min-w-[1.5rem]">
                  {b.num}.
                </span>
                <HighlightedSpan text={b.text} />
              </div>
            );
          case "paragraph":
          default:
            return (
              <p key={i}>
                <HighlightedSpan text={b.text} />
              </p>
            );
        }
      })}
    </div>
  );
}

function HighlightedSpan({ text }: { text: string }) {
  const parts = inlineHighlight(decodeEntities(text));
  const html = parts
    .map((p) => (typeof p === "string" ? p : p.html))
    .join("");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
