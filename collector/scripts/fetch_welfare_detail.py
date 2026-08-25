"""461개 중앙부처 복지서비스 상세 정보 수집.

특징:
- 이미 저장된 파일은 skip (재실행 시 중단점에서 이어감)
- 429 Rate Limit 시 지수 백오프 재시도
- 모든 개별 파일 저장 완료 후 all_details.json 병합
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from collector.config import Config, DATA_DIR
from collector.storage import write_json
from collector.welfare import WelfareClient


def fetch_with_retry(client: WelfareClient, sid: str, max_retries: int = 5) -> dict:
    """429/기타 오류 시 지수 백오프 재시도."""
    delay = 2.0
    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            return client.get_detail(sid).to_json()
        except requests.HTTPError as e:
            last_error = e
            if e.response.status_code == 429:
                wait = delay * (2**attempt)
                print(f"    429 rate limit → {wait:.0f}s 대기 후 재시도 ({attempt+1}/{max_retries})",
                      file=sys.stderr)
                time.sleep(wait)
                continue
            raise
        except Exception as e:
            last_error = e
            break
    raise last_error if last_error else RuntimeError(f"unknown error on {sid}")


def main(delay_seconds: float = 0.5) -> None:
    Config.check()
    client = WelfareClient()

    list_file = DATA_DIR / "welfare" / "list.json"
    if not list_file.exists():
        print(f"[FAIL] list.json 없음.", file=sys.stderr)
        sys.exit(1)

    list_data = json.loads(list_file.read_text(encoding="utf-8"))["data"]
    service_ids = [s["service_id"] for s in list_data["items"]]
    total = len(service_ids)

    detail_dir = DATA_DIR / "welfare" / "detail"
    detail_dir.mkdir(parents=True, exist_ok=True)

    existing = {p.stem for p in detail_dir.glob("*.json")}
    to_fetch = [sid for sid in service_ids if sid not in existing]

    print(f"총 {total}개 중 {len(existing)}개 이미 있음. {len(to_fetch)}개 신규 수집.")

    ok = fail = 0
    for i, sid in enumerate(to_fetch, 1):
        try:
            payload = fetch_with_retry(client, sid)
            write_json(f"welfare/detail/{sid}.json", payload)
            ok += 1
            if i % 25 == 0 or i == len(to_fetch):
                print(f"  [{i}/{len(to_fetch)}] ok={ok} fail={fail}")
        except Exception as e:
            print(f"  [FAIL] {sid}: {e}", file=sys.stderr)
            fail += 1
        if delay_seconds:
            time.sleep(delay_seconds)

    # 통합 파일: 모든 개별 상세를 한 dict으로 병합
    all_details: dict[str, dict] = {}
    for f in detail_dir.glob("*.json"):
        wrapped = json.loads(f.read_text(encoding="utf-8"))
        # storage.write_json 이 {fetched_at, data} 래핑함
        payload = wrapped.get("data", wrapped)
        all_details[payload["service_id"]] = payload
    write_json("welfare/all_details.json", all_details)

    print(f"\n=== 이번 세션: {ok}/{len(to_fetch)} 성공, {fail} 실패 ===")
    print(f"=== 전체 저장: {len(all_details)}/{total} ({len(all_details)*100//total}%) ===")


if __name__ == "__main__":
    main()
