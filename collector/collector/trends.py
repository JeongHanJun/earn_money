"""트렌드 수집기 - Google News + HackerNews + Google Trends + YouTube + Naver + Daum."""
from __future__ import annotations

import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import requests


# Google News RSS 카테고리 (한국)
GOOGLE_NEWS_CATEGORIES: dict[str, dict[str, str]] = {
    "top": {"topic": "", "name": "주요 뉴스"},
    "nation": {"topic": "NATION", "name": "국내"},
    "world": {"topic": "WORLD", "name": "세계"},
    "business": {"topic": "BUSINESS", "name": "경제"},
    "technology": {"topic": "TECHNOLOGY", "name": "IT·과학"},
    "entertainment": {"topic": "ENTERTAINMENT", "name": "연예"},
    "sports": {"topic": "SPORTS", "name": "스포츠"},
    "health": {"topic": "HEALTH", "name": "건강"},
}


@dataclass
class TrendItem:
    title: str
    link: str
    description: str
    source: str
    category: str
    category_name: str
    publisher: str
    pub_date: str
    fetched_at: str

    def to_json(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "link": self.link,
            "description": self.description,
            "source": self.source,
            "category": self.category,
            "category_name": self.category_name,
            "publisher": self.publisher,
            "pub_date": self.pub_date,
            "fetched_at": self.fetched_at,
        }


def _clean_html(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s or "")
    s = s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    s = s.replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
    return s.strip()


def _parse_pubdate(s: str) -> str:
    if not s:
        return ""
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(s).isoformat()
    except Exception:
        return s


