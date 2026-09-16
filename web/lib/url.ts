/**
 * 공공API 외부 링크 필드 정규화.
 *
 * 원본 데이터에 스킴 없는 도메인(www.rhof.or.kr)이나 전화번호(1577-1000),
 * "각 지자체 사이트" 같은 문구가 URL 자리에 섞여 옴. 그대로 <a href> 에 넣으면
 * 브라우저가 상대경로로 해석해 /policy/youth/www.rhof.or.kr 같은 존재하지 않는
 * 내부 URL 이 생기고, Googlebot 이 이를 크롤링해 404 로 보고함.
 *
 * - http(s):// 로 시작 → 그대로
 * - //host → https:
 * - 도메인 형태 → https:// 부착 (한글 IDN 포함)
 * - 그 외 → null (링크로 렌더하지 않음)
 */
const DOMAIN_RE = /^[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[\p{L}]{2,}(?::\d+)?(?:[/?#]\S*)?$/u;

export function externalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = String(raw)
    .replace(/&amp;/g, "&")
    .trim()
    .split(/[\s,]+/)
    .find(Boolean);
  if (!first) return null;
  if (/^https?:\/\//i.test(first)) return first;
  if (first.startsWith("//")) return `https:${first}`;
  if (DOMAIN_RE.test(first)) return `https://${first}`;
  return null;
}
