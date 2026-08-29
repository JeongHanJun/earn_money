"""트렌드 수집기 - 국가별 (KR/JP/US/UK/TW/DE/VN).

각 국가마다:
- Google Trends 급상승 검색어 (RSS, geo 파라미터)
- YouTube 인기 동영상 (Data API v3, regionCode)
- Google News (RSS, hl/gl/ceid) - 8 카테고리
- 국가 특화 소스 (NHK, BBC, Yahoo Japan, NYT+HN, CNA+UDN, Der Spiegel, VnExpress, Naver, Daum)
"""
from __future__ import annotations

import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any

import requests


# --- Google News 표준 topic 슬러그 (Google이 언어별로 알아서 번역) ---
NEWS_CATEGORIES: dict[str, str] = {
    "top": "",
    "nation": "NATION",
    "world": "WORLD",
    "business": "BUSINESS",
    "technology": "TECHNOLOGY",
    "entertainment": "ENTERTAINMENT",
    "sports": "SPORTS",
    "health": "HEALTH",
}

# 표시명 (한글 UI 기준)
CATEGORY_NAMES_KO: dict[str, str] = {
    "top": "주요",
    "nation": "국내",
    "world": "세계",
    "business": "경제",
    "technology": "IT·과학",
    "entertainment": "연예",
    "sports": "스포츠",
    "health": "건강",
}

# --- 국가 registry ---
COUNTRIES: dict[str, dict[str, Any]] = {
    "kr": {
        "name": "한국",
        "flag": "🇰🇷",
        "hl": "ko", "gl": "KR", "ceid": "KR:ko",
        "geo": "KR", "region": "KR",
        "custom_sources": ["naver_ranking", "daum_ranking"],
    },
    "jp": {
        "name": "일본",
        "flag": "🇯🇵",
        "hl": "ja", "gl": "JP", "ceid": "JP:ja",
        "geo": "JP", "region": "JP",
        "custom_sources": ["yahoo_japan", "nhk"],
    },
    "us": {
        "name": "미국",
        "flag": "🇺🇸",
        "hl": "en-US", "gl": "US", "ceid": "US:en",
        "geo": "US", "region": "US",
        "custom_sources": ["nyt", "hackernews"],
    },
    "uk": {
        "name": "영국",
        "flag": "🇬🇧",
        "hl": "en-GB", "gl": "GB", "ceid": "GB:en",
        "geo": "GB", "region": "GB",
        "custom_sources": ["bbc"],
    },
    "tw": {
        "name": "대만",
        "flag": "🇹🇼",
        "hl": "zh-TW", "gl": "TW", "ceid": "TW:zh-Hant",
        "geo": "TW", "region": "TW",
        "custom_sources": ["cna", "ltn"],
    },
    "de": {
        "name": "독일",
        "flag": "🇩🇪",
        "hl": "de", "gl": "DE", "ceid": "DE:de",
        "geo": "DE", "region": "DE",
        "custom_sources": ["der_spiegel"],
    },
    "vn": {
        "name": "베트남",
        "flag": "🇻🇳",
        "hl": "vi", "gl": "VN", "ceid": "VN:vi",
        "geo": "VN", "region": "VN",
        "custom_sources": ["vnexpress"],
    },
}


# --- 공통 유틸 ---

_UA = "Mozilla/5.0 (ryanpp-collector)"


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


# 국가별 native script regex (Google Trends 관련 기사 언어 필터용)
# 국제 브랜드명(예: "tvn")이 여러 국가에서 검색될 때, Google이 다른 언어권 기사를
# 잘못 매칭하는 경우를 걸러냄. 원문에 해당 언어 문자가 없으면 제외.
_NATIVE_SCRIPT_PATTERNS: dict[str, re.Pattern[str]] = {
    "kr": re.compile(r"[가-힯]"),                     # Hangul syllables
    "jp": re.compile(r"[぀-ゟ゠-ヿ]"),        # 히라가나 + 가타카나 (한자만은 중국어 오탐)
    "tw": re.compile(r"[一-鿿]"),                     # 한자 (Traditional)
    "vn": re.compile(r"[À-ỹ]"),                     # Vietnamese diacritics range
    # de/us/uk: Latin 기본이라 필터 없음. de는 umlaut 있어도 없어도 유효.
}


