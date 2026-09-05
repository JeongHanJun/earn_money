import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// SVG 아이콘을 PNG로 렌더링해서 public/에 저장.
// - icon-{size}.png            : any purpose (홈스크린 표준 아이콘)
// - icon-maskable-{size}.png   : maskable purpose (안전영역 여유, safe zone 강제)
// - apple-touch-icon.png       : iOS 홈스크린 (180)
// Google Play TWA/Bubblewrap은 512 PNG를, 브라우저 install 프롬프트는 192 PNG를 요구.

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const SOURCES = [
  { input: "icon.svg", basename: "icon", sizes: [192, 512] },
  { input: "icon-maskable.svg", basename: "icon-maskable", sizes: [192, 512] },
];

async function renderPng(svgPath, outPath, size) {
  const buf = await fs.readFile(svgPath);
  await sharp(buf, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function main() {
  const generated = [];
  for (const { input, basename, sizes } of SOURCES) {
    const svgPath = path.join(PUBLIC_DIR, input);
    for (const size of sizes) {
      const outPath = path.join(PUBLIC_DIR, `${basename}-${size}.png`);
      await renderPng(svgPath, outPath, size);
      generated.push(path.relative(process.cwd(), outPath));
    }
  }
  // iOS apple-touch-icon (180px, 표준 non-maskable 아이콘 사용)
  const appleOut = path.join(PUBLIC_DIR, "apple-touch-icon.png");
  await renderPng(path.join(PUBLIC_DIR, "icon.svg"), appleOut, 180);
  generated.push(path.relative(process.cwd(), appleOut));

  console.log(`Generated ${generated.length} PNG icon(s):`);
  for (const p of generated) console.log(`  ${p}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
