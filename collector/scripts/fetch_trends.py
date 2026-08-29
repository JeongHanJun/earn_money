"""트렌드 수집 - 7개국 (KR/JP/US/UK/TW/DE/VN)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from collector.storage import write_json
from collector.trends import COUNTRIES, TrendsClient


def main() -> None:
    client = TrendsClient()
    for code in COUNTRIES:
        info = COUNTRIES[code]
        print(f"\n=== {info['flag']} {code} {info['name']} ===")
        data = client.fetch_country(code)

        n_gt = len(data.get("google_trends", []))
        n_yt = len(data.get("youtube_popular", []))
        n_gn = sum(len(v) for v in data.get("google_news", {}).values())
        custom = data.get("custom", {})
        n_custom = sum(
            len(v.get("items", [])) if v.get("type") != "press_groups"
            else sum(len(p.get("items", [])) for p in v.get("items", []))
            for v in custom.values()
        )

        print(f"  Google Trends: {n_gt}")
        print(f"  YouTube: {n_yt}")
        print(f"  Google News: {n_gn} ({len(data.get('google_news', {}))} 카테고리)")
        for key, spec in custom.items():
            if spec["type"] == "press_groups":
                total = sum(len(p.get("items", [])) for p in spec["items"])
                print(f"  {spec['name']}: {total} ({len(spec['items'])} 언론사)")
            else:
                print(f"  {spec['name']}: {len(spec['items'])}")

        out = write_json(f"trends/{code}.json", data)
        print(f"  → {out.name}")

    print("\n=== 완료 ===")


if __name__ == "__main__":
    main()