def _matches_native_script(text: str, country: str) -> bool:
    """text에 country의 native script가 포함되는지. 없거나 국가에 필터 없으면 True."""
    pattern = _NATIVE_SCRIPT_PATTERNS.get(country)
    if pattern is None:
        return True
    return bool(pattern.search(text))


def _rss_get(session: requests.Session, url: str, timeout: float = 10.0):
    """공통 RSS/Atom 파싱 - ET.Element 반환, 실패 시 None."""
    try:
        resp = session.get(url, timeout=timeout, headers={"User-Agent": _UA})
        resp.raise_for_status()
        return ET.fromstring(resp.content)
    except Exception as e:
        print(f"[FAIL] fetch {url}: {e}")
        return None


def _rss_articles(session: requests.Session, url: str, limit: int = 15) -> list[dict[str, Any]]:
    """일반 RSS 파서 - <item>/<entry> 에서 title/link/description/pubDate 추출.

    RSS 2.0 및 Atom 둘 다 지원.
    """
    root = _rss_get(session, url)
    if root is None:
        return []

    ns_atom = {"atom": "http://www.w3.org/2005/Atom"}
    items_xml = root.findall(".//item")
    is_atom = False
    if not items_xml:
        items_xml = root.findall(".//atom:entry", ns_atom)
        is_atom = True

    out: list[dict[str, Any]] = []
    for elem in items_xml[:limit]:
        if is_atom:
            title = _clean_html(elem.findtext("atom:title", "", ns_atom) or "")
            link_el = elem.find("atom:link", ns_atom)
            link = (link_el.get("href") if link_el is not None else "").strip()
            desc = _clean_html(elem.findtext("atom:summary", "", ns_atom) or "")
            pub = _parse_pubdate(elem.findtext("atom:published", "", ns_atom) or "")
        else:
            title = _clean_html(elem.findtext("title") or "")
            link = (elem.findtext("link") or "").strip()
            desc = _clean_html(elem.findtext("description") or "")
            pub = _parse_pubdate(elem.findtext("pubDate") or "")

        if not title or not link:
            continue
        out.append({
            "title": title,
            "link": link,
            "description": desc[:200],
            "pub_date": pub,
        })
    return out


# --- Google 계열 (국가 파라미터) ---

def fetch_google_news_category(
    session: requests.Session, hl: str, gl: str, ceid: str,
    slug: str, limit: int = 15,
) -> list[dict[str, Any]]:
    topic = NEWS_CATEGORIES[slug]
    if topic:
        url = f"https://news.google.com/rss/headlines/section/topic/{topic}?hl={hl}&gl={gl}&ceid={ceid}"
    else:
        url = f"https://news.google.com/rss?hl={hl}&gl={gl}&ceid={ceid}"
    root = _rss_get(session, url)
    if root is None:
        return []

    items: list[dict[str, Any]] = []
    for elem in root.findall(".//item")[:limit]:
        raw_title = _clean_html(elem.findtext("title") or "")
        title, publisher = _extract_publisher_from_title(raw_title)
        link = (elem.findtext("link") or "").strip()
        desc = _clean_html(elem.findtext("description") or "")
        pub = _parse_pubdate(elem.findtext("pubDate") or "")
        if not title or not link:
            continue
        items.append({
            "title": title,
            "link": link,
            "description": desc[:200],
            "publisher": publisher,
            "pub_date": pub,
        })
    return items


def fetch_google_news_all(
    session: requests.Session, hl: str, gl: str, ceid: str, per_category: int = 15,
) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    for slug in NEWS_CATEGORIES:
        out[slug] = fetch_google_news_category(session, hl, gl, ceid, slug, per_category)
    return out


