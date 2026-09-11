"""
폰 스크린샷(1080×2400)을 앱인토스 콘솔 세로형 규격 636×1048로 변환.

전략: 상단 헤더 살짝 남기고 아래로 크롭 → 콘텐츠(날씨/정책/트렌드/광고) 최대 노출.
636×1048 비율 = 0.607, 원본 1080×2400 비율 = 0.45 → 세로 크롭 필요.
"""
from PIL import Image

TARGET_W, TARGET_H = 636, 1048
TARGET_RATIO = TARGET_W / TARGET_H  # 0.607

SRC_DIR = r"C:\Users\hanjun\earn_money"
DST_DIR = r"C:\Users\hanjun\earn_money\assets"


def convert(src_name: str, dst_name: str, top_offset_ratio: float = 0.08) -> None:
    im = Image.open(f"{SRC_DIR}\\{src_name}")
    w, h = im.size
    # target aspect 로 세로 크롭 (필요 높이 = w / target_ratio)
    crop_h = int(w / TARGET_RATIO)
    # 상단 헤더 살짝 포함, 하단 nav bar 제외
    top = int(h * top_offset_ratio)
    if top + crop_h > h:
        top = h - crop_h
    box = (0, top, w, top + crop_h)
    cropped = im.crop(box)
    resized = cropped.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    resized.save(f"{DST_DIR}\\{dst_name}", "JPEG", quality=90)
    print(f"{dst_name}: cropped {box} -> resized to {TARGET_W}×{TARGET_H}")


if __name__ == "__main__":
    # 1. 날씨 강조: img1 상단 (헤더 + 지역 + 오늘 날씨 + 우산 판정 + 3일 예보 상단)
    convert("img1.jpg", "screenshot-1.jpg", top_offset_ratio=0.02)
    # 2. 정책 + 트렌드 시작: img2 상단 (정책 D-5·D-7 + 트렌드 상단)
    convert("img2.jpg", "screenshot-2.jpg", top_offset_ratio=0.02)
    # 3. 트렌드 + 광고 강조: img2 하단 최대 (트렌드 full + 광고 배너 + 출처)
    convert("img2.jpg", "screenshot-3.jpg", top_offset_ratio=0.26)
