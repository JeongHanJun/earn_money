/**
 * Country flag via flagcdn.com (free, no auth, reliable CDN).
 * Windows에서 flag emoji가 국가코드로 표시되는 문제 회피.
 *
 * flagcdn URL 규격: https://flagcdn.com/w{width}/{code}.png
 * 지원 폭: 20, 40, 80, 160, 320, 640, 1280, 2560
 * SVG: https://flagcdn.com/{code}.svg
 */

// flagcdn 국가 코드 매핑 (ISO alpha-2)
// 우리 시스템: uk → 실제로는 gb (Great Britain)
const CODE_MAP: Record<string, string> = {
  kr: "kr",
  us: "us",
  jp: "jp",
  uk: "gb",
  tw: "tw",
  de: "de",
  vn: "vn",
};

export function Flag({
  code,
  size = 40,
  className = "",
  alt = "",
}: {
  code: string;
  /** flag rendered width in pixels. Choose from 20/40/80/160 for optimal PNG. */
  size?: 20 | 40 | 80 | 160;
  className?: string;
  alt?: string;
}) {
  const flagCode = CODE_MAP[code] ?? code;
  const height = Math.round(size * 0.75);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w${size}/${flagCode}.png`}
      srcSet={`https://flagcdn.com/w${size * 2}/${flagCode}.png 2x`}
      width={size}
      height={height}
      alt={alt}
      loading="lazy"
      className={`inline-block rounded-sm shadow-sm ${className}`}
    />
  );
}