def fetch_google_trends(session: requests.Session, geo: str = "KR") -> list[dict[str, Any]]:
    """Google Trends 급상승 검색어 (RSS, geo 파라미터).

    관련 기사는 native script 필터 적용 (동일 브랜드명 다국가 오탐 방지).
    필터 결과 0개면 keyword는 유지하되 articles 빈 배열.
    """
    url = f"https://trends.google.com/trending/rss?geo={geo}"
    root = _rss_get(session, url)
    if root is None:
        return []

    country_code = geo.lower()
    ns = {"ht": "https://trends.google.com/trending/rss"}
    results: list[dict[str, Any]] = []
    for idx, item in enumerate(root.findall(".//item"), 1):
        keyword = (item.findtext("title") or "").strip()
        traffic = (item.findtext("ht:approx_traffic", "", ns) or "").strip()
        pub = _parse_pubdate(item.findtext("pubDate") or "")

        raw_articles: list[dict[str, str]] = []
        for n in item.findall("ht:news_item", ns):
            n_title = _clean_html(n.findtext("ht:news_item_title", "", ns) or "")
            n_url = (n.findtext("ht:news_item_url", "", ns) or "").strip()
            n_source = (n.findtext("ht:news_item_source", "", ns) or "").strip()
            if n_title and n_url:
                raw_articles.append({"title": n_title, "url": n_url, "source": n_source})

        # native script 필터: 국가 언어 문자가 title에 포함된 것만
        filtered = [a for a in raw_articles if _matches_native_script(a["title"], country_code)]

        if not keyword:
            continue
        results.append({
            "rank": idx,
            "keyword": keyword,
            "traffic": traffic,
            "pub_date": pub,
            "articles": filtered[:3],
        })
    return results


def fetch_youtube_popular(
    session: requests.Session, api_key: str, region: str = "KR", limit: int = 25,
) -> list[dict[str, Any]]:
    if not api_key:
        return []
    url = "https://www.googleapis.com/youtube/v3/videos"
    params = {
        "part": "snippet,statistics",
        "chart": "mostPopular",
        "regionCode": region,
        "maxResults": limit,
        "key": api_key,
    }
    try:
        resp = session.get(url, params=params, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"[FAIL] youtube {region}: {e}")
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


# --- 국가별 특화 소스 ---

def fetch_hackernews(session: requests.Session, limit: int = 15) -> list[dict[str, Any]]:
    try:
        top_ids = session.get(
            "https://hacker-news.firebaseio.com/v0/topstories.json",
            timeout=10.0,
        ).json()[:limit]
    except Exception as e:
        print(f"[FAIL] hackernews: {e}")
        return []

    items: list[dict[str, Any]] = []
    for hid in top_ids:
        try:
            story = session.get(
                f"https://hacker-news.firebaseio.com/v0/item/{hid}.json",
                timeout=10.0,
            ).json()
            if not story or "title" not in story:
                continue
            items.append({
                "title": story["title"],
                "link": story.get("url") or f"https://news.ycombinator.com/item?id={hid}",
                "description": f"{story.get('score', 0)} points · {story.get('descendants', 0)} comments",
                "publisher": "HackerNews",
                "pub_date": datetime.fromtimestamp(story.get("time", 0), timezone.utc).isoformat()
                if story.get("time") else "",
            })
        except Exception:
            continue
    return items


def fetch_naver_ranking(session: requests.Session, per_press: int = 5) -> list[dict[str, Any]]:
    """Naver popularDay - 언론사별 많이 본 뉴스 (반환: [{press, items:[{rank,title,link}]}])."""
    url = "https://news.naver.com/main/ranking/popularDay.naver"
    try:
        resp = session.get(url, timeout=10.0, headers={"User-Agent": _UA})
        resp.raise_for_status()
    except Exception as e:
        print(f"[FAIL] naver: {e}")
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


def fetch_daum_ranking(session: requests.Session, limit: int = 20) -> list[dict[str, Any]]:
    url = "https://media.daum.net/ranking/popular"
    try:
        resp = session.get(url, timeout=10.0, allow_redirects=True, headers={"User-Agent": _UA})
        resp.raise_for_status()
    except Exception as e:
        print(f"[FAIL] daum: {e}")
        return []

    html = resp.content.decode("utf-8", errors="replace")
    pattern = re.compile(
        r'<a[^>]*href="(https?://v\.daum\.net/v/\d+)"[^>]*>(.*?)</a>',
        re.DOTALL,
    )
    SKIP_LABELS = {"동영상", "포토", "관련기사", "썸네일", "이미지", "사진"}
    seen: set[str] = set()
    results: list[dict[str, Any]] = []
    for m in pattern.finditer(html):
        link = m.group(1)
        inner = _clean_html(m.group(2))
        if link in seen or not inner or len(inner) < 10:
            continue
        title = re.split(r"\s{2,}", inner)[0].strip()
        if title in SKIP_LABELS:
            continue
        seen.add(link)
        results.append({"rank": len(results) + 1, "title": title[:120], "link": link})
        if len(results) >= limit:
            break
    return results


