"""전국 시군구 250개 단기예보 수집 → data/weather/{sido_slug}/{muni_slug}.json.

지역 목록은 web/lib/regions.json 을 소스로 사용 (Frontend와 공유).
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from collector.config import Config, REPO_ROOT
from collector.grid import Grid
from collector.storage import write_json
from collector.weather import WeatherClient

REGIONS_PATH = REPO_ROOT / "web" / "lib" / "regions.json"


def load_regions() -> dict:
    return json.loads(REGIONS_PATH.read_text(encoding="utf-8"))


def main(delay_seconds: float = 0.1) -> None:
    Config.check()
    client = WeatherClient()
    regions = load_regions()

    total = 0
    ok = 0
    fail = 0

    for prov in regions["provinces"]:
        prov_slug = prov["slug"]
        for muni in prov["municipalities"]:
            total += 1
            grid = Grid(nx=muni["nx"], ny=muni["ny"])
            try:
                resp = client.village_forecast(grid=grid)
            except Exception as e:
                print(f"[FAIL] {prov_slug}/{muni['slug']} nx={grid.nx} ny={grid.ny}: {e}",
                      file=sys.stderr)
                fail += 1
                continue

            out = write_json(f"weather/{prov_slug}/{muni['slug']}.json", resp.to_json())
            print(f"[OK] {prov_slug}/{muni['slug']} ({grid.nx},{grid.ny}) → "
                  f"{len(resp.items)} items")
            ok += 1
            if delay_seconds:
                time.sleep(delay_seconds)

    print(f"\n=== {ok}/{total} 성공, {fail} 실패 ===")
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
