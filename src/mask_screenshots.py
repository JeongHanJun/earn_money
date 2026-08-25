"""포트폴리오용 스크린샷 마스킹.

데이터 셀에 강한 blur 적용. 헤더/버튼/UI 골격은 유지해서
시스템 완성도는 어필하고, 실제 데이터(사용자ID, 주문번호, 상품명, 가격)는 식별 불가.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = Path("C:/Users/hanjun/earn_money")
OUT = BASE / "data" / "portfolio"
OUT.mkdir(parents=True, exist_ok=True)


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for name in ["malgun.ttf", "malgunbd.ttf", "arial.ttf", "arialbd.ttf"]:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def blur_regions(img: Image.Image, rects: list[tuple[int, int, int, int]], radius: int = 22) -> Image.Image:
    """rects: list of (x1, y1, x2, y2) — blur inside each rectangle."""
    result = img.copy()
    for x1, y1, x2, y2 in rects:
        region = result.crop((x1, y1, x2, y2))
        blurred = region.filter(ImageFilter.GaussianBlur(radius=radius))
        result.paste(blurred, (x1, y1))
    return result


def add_watermark(img: Image.Image) -> Image.Image:
    """하단 우측에 워터마크 배지."""
    w, h = img.size
    draw = ImageDraw.Draw(img, "RGBA")
    font_size = max(16, w // 90)
    font = load_font(font_size)
    text = "PORTFOLIO SAMPLE  ·  DATA MASKED"

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

    pad = font_size
    box_x1 = w - tw - pad * 3
    box_y1 = h - th - pad * 3
    box_x2 = w - pad
    box_y2 = h - pad

    draw.rectangle([box_x1, box_y1, box_x2, box_y2], fill=(26, 42, 74, 235))
    draw.text(
        (box_x1 + pad - bbox[0], box_y1 + pad - bbox[1]),
        text, font=font, fill=(255, 255, 255, 255),
    )
    return img


def mask_purchase_history(src: Path, dst: Path) -> None:
    """구매내역관리.png (2665x1939)

    보존: 상단 타이틀 (y=0~200), 필터/날짜 버튼 (y=360~480)
    마스킹: 탭+유저ID 배지 영역 (y=200~360), 요약+컬럼 헤더+모든 데이터 (y=480~end)
    """
    img = Image.open(src).convert("RGB")
    rects = [
        (0, 200, img.width, 360),
        (0, 480, img.width, img.height),
    ]
    result = blur_regions(img, rects, radius=30)
    result = add_watermark(result)
    result.save(dst, "PNG", optimize=True)


def mask_stock_lookup(src: Path, dst: Path) -> None:
    """재고조회기.png (1169x1316)

    보존: 상단 타이틀 "재고 조회기", 조회 버튼, 컬럼 헤더 (색상/사이즈/재고/가격)
    마스킹: 상품 URL 입력값, 상품 상세 카드, 재고/가격 데이터
    """
    img = Image.open(src).convert("RGB")
    rects = [
        (75, 205, 940, 275),
        (35, 480, 1135, 700),
        (35, 870, 1135, img.height - 40),
    ]
    result = blur_regions(img, rects, radius=18)
    result = add_watermark(result)
    result.save(dst, "PNG", optimize=True)


def mask_warehouse_returns(src: Path, dst: Path) -> None:
    """창고 재고 관리 - 반송 및 반품.png (3209x1947)

    보존: 상단 파랑 헤더, 탭, 우측 액션 버튼, 컬럼 헤더
    마스킹: 데이터 로우 전체 (제품ID, 브랜드코드, 썸네일, 설명)
    """
    img = Image.open(src).convert("RGB")
    rects = [
        (0, 320, img.width, img.height),
    ]
    result = blur_regions(img, rects, radius=28)
    result = add_watermark(result)
    result.save(dst, "PNG", optimize=True)


def mask_warehouse_stock(src: Path, dst: Path) -> None:
    """창고 재고 관리 - 재고 목록.png (3210x1932)

    보존: 상단 파랑 헤더, 탭, 우측 액션 버튼, 컬럼 헤더 (구역/제품명/컬러/제품번호/사이즈별 재고)
    마스킹: 데이터 로우 전체 (제품명, 제품코드, 재고, 수정일)
    """
    img = Image.open(src).convert("RGB")
    rects = [
        (0, 330, img.width, img.height),
    ]
    result = blur_regions(img, rects, radius=28)
    result = add_watermark(result)
    result.save(dst, "PNG", optimize=True)


def main() -> None:
    jobs = [
        ("구매내역관리.png", mask_purchase_history),
        ("재고조회기.png", mask_stock_lookup),
        ("창고 재고 관리 - 반송 및 반품.png", mask_warehouse_returns),
        ("창고 재고 관리 - 재고 목록.png", mask_warehouse_stock),
    ]
    for filename, fn in jobs:
        src = BASE / filename
        dst = OUT / (src.stem + "_masked.png")
        if not src.exists():
            print(f"MISSING: {src}")
            continue
        fn(src, dst)
        print(f"OK: {dst}")


if __name__ == "__main__":
    main()