def fetch_yahoo_japan_topics(session: requests.Session) -> list[dict[str, Any]]:
    return _rss_articles(session, "https://news.yahoo.co.jp/rss/topics/top-picks.xml")


def fetch_nhk_news(session: requests.Session) -> list[dict[str, Any]]:
    return _rss_articles(session, "https://www3.nhk.or.jp/rss/news/cat0.xml")


def fetch_nyt_rss(session: requests.Session) -> list[dict[str, Any]]:
    return _rss_articles(session, "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml")


def fetch_bbc_news(session: requests.Session) -> list[dict[str, Any]]:
    return _rss_articles(session, "https://feeds.bbci.co.uk/news/rss.xml")


def fetch_cna_taiwan(session: requests.Session) -> list[dict[str, Any]]:
    return _rss_articles(session, "https://feeds.feedburner.com/rsscna/politics")


def fetch_ltn_taiwan(session: requests.Session) -> list[dict[str, Any]]:
    return _rss_articles(session, "https://news.ltn.com.tw/rss/all.xml")


def fetch_der_spiegel(session: requests.Session) -> list[dict[str, Any]]:
    return _rss_articles(session, "https://www.spiegel.de/schlagzeilen/index.rss")


def fetch_vnexpress(session: requests.Session) -> list[dict[str, Any]]:
    return _rss_articles(session, "https://vnexpress.net/rss/tin-moi-nhat.rss")


# --- 커스텀 소스 dispatch table (key → (표시명, 렌더타입, fetcher)) ---
CUSTOM_SOURCES: dict[str, dict[str, Any]] = {
    "naver_ranking": {
        "name": "Naver 언론사 랭킹",
        "type": "press_groups",
        "fetcher": fetch_naver_ranking,
    },
    "daum_ranking": {
        "name": "Daum 인기 뉴스",
        "type": "articles",
        "fetcher": fetch_daum_ranking,
    },
    "yahoo_japan": {
        "name": "Yahoo! Japan 주요 뉴스",
        "type": "articles",
        "fetcher": fetch_yahoo_japan_topics,
    },
    "nhk": {
        "name": "NHK 뉴스",
        "type": "articles",
        "fetcher": fetch_nhk_news,
    },
    "nyt": {
        "name": "New York Times",
        "type": "articles",
        "fetcher": fetch_nyt_rss,
    },
    "hackernews": {
        "name": "HackerNews",
        "type": "articles",
        "fetcher": fetch_hackernews,
    },
    "bbc": {
        "name": "BBC News",
        "type": "articles",
        "fetcher": fetch_bbc_news,
    },
    "cna": {
        "name": "CNA 中央社",
        "type": "articles",
        "fetcher": fetch_cna_taiwan,
    },
    "ltn": {
        "name": "自由時報 (Liberty Times)",
        "type": "articles",
        "fetcher": fetch_ltn_taiwan,
    },
    "der_spiegel": {
        "name": "Der Spiegel",
        "type": "articles",
        "fetcher": fetch_der_spiegel,
    },
    "vnexpress": {
        "name": "VnExpress",
        "type": "articles",
        "fetcher": fetch_vnexpress,
    },
}


class TrendsClient:
    def __init__(self) -> None:
        self._session = requests.Session()

    def fetch_country(self, code: str, per_category: int = 15) -> dict[str, Any]:
        c = COUNTRIES[code]
        yt_key = os.environ.get("YOUTUBE_API_KEY", "")

        google_trends = fetch_google_trends(self._session, geo=c["geo"])
        youtube = fetch_youtube_popular(self._session, yt_key, region=c["region"], limit=25)
        google_news = fetch_google_news_all(
            self._session, c["hl"], c["gl"], c["ceid"], per_category
        )

        custom: dict[str, dict[str, Any]] = {}
        for src in c["custom_sources"]:
            spec = CUSTOM_SOURCES[src]
            items = spec["fetcher"](self._session)
            custom[src] = {
                "name": spec["name"],
                "type": spec["type"],
                "items": items,
            }

        return {
            "country_code": code,
            "country_name": c["name"],
            "flag": c["flag"],
            "google_trends": google_trends,
            "youtube_popular": youtube,
            "google_news": google_news,
            "custom": custom,
        }
