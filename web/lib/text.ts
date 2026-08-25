/**
 * 관공서 텍스트 처리 유틸.
 * - HTML entity 디코딩 (&rsquo; 등)
 * - 개행/불릿 정규화
 * - 섹션 헤더 파싱
 */

const HTML_ENTITIES: Record<string, string> = {
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&rdquo;": "”",
  "&ldquo;": "“",
  "&amp;": "&",
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#40;": "(",
  "&#41;": ")",
  "&hellip;": "…",
  "&middot;": "·",
  "&ndash;": "–",
  "&mdash;": "—",
  "&bull;": "•",
  "&deg;": "°",
  "&laquo;": "«",
  "&raquo;": "»",
};

export function decodeEntities(text: string): string {
  if (!text) return "";
  return text.replace(
    /&(?:rsquo|lsquo|rdquo|ldquo|amp|nbsp|lt|gt|quot|#39|#40|#41|hellip|middot|ndash|mdash|bull|deg|laquo|raquo);/g,
    (m) => HTML_ENTITIES[m] ?? m
  );
}

/**
 * 문단을 시각적 블록으로 파싱.
 * - 【제목】 or [제목] 로 시작하면 header
 * - ○, ※, ▶, ●, ▪, • 로 시작하면 top-level bullet
 * - -, ·, · 로 시작하면 sub bullet
 * - 숫자.  로 시작하면 numbered
 * - 그 외는 paragraph
 */
export type Block =
  | { kind: "header"; text: string }
  | { kind: "note"; text: string }        // ※
  | { kind: "bullet"; text: string; indent: 0 | 1 }
  | { kind: "numbered"; text: string; num: string }
  | { kind: "paragraph"; text: string };

const HEADER_RE = /^\s*(?:【([^】]+)】|\[([^\]]+)\])\s*(.*)$/;
const NOTE_RE = /^\s*※\s*(.+)$/;
const TOP_BULLET_RE = /^\s*[○●▶▪•◆◇☆★]\s*(.+)$/;
const SUB_BULLET_RE = /^\s*[-–·・][\s]+(.+)$/;
const NUMBERED_RE = /^\s*(\d+)[.)]\s+(.+)$/;

export function parseBlocks(raw: string): Block[] {
  const decoded = decodeEntities(raw);
  const lines = decoded.split(/\r?\n/).map((l) => l.trim());
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  for (const line of lines) {
    if (!line) {
      flushParagraph();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(HEADER_RE))) {
      flushParagraph();
      const header = m[1] || m[2] || "";
      const rest = (m[3] || "").trim();
      blocks.push({ kind: "header", text: header });
      if (rest) blocks.push({ kind: "paragraph", text: rest });
      continue;
    }
    if ((m = line.match(NOTE_RE))) {
      flushParagraph();
      blocks.push({ kind: "note", text: m[1].trim() });
      continue;
    }
    if ((m = line.match(TOP_BULLET_RE))) {
      flushParagraph();
      blocks.push({ kind: "bullet", indent: 0, text: m[1].trim() });
      continue;
    }
    if ((m = line.match(SUB_BULLET_RE))) {
      flushParagraph();
      blocks.push({ kind: "bullet", indent: 1, text: m[1].trim() });
      continue;
    }
    if ((m = line.match(NUMBERED_RE))) {
      flushParagraph();
      blocks.push({ kind: "numbered", num: m[1], text: m[2].trim() });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}

/**
 * 텍스트 내부 강조 단어. 데이터에는 개행이 부실하지만, 특정 마커가 있으면 중요 정보로 인식.
 * - 숫자+원, 숫자+% 강조
 * - "필수", "주의", "제외" 강조
 */
const EMPHASIS_PATTERNS: Array<{ re: RegExp; className: string }> = [
  { re: /(필수|반드시|주의|유의|제외)/g, className: "font-semibold text-red-700" },
  { re: /(\d{1,3}(?:,\d{3})+원|\d+만\s?원|\d+%)/g, className: "font-semibold text-indigo-700" },
];

export function inlineHighlight(text: string): (string | { html: string })[] {
  // 간단히: 클래스별 span으로 감싸서 HTML 문자열 파편 반환
  // React에서 dangerouslySetInnerHTML로 렌더링해야 함
  let html = escapeHtml(text);
  for (const { re, className } of EMPHASIS_PATTERNS) {
    html = html.replace(re, `<strong class="${className}">$1</strong>`);
  }
  return [{ html }];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
