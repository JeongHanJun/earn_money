"""
'우리동네 오늘' 앱 아이콘 생성 (라이트 / 다크 2종, 600×600 PNG).

컨셉: 아침 브리핑 유틸리티. 집(우리동네) + 태양·달(오늘) 조합.
디자인 원칙: iOS 아이콘 스타일 (rounded rect 22% radius), 미니멀, 단색 그라디언트 배경, 흰색 단순 도형.
"""
from PIL import Image, ImageDraw, ImageFilter

SIZE = 600
CORNER_RADIUS = int(SIZE * 0.22)  # iOS style


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def diag_gradient(size: int, c1: tuple[int, int, int], c2: tuple[int, int, int]) -> Image.Image:
    """대각선(좌상→우하) 그라디언트."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            r = int(c1[0] + (c2[0] - c1[0]) * t)
            g = int(c1[1] + (c2[1] - c1[1]) * t)
            b = int(c1[2] + (c2[2] - c1[2]) * t)
            px[x, y] = (r, g, b)
    return img


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=255)
    return mask


def draw_house(draw: ImageDraw.ImageDraw, cx: int, cy: int, w: int, h: int, fill: tuple[int, int, int, int]) -> None:
    """집(지붕 + 몸통) 오각형 실루엣."""
    roof_h = int(h * 0.42)
    body_top = cy - h // 2 + roof_h
    body_left = cx - w // 2
    body_right = cx + w // 2
    body_bottom = cy + h // 2
    apex = (cx, cy - h // 2)
    tl = (body_left, body_top)
    tr = (body_right, body_top)
    br = (body_right, body_bottom)
    bl = (body_left, body_bottom)
    draw.polygon([apex, tr, br, bl, tl], fill=fill)


def draw_sun(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, fill: tuple[int, int, int, int]) -> None:
    draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], fill=fill)


def draw_moon(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, fill: tuple[int, int, int, int]) -> None:
    """반달(초승달 아님, 3/4 크기)."""
    # 큰 원 - 살짝 작은 원(어긋난 위치)으로 초승달 형태
    outer = Image.new("RGBA", (r * 4, r * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(outer)
    d.ellipse([(r, r), (3 * r, 3 * r)], fill=fill)
    # 어긋난 원으로 잘라내기
    cutout = Image.new("RGBA", (r * 4, r * 4), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(cutout)
    off = int(r * 0.55)
    d2.ellipse([(r + off, r - int(r * 0.1)), (3 * r + off, 3 * r - int(r * 0.1))], fill=(0, 0, 0, 255))
    # subtract
    from PIL import ImageChops
    result = ImageChops.subtract(outer.split()[3], cutout.split()[3])
    moon_img = Image.new("RGBA", (r * 4, r * 4), fill)
    moon_img.putalpha(result)
    # paste onto scene
    scene = draw._image  # underlying
    scene.paste(moon_img, (cx - 2 * r, cy - 2 * r), moon_img)


def make_icon(path: str, bg_start: str, bg_end: str, night: bool) -> None:
    # 앱인토스 규정: 모서리 사각(90°) + 배경 투명 불가 → 전체 사각 그라디언트로 채움
    icon = diag_gradient(SIZE, hex_rgb(bg_start), hex_rgb(bg_end)).convert("RGBA")

    draw = ImageDraw.Draw(icon)

    # 태양/달 (상단에 위치)
    accent_y = int(SIZE * 0.30)
    accent_x = int(SIZE * 0.68)
    accent_r = int(SIZE * 0.09)
    accent_color = (255, 255, 255, 255)
    if night:
        draw_moon(draw, accent_x, accent_y, accent_r, accent_color)
    else:
        draw_sun(draw, accent_x, accent_y, accent_r, accent_color)

    # 집 (중앙 하단)
    house_cx = int(SIZE * 0.50)
    house_cy = int(SIZE * 0.60)
    house_w = int(SIZE * 0.44)
    house_h = int(SIZE * 0.44)
    draw_house(draw, house_cx, house_cy, house_w, house_h, (255, 255, 255, 255))

    # 집 앞 작은 창문(중앙 사각형)으로 실루엣 절제 - 원형 홀
    hole_r = int(SIZE * 0.055)
    hole_cx = house_cx
    hole_cy = int(house_cy + SIZE * 0.05)
    # 홀 위치의 그라디언트 색을 다시 계산 (창문 실루엣 절제 효과)
    t = (hole_cx + hole_cy) / (2 * (SIZE - 1))
    c1 = hex_rgb(bg_start)
    c2 = hex_rgb(bg_end)
    hole_color = (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
        255,
    )
    draw.ellipse(
        [(hole_cx - hole_r, hole_cy - hole_r), (hole_cx + hole_r, hole_cy + hole_r)],
        fill=hole_color,
    )

    # RGB로 저장 (알파 채널 제거, 투명 영역 없음 명확화)
    icon.convert("RGB").save(path, "PNG")
    print(f"saved: {path}")


if __name__ == "__main__":
    # 라이트: 아침 로즈-오렌지 (아침 해)
    make_icon(
        r"C:\Users\hanjun\earn_money\assets\hometown-today-logo-light.png",
        bg_start="#F97316",  # orange-500
        bg_end="#F43F5E",    # rose-500
        night=False,
    )
    # 다크: 밤 인디고-바이올렛 (달)
    make_icon(
        r"C:\Users\hanjun\earn_money\assets\hometown-today-logo-dark.png",
        bg_start="#312E81",  # indigo-900
        bg_end="#4C1D95",    # violet-900
        night=True,
    )