def _extract_publisher_from_title(title: str) -> tuple[str, str]:
    m = re.match(r"^(.+?)\s+-\s+([^-]+)$", title.strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return title, ""


def fetch_google_news(
    session: requests.Session,
    slug: str,
    limit: int = 15,
    timeout: float = 10.0,
) -> list[TrendItem]:
    info = GOOGLE_NEWS_CATEGORIES[slug]
    if info["topic"]:
        url = (
            f"https://news.google.com/rss/headlines/section/topic/{info['topic']}"
            f"?hl=ko&gl=KR&ceid=KR:ko"
        )
    else:
        url = "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko"

    now = datetime.now(timezone.utc).isoformat()
    try:
        resp = session.get(
            url, timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0 (ryanpp-collector)"},
        )
        resp.raise_for_status()
    except Exception as e:
        print(f"[FAIL] google news {slug}: {e}")
        return []

    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError as e:
        print(f"[FAIL] parse {slug}: {e}")
        return []

    items: list[TrendItem] = []
    for elem in root.findall(".//item")[:limit]:
        raw_title = _clean_html(elem.findtext("title") or "")
        title, publisher = _extract_publisher_from_title(raw_title)
        link = (elem.findtext("link") or "").strip()
        desc = _clean_html(elem.findtext("description") or "")
        pub = _parse_pubdate(elem.findtext("pubDate") or "")
        if not title or not link:
            continue
        items.append(TrendItem(
            title=title,
            link=link,
            description=desc[:200],
            source="Google News",
            category=slug,
            category_name=info["name"],
            publisher=publisher,
            pub_date=pub,
            fetched_at=now,
        ))
    return items


def fetch_hackernews(session: requests.Session, limit: int = 15,
                     timeout: float = 10.0) -> list[TrendItem]:
    now = datetime.now(timezone.utc).isoformat()
    try:
        top_ids = session.get(
            "https://hacker-news.firebaseio.com/v0/topstories.json",
            timeout=timeout,
        ).json()[:limit]
    except Exception as e:
        print(f"[FAIL] hackernews top: {e}")
        return []

    items: list[TrendItem] = []
    for hid in top_ids:
        try:
            story = session.get(
                f"https://hacker-news.firebaseio.com/v0/item/{hid}.json",
                timeout=timeout,
            ).json()
            if not story or "title" not in story:
                continue
            items.append(TrendItem(
                title=story["title"],
                link=story.get("url") or f"https://news.ycombinator.com/item?id={hid}",
                description=f"{story.get('score', 0)} points · {story.get('descendants', 0)} comments",
                source="HackerNews",
                category="it_global",
                category_name="글로벌 IT",
                publisher="HackerNews",
                pub_date=datetime.fromtimestamp(story.get("time", 0), timezone.utc).isoformat()
                if story.get("time") else "",
                fetched_at=now,
            ))
        except Exception:
            continue
    return items


# ---------- Google Trends 실시간 급상승 검색어 (RSS) ----------

def fetch_google_trends(session: requests.Session, timeout: float = 10.0) -> list[dict[str, Any]]:
    """Google Trends 한국 급상승 검색어 (RSS 엔드포인트)."""
    url = "https://trends.google.com/trending/rss?geo=KR"
    try:
        resp = session.get(url, timeout=timeout,
                           headers={"User-Agent": "Mozilla/5.0 (ryanpp-collector)"})
        resp.raise_for_status()
    except Exception as e:
        print(f"[FAIL] google trends: {e}")
        return []

    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError as e:
        print(f"[FAIL] google trends parse: {e}")
        return []

    ns = {"ht": "https://trends.google.com/trending/rss"}
    results: list[dict[str, Any]] = []
    for idx, item in enumerate(root.findall(".//item"), 1):
        keyword = (item.findtext("title") or "").strip()
        traffic = (item.findtext("ht:approx_traffic", "", ns) or "").strip()
        pub = _parse_pubdate(item.findtext("pubDate") or "")

        articles: list[dict[str, str]] = []
        for n in item.findall("ht:news_item", ns):
            n_title = _clean_html(n.findtext("ht:news_item_title", "", ns) or "")
            n_url = (n.findtext("ht:news_item_url", "", ns) or "").strip()
            n_source = (n.findtext("ht:news_item_source", "", ns) or "").strip()
            if n_title and n_url:
                articles.append({"title": n_title, "url": n_url, "source": n_source})

        if not keyword:
            continue
        results.append({
            "rank": idx,
            "keyword": keyword,
            "traffic": traffic,
            "pub_date": pub,
            "articles": articles[:3],
        })
    return results


# ---------- YouTube 한국 인기 동영상 (Data API v3) ----------

def fetch_youtube_popular(session: requests.Session, api_key: str,
                          limit: int = 25, timeout: float = 10.0) -> list[dict[str, Any]]:
    """YouTube Data API v3 - chart=mostPopular, regionCode=KR."""
    if not api_key:
        return []
    url = "https://www.googleapis.com/youtube/v3/videos"
    params = {
        "part": "snippet,statistics",
        "chart": "mostPopular",
        "regionCode": "KR",
        "maxResults": limit,
        "key": api_key,
    }
    try:
        resp = session.get(url, params=params, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"[FAIL] youtube popular: {e}")
        return []

    results: list[dict[str, Any]] = []
    for idx, item in enumerate(data.get("items", []), 1):
        sn = item.get("snippet", {})
        st = item.get("statistics", {})
        thumbs = sn.get("thumbnails", {})
        thumb = (thumbs.get("medium") or thumbs.get("high") or thumbs.get("default") or {}).get("url", "")
        results.append({
            "rank": idx,
            "video_id": item.get("id", ""),
            "title": sn.get("title", ""),
            "channel": sn.get("channelTitle", ""),
            "thumbnail": thumb,
            "published_at": sn.get("publishedAt", ""),
            "view_count": int(st.get("viewCount", 0) or 0),
            "like_count": int(st.get("likeCount", 0) or 0),
        })
    return results


# ---------- Naver 뉴스 랭킹 (많이 본 뉴스, 언론사별) ----------

def fetch_naver_ranking(session: requests.Session, per_press: int = 5,
                        timeout: float = 10.0) -> list[dict[str, Any]]:
    """Naver popularDay - 언론사별 많이 본 뉴스."""
    url = "https://news.naver.com/main/ranking/popularDay.naver"
    try:
        resp = session.get(
            url, timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0 (ryanpp-collector)"},
        )
        resp.raise_for_status()
    except Exception as e:
        print(f"[FAIL] naver ranking: {e}")
        return []

    html = resp.content.decode("euc-kr", errors="replace")

    box_pattern = re.compile(
        r'<div class="rankingnews_box"[^>]*>(.*?)</div>\s*</div>',
        re.DOTALL,
    )
    press_pattern = re.compile(r'<strong class="rankingnews_name">([^<]+)</strong>')
    article_pattern = re.compile(
        r'<a href="(https://n\.news\.naver\.com/article/[^"]+)"[^>]*class="list_title[^"]*"[^>]*>([^<]+)</a>',
    )

    results: list[dict[str, Any]] = []
    for box in box_pattern.findall(html):
        press_m = press_pattern.search(box)
        press = press_m.group(1).strip() if press_m else "언론사"
        arts = article_pattern.findall(box)
        items = [
            {"rank": i + 1, "title": _clean_html(t), "link": link}
            for i, (link, t) in enumerate(arts[:per_press])
        ]
        if items:
            results.append({"press": press, "items": items})
    return results


# ---------- Daum 뉴스 인기 랭킹 ----------

def fetch_daum_ranking(session: requests.Session, limit: int = 20,
                       timeout: float = 10.0) -> list[dict[str, Any]]:
    """Daum media.daum.net/ranking/popular."""
    url = "https://media.daum.net/ranking/popular"
    try:
        resp = session.get(
            url, timeout=timeout, allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (ryanpp-collector)"},
        )
        resp.raise_for_status()
    except Exception as e:
        print(f"[FAIL] daum ranking: {e}")
        return []

    html = resp.text
    pattern = re.compile(
        r'<a[^>]*href="(https?://v\.daum\.net/v/\d+)"[^>]*>(.*?)</a>',
        re.DOTALL,
    )
    seen: set[str] = set()
    results: list[dict[str, Any]] = []
    for m in pattern.finditer(html):
        link = m.group(1)
        inner = _clean_html(m.group(2))
        if link in seen or not inner or len(inner) < 10:
            continue
        seen.add(link)
        # 언론사·시간 등 부가 텍스트가 붙는 경우 첫 문장만 사용
        title = re.split(r"\s{2,}", inner)[0]
        results.append({
            "rank": len(results) + 1,
            "title": title[:120],
            "link": link,
        })
        if len(results) >= limit:
            break
    return results


class TrendsClient:
    def __init__(self) -> None:
        self._session = requests.Session()

    def fetch_all(self, per_category: int = 15, hn_limit: int = 15) -> dict[str, Any]:
        google_by_category: dict[str, list[dict]] = {}
        for slug in GOOGLE_NEWS_CATEGORIES:
            items = fetch_google_news(self._session, slug, per_category)
            google_by_category[slug] = [it.to_json() for it in items]

        hn = fetch_hackernews(self._session, hn_limit)
        google_trends = fetch_google_trends(self._session)
        yt_key = os.environ.get("YOUTUBE_API_KEY", "")
        youtube = fetch_youtube_popular(self._session, yt_key, limit=25)
        naver = fetch_naver_ranking(self._session, per_press=5)
        daum = fetch_daum_ranking(self._session, limit=20)

        return {
            "google_news": google_by_category,
            "hackernews": [it.to_json() for it in hn],
            "google_trends": google_trends,
            "youtube_popular": youtube,
            "naver_ranking": naver,
            "daum_ranking": daum,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
