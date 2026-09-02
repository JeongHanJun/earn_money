"""중앙부처 복지서비스 전체 목록 수집.

461개 전체를 페이지네이션으로 수집 → data/welfare/list.json (병합)

견고화 (2026-09-02):
- 페이지별 지수 백오프 재시도 (일시적 서버 flake 흡수)
- 일일 quota 초과는 조기 종료 (fetch_welfare_detail 과 동일 패턴)
- 어느 한 페이지라도 최종 실패 시 기존 list.json 보존 (부분 갱신으로 downgrade 하지 않음)
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from collector.config import Config
from collector.storage import write_json
from collector.welfare import WelfareClient

PAGE_SIZE = 100


class DailyQuotaExceeded(RuntimeError):
    """data.go.kr 일일 요청 제한 초과 — 오늘은 더 이상 시도해도 소용없음."""


def _is_quota_message(msg: str) -> bool:
    return (
        "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS" in msg
        or "일일 서비스 요청제한" in msg
    )


def fetch_page_with_retry(
    client: WelfareClient, page: int, max_retries: int = 5
) -> "object":
    """단일 페이지 fetch. 429/네트워크 flake 시 지수 백오프. quota 초과는 즉시 예외."""
    delay = 2.0
    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            return client.list_services(page_no=page, num_of_rows=PAGE_SIZE)
        except requests.HTTPError as e:
            last_error = e
            body = ""
            try:
                body = e.response.text if e.response is not None else ""
            except Exception:
                pass
            if _is_quota_message(body):
                raise DailyQuotaExceeded(
                    "data.go.kr 일일 quota 초과 — 오늘은 더 이상 진행 불가"
                ) from e
            status = e.response.status_code if e.response is not None else 0
            wait = delay * (2**attempt)
            print(
                f"    HTTP {status} on page {page} → {wait:.0f}s 대기 후 재시도 "
                f"({attempt+1}/{max_retries})",
                file=sys.stderr,
            )
            time.sleep(wait)
            continue
        except RuntimeError as e:
            if _is_quota_message(str(e)):
                raise DailyQuotaExceeded(
                    "data.go.kr 일일 quota 초과 — 오늘은 더 이상 진행 불가"
                ) from e
            last_error = e
            wait = delay * (2**attempt)
            print(
                f"    RuntimeError on page {page}: {e} → {wait:.0f}s 대기 후 재시도 "
                f"({attempt+1}/{max_retries})",
                file=sys.stderr,
            )
            time.sleep(wait)
            continue
        except Exception as e:
            last_error = e
            wait = delay * (2**attempt)
            print(
                f"    Error on page {page}: {e} → {wait:.0f}s 대기 후 재시도 "
                f"({attempt+1}/{max_retries})",
                file=sys.stderr,
            )
            time.sleep(wait)
            continue
    raise last_error if last_error else RuntimeError(f"unknown error on page {page}")


def main() -> None:
    Config.check()
    client = WelfareClient()

    all_items: list[dict] = []
    page = 1
    total: int | None = None

    while True:
        try:
            resp = fetch_page_with_retry(client, page)
        except DailyQuotaExceeded as e:
            # 오늘 quota 소진: 기존 list.json 보존, 다음 사이클 재시도.
            print(f"[QUOTA] {e} — 오늘 갱신 skip (기존 list.json 유지)", file=sys.stderr)
            return
        except Exception as e:
            print(
                f"[FAIL] page {page} 최종 실패: {e} — 기존 list.json 유지 "
                f"(부분 결과 {len(all_items)}개 파기)",
                file=sys.stderr,
            )
            # 어느 한 페이지 실패 시 부분 결과로 덮어쓰지 않음.
            # 다음 daily 사이클에서 재시도. Workflow 는 continue-on-error 라 exit 1 도 안전.
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
