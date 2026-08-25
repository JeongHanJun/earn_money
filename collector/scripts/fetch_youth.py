"""온통청년 청년정책 전체 수집 (2700+개).

- 500 에러 발생 잦음 → 재시도 로직 추가
- pageSize 50 (100은 서버 타임아웃)
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from collector.config import Config
from collector.storage import write_json
from collector.youth import YouthClient

PAGE_SIZE = 50


def fetch_with_retry(client: YouthClient, page: int, max_retries: int = 4):
    delay = 2.0
    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            return client.list_policies(page_num=page, page_size=PAGE_SIZE)
        except (requests.HTTPError, requests.RequestException, ValueError, RuntimeError) as e:
            last_error = e
            wait = delay * (2**attempt)
            print(f"    page {page} 오류 → {wait:.0f}s 후 재시도 ({attempt+1}/{max_retries}): {e}",
                  file=sys.stderr)
            time.sleep(wait)
    raise last_error if last_error else RuntimeError(f"unknown error on page {page}")


def main(delay_seconds: float = 0.5) -> None:
    Config.check()
    client = YouthClient()

    all_items: list[dict] = []
    page = 1
    total: int | None = None
    fail_pages: list[int] = []

    while True:
        try:
            resp = fetch_with_retry(client, page)
        except Exception as e:
            print(f"[SKIP] page {page}: {e}", file=sys.stderr)
            fail_pages.append(page)
            page += 1
            if total and (page - 1) * PAGE_SIZE >= total:
                break
            continue

        if total is None:
            total = resp.total_count
            print(f"total: {total} 개, pageSize={PAGE_SIZE}")

        batch = resp.to_json()["items"]
        if not batch:
            break

        all_items.extend(batch)
        if page % 5 == 0 or len(all_items) >= total:
            print(f"[OK] page {page}: 누적 {len(all_items)}/{total}")

        if len(all_items) >= total:
            break
        page += 1
        if delay_seconds:
            time.sleep(delay_seconds)

    payload = {
        "total_count": total,
        "count": len(all_items),
        "items": all_items,
    }
    out = write_json("youth/list.json", payload)
    print(f"\n=== {len(all_items)}개 저장 → {out.name} ===")
    if fail_pages:
        print(f"실패한 페이지: {fail_pages}")


if __name__ == "__main__":
    main()
