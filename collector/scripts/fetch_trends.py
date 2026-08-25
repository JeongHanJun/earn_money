"""트렌드 수집 - Google News + HackerNews + Google Trends + YouTube + Naver + Daum."""
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
    total_gt = len(data.get("google_trends", []))
    total_yt = len(data.get("youtube_popular", []))
    total_naver = sum(len(p.get("items", [])) for p in data.get("naver_ranking", []))
    total_daum = len(data.get("daum_ranking", []))

    print(f"Google News: {total_gn} ({len(GOOGLE_NEWS_CATEGORIES)} 카테고리)")
    print(f"HackerNews: {total_hn}")
    print(f"Google Trends 급상승: {total_gt}")
    print(f"YouTube 인기: {total_yt}")
    print(f"Naver 랭킹: {total_naver} ({len(data.get('naver_ranking', []))} 언론사)")
    print(f"Daum 랭킹: {total_daum}")

    out = write_json("trends/list.json", data)
    print(f"저장 → {out.name}")


if __name__ == "__main__":
    main()
