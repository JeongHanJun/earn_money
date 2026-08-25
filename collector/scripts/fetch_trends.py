"""트렌드 수집 - Naver 뉴스 6개 카테고리 + HackerNews 15."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from collector.storage import write_json
from collector.trends import TrendsClient, GOOGLE_NEWS_CATEGORIES


def main() -> None:
    client = TrendsClient()
    data = client.fetch_all()

    total_gn = sum(len(v) for v in data["google_news"].values())
    total_hn = len(data["hackernews"])
    print(f"Google News: {total_gn}개 ({len(GOOGLE_NEWS_CATEGORIES)} 카테고리)")
    print(f"HackerNews: {total_hn}개")

    out = write_json("trends/list.json", data)
    print(f"저장 → {out.name}")


if __name__ == "__main__":
    main()
