"""트렌드 수집기 - Google News RSS (KR) + HackerNews."""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import requests


# Google News RSS 카테고리 (한국)
GOOGLE_NEWS_CATEGORIES: dict[str, dict[str, str]] = {
    "top": {"topic": "", "name": "주요 뉴스"},   # top stories, no topic
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
    category: str          # slug
    category_name: str
    publisher: str
    pub_date: str          # ISO
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
    """Google News 타이틀에서 '기사 제목 - 언론사' 형식 분리."""
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
    """HackerNews top stories."""
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


class TrendsClient:
    def __init__(self) -> None:
        self._session = requests.Session()

    def fetch_all(self, per_category: int = 15, hn_limit: int = 15) -> dict[str, Any]:
        google_by_category: dict[str, list[dict]] = {}
        for slug in GOOGLE_NEWS_CATEGORIES:
            items = fetch_google_news(self._session, slug, per_category)
            google_by_category[slug] = [it.to_json() for it in items]
        hn = fetch_hackernews(self._session, hn_limit)
        return {
            "google_news": google_by_category,
            "hackernews": [it.to_json() for it in hn],
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
