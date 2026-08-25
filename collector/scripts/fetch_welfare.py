"""중앙부처 복지서비스 전체 목록 수집.

461개 전체를 페이지네이션으로 수집 → data/welfare/list.json (병합)
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from collector.config import Config
from collector.storage import write_json
from collector.welfare import WelfareClient

PAGE_SIZE = 100


def main() -> None:
    Config.check()
    client = WelfareClient()

    all_items: list[dict] = []
    page = 1
    total = None

    while True:
        try:
            resp = client.list_services(page_no=page, num_of_rows=PAGE_SIZE)
        except Exception as e:
            print(f"[FAIL] page {page}: {e}", file=sys.stderr)
            sys.exit(1)

        if total is None:
            total = resp.total_count
            print(f"total: {total} 개")

        batch = resp.to_json()["items"]
        all_items.extend(batch)
        print(f"[OK] page {page}: +{len(batch)} → 누적 {len(all_items)}/{total}")

        if len(all_items) >= total or len(batch) == 0:
            break
        page += 1
        time.sleep(0.2)

    payload = {
        "total_count": total,
        "count": len(all_items),
        "items": all_items,
    }
    out = write_json("welfare/list.json", payload)
    print(f"\n=== {len(all_items)}개 → {out.name} ===")


if __name__ == "__main__":
    main()
