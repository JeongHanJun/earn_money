#!/usr/bin/env python3
"""SQL 파일을 Cloudflare D1 REST API로 문 단위 실행.

Usage: python3 apply-d1-sql.py <sql_file> [--db-id <uuid>]
Env:   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

DEFAULT_DB_ID = "c21bdb40-5834-41e7-840d-f6f648f1d24a"


def split_sql(text: str) -> list[str]:
    # 주석 라인 제거 후 ; 기준 분할. 트랜잭션 지시어(BEGIN/COMMIT)도 개별 statement.
    no_line_comments = "\n".join(
        line for line in text.splitlines() if not line.strip().startswith("--")
    )
    stmts = [s.strip() for s in no_line_comments.split(";")]
    return [s for s in stmts if s]


def execute(account: str, token: str, db_id: str, stmt: str) -> tuple[bool, dict]:
    url = f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db_id}/query"
    body = json.dumps({"sql": stmt}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return True, json.loads(res.read())
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read())
        except Exception:
            payload = {"error": str(e)}
        return False, payload


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print("usage: apply-d1-sql.py <sql_file> [--db-id <uuid>]", file=sys.stderr)
        return 2

    sql_file = args[0]
    db_id = DEFAULT_DB_ID
    if "--db-id" in args:
        db_id = args[args.index("--db-id") + 1]

    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not account or not token:
        print("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN required", file=sys.stderr)
        return 2

    with open(sql_file, encoding="utf-8") as f:
        text = f.read()
    stmts = split_sql(text)
    print(f"[apply-d1] {sql_file}: {len(stmts)} statements")

    started = time.time()
    fail = 0
    for i, s in enumerate(stmts, 1):
        ok, payload = execute(account, token, db_id, s)
        if not ok or not payload.get("success", True):
            errs = payload.get("errors") or payload
            msg = f"[{i}/{len(stmts)}] FAIL: {json.dumps(errs)[:800]} | stmt: {s[:400]}"
            print(f"::error title=D1 apply failed::{msg}")
            print(msg, file=sys.stderr)
            fail += 1
            if fail >= 3:
                print("::error::too many failures, aborting")
                return 1
        if i % 500 == 0:
            elapsed = int(time.time() - started)
            print(f"[apply-d1] progress {i}/{len(stmts)} · {elapsed}s elapsed · fail={fail}")

    elapsed = int(time.time() - started)
    print(f"[apply-d1] done: {len(stmts) - fail}/{len(stmts)} OK · {elapsed}s")
    if fail == 0:
        print(f"::notice title=D1 apply OK::{len(stmts)} statements applied in {elapsed}s")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
