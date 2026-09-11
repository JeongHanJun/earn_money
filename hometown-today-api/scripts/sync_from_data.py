"""
data/ 폴더에서 hometown-today-api/public/api/로 데이터 동기화.

- weather: 250 파일 전량 복사
- trends/kr: 그대로 복사
- youth: 만료 정책 제외 필터 (2,700+ → ~500)

daily-deploy.yml 파이프라인에서 CF Pages 배포 직전에 호출.
"""
from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # earn_money/
DATA = ROOT / "data"
DEST = Path(__file__).resolve().parents[1] / "public" / "api"


def sync_weather() -> int:
    """전체 250 시군구 weather 복사."""
    src = DATA / "weather"
    dst = DEST / "weather"
    if dst.exists():
        shutil.rmtree(dst)
    dst.mkdir(parents=True, exist_ok=True)
    count = 0
    for sido_dir in src.iterdir():
        if not sido_dir.is_dir():
            continue
        target_sido = dst / sido_dir.name
        target_sido.mkdir(parents=True, exist_ok=True)
        for muni_file in sido_dir.glob("*.json"):
            shutil.copy2(muni_file, target_sido / muni_file.name)
            count += 1
    return count


def sync_trends() -> None:
    """kr.json만 복사 (다른 국가는 앱에서 사용 안함)."""
    src = DATA / "trends" / "kr.json"
    dst = DEST / "trends" / "kr.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def sync_youth() -> tuple[int, int]:
    """만료된 정책 제외 (biz_end / apply_period 마감일 기준). 활성만 서빙."""
    src = DATA / "youth" / "list.json"
    dst = DEST / "youth.json"
    with src.open(encoding="utf-8") as f:
        data = json.load(f)
    items = data["data"]["items"]
    now = datetime.now()

    def has_active_period(p: dict) -> bool:
        # apply_period 우선
        ap = (p.get("apply_period") or "").strip()
        if "~" in ap:
            parts = [x.strip() for x in ap.split("~")]
            if len(parts) == 2 and len(parts[0]) == 8 and len(parts[1]) == 8:
                try:
                    return datetime.strptime(parts[1], "%Y%m%d") >= now
                except ValueError:
                    pass
        # biz_end fallback
        bs, be = (p.get("biz_start") or "").strip(), (p.get("biz_end") or "").strip()
        if len(bs) == 8 and len(be) == 8:
            try:
                return datetime.strptime(be, "%Y%m%d") >= now
            except ValueError:
                pass
        # 상시/수시/연중
        return any(k in ap for k in ("상시", "수시", "연중"))

    active = [x for x in items if has_active_period(x)]
    out = {
        "fetched_at": data["fetched_at"],
        "data": {
            "total_count": len(active),
            "count": len(active),
            "items": active,
        },
    }
    with dst.open("w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    return len(items), len(active)


def main() -> int:
    print(f"root={ROOT}")
    print(f"dest={DEST}")

    weather_count = sync_weather()
    print(f"weather: {weather_count} files")

    sync_trends()
    print("trends: kr.json copied")

    y_total, y_active = sync_youth()
    print(f"youth: {y_total} -> {y_active} active")

    return 0


if __name__ == "__main__":
    sys.exit(main())
