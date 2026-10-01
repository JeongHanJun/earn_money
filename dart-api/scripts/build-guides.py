"""SEO 가이드 페이지 생성 → public/guides/*.html + sitemap 갱신.
검색하는 사람(해외 퀀트·개발자)이 실제로 치는 질문에 하나씩 답하는 정적 페이지. 숫자는 2026-10-01 DB 실측값.
실행: python scripts/build-guides.py
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "guides"
BASE = "https://dart.ryanpp.com"
RAPID = "https://rapidapi.com/krdartapi/api/krdart"
HOST = "krdart.p.rapidapi.com"

CSS = """
*{box-sizing:border-box}body{margin:0;font:16px/1.65 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2430;background:#f7f8fb}
header{background:#0f1b33;color:#fff;padding:14px 20px}header a{color:#fff;text-decoration:none;font-weight:700}
main{max-width:820px;margin:0 auto;padding:28px 20px 60px}h1{font-size:30px;line-height:1.25;margin:.2em 0 .4em}
h2{font-size:22px;margin:1.8em 0 .5em}p,li{color:#2d3748}code{background:#eef1f6;padding:1px 5px;border-radius:4px;font-size:.92em}
pre{background:#0f1b33;color:#e6edf7;padding:14px 16px;border-radius:8px;overflow-x:auto;font-size:13.5px;line-height:1.5}
pre code{background:none;padding:0;color:inherit}table{border-collapse:collapse;width:100%;margin:10px 0;font-size:15px}
th,td{border-bottom:1px solid #e3e7ee;padding:7px 10px;text-align:left}th{background:#eef1f6}
.cta{display:inline-block;background:#2f5597;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:700;margin:6px 8px 6px 0}
.note{font-size:14px;color:#5a6475}nav.more a{display:block;margin:4px 0}footer{text-align:center;font-size:13px;color:#7a8394;padding:24px}
"""


def page(slug, title, desc, body, faq=None):
    ld = {"@context": "https://schema.org", "@type": "TechArticle", "headline": title, "description": desc,
          "url": f"{BASE}/guides/{slug}", "publisher": {"@type": "Organization", "name": "KRDART"}}
    blocks = [json.dumps(ld)]
    if faq:
        blocks.append(json.dumps({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}))
        body += "<h2>FAQ</h2>" + "".join(f"<h3>{html.escape(q)}</h3><p>{html.escape(a)}</p>" for q, a in faq)
    others = "".join(f'<a href="/guides/{s}">{html.escape(t)}</a>' for s, t, *_ in PAGES if s != slug)
    ldtags = "".join(f'<script type="application/ld+json">{b}</script>' for b in blocks)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)} | KRDART</title><meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{BASE}/guides/{slug}"><link rel="icon" href="/favicon.png"><style>{CSS}</style>{ldtags}</head>
<body><header><a href="/">KRDART</a> · Korea DART financials & distress API</header><main>
<h1>{html.escape(title)}</h1>{body}
<p><a class="cta" href="{RAPID}">Try the free tier on RapidAPI</a><a class="cta" style="background:#1d6f42" href="/openapi.yaml">OpenAPI spec</a></p>
<h2>More guides</h2><nav class="more">{others}</nav></main>
<footer>Data derived from DART (dart.fss.or.kr) filings. Not investment advice.</footer></body></html>"""


CURL = f"""curl -s "https://{HOST}/distress/00126380" \\
  -H "X-RapidAPI-Key: $RAPIDAPI_KEY" \\
  -H "X-RapidAPI-Host: {HOST}\""""

PY = f"""import os, requests

H = {{"X-RapidAPI-Key": os.environ["RAPIDAPI_KEY"], "X-RapidAPI-Host": "{HOST}"}}
BASE = "https://{HOST}"

# 1) find the DART corp_code by English/Korean name or ticker
co = requests.get(f"{{BASE}}/companies/search", params={{"q": "samsung electronics"}}, headers=H).json()
code = co["results"][0]["corp_code"]          # e.g. 00126380

# 2) English-labelled financial statements (annual report = 11011)
fin = requests.get(f"{{BASE}}/financials/{{code}}", params={{"year": 2024, "reprt": "11011"}}, headers=H).json()

# 3) pre-computed distress signals
print(requests.get(f"{{BASE}}/distress/{{code}}", headers=H).json())"""

SAMSUNG = """{
  "corp_code": "00126380",
  "fiscal_year": 2025,
  "report_type": "11012",
  "altman_z_em": 8.57,
  "altman_grade": "SAFE",
  "piotroski_f": 2,
  "piotroski_grade": "MID",
  "risk_events_90d": 0,
  "composite_risk": 10,
  "composite_grade": "LOW",
  "recent_events": []
}"""

PAGES = [
    ("korea-company-financials-api", "Korean company financial statements API (English JSON)",
     "Get income statements, balance sheets and cash-flow items for ~4,000 KOSPI/KOSDAQ companies as English-labelled JSON, sourced from DART filings.",
     f"""<p>Korea's official disclosure system, <b>DART</b> (run by the Financial Supervisory Service), is the Korean equivalent of SEC EDGAR.
Every listed company files its annual and quarterly reports there — but the data comes back in Korean, keyed by Korean account names,
and the XBRL account IDs are frequently blank. KRDART normalises it into English JSON so you can use it like any other fundamentals feed.</p>
<h2>What you get</h2><ul>
<li>~120,000 registered entities, ~4,000 KOSPI/KOSDAQ listed companies</li>
<li>Financial statements with English labels: FY2022–FY2024 annual reports, plus FY2025 half-year</li>
<li>Company search by English name, Korean name or ticker → DART <code>corp_code</code></li>
<li>Pre-computed distress signals and a daily risk-event stream (see the other guides)</li></ul>
<h2>Quick start (Python)</h2><pre><code>{html.escape(PY)}</code></pre>
<h2>Report codes</h2><table><tr><th><code>reprt</code></th><th>Report</th></tr>
<tr><td>11011</td><td>Annual report (사업보고서)</td></tr><tr><td>11012</td><td>Half-year report (반기보고서)</td></tr>
<tr><td>11013</td><td>Q1 report (1분기보고서) — roadmap</td></tr><tr><td>11014</td><td>Q3 report (3분기보고서) — roadmap</td></tr></table>
<p class="note">Consolidated statements (CFS) only for now. Each response carries the DART receipt number so you can always trace back to the original filing.</p>""",
     [("Is there an English API for Korean company financial statements?",
       "DART itself only returns Korean labels. KRDART maps DART filings to English-labelled JSON for about 4,000 KOSPI/KOSDAQ listed companies and exposes them through a REST API with a free tier on RapidAPI."),
      ("Which years are covered?", "Annual reports for FY2022 to FY2024 plus the FY2025 half-year report. Quarterly Q1/Q3 data is on the roadmap."),
      ("Do I need a DART (OpenDART) API key?", "No. KRDART does the DART collection; you only need a RapidAPI key.")]),

    ("opendart-api-english", "OpenDART API in English: the practical gotchas",
     "A practical English guide to Korea's OpenDART API: corp_code lookup, report codes, blank account_id in fnlttSinglAcnt, Korean account names, and how to avoid them.",
     """<p>OpenDART (<code>opendart.fss.or.kr</code>) is free and well documented — in Korean. If you are building outside Korea, these are the issues you hit first:</p>
<h2>1. You need DART's own corp_code, not the ticker</h2><p>Every endpoint takes an 8-digit <code>corp_code</code> (e.g. Samsung Electronics is <code>00126380</code>), distributed as a zipped XML of every registered entity.
You have to download and index it yourself. KRDART exposes it as <code>/companies/search?q=</code> by English name, Korean name or 6-digit ticker.</p>
<h2>2. Report codes are opaque</h2><p><code>11011</code> annual, <code>11012</code> half-year, <code>11013</code> Q1, <code>11014</code> Q3 — and the fiscal year parameter refers to the business year, not the filing date.</p>
<h2>3. account_id is often blank in fnlttSinglAcnt</h2><p>The single-company financial endpoint frequently returns an empty <code>account_id</code>, so you cannot key on IFRS taxonomy IDs alone.
In practice you have to fall back to the Korean account name (<code>account_nm</code>) — e.g. <code>매출액</code>, <code>영업이익</code>, <code>당기순이익</code> — and companies use slightly different names for the same line.</p>
<h2>4. Risk events are hidden in Korean filing titles</h2><p>Delisting risk, audit-opinion problems, going-concern doubts and capital reductions are only visible as Korean report titles in the filing list. Nothing aggregates them in English.</p>
<h2>5. Rate limits</h2><p>OpenDART allows roughly 20,000 requests per day per key, which is fine for one company but slow for full-market screening.</p>
<h2>What KRDART does instead</h2><p>Collects filings nightly, maps account names to English labels with the IFRS ID where present, pre-computes distress scores and classifies risk events —
so you make one request per company instead of dozens.</p>""",
     [("Is the OpenDART API available in English?", "The API is the same worldwide but field names, account names and documentation are Korean. KRDART provides an English-labelled layer on top."),
      ("Why is account_id empty in OpenDART fnlttSinglAcnt?", "The single-company financial statement endpoint often omits the IFRS account_id for many items, so you need to match on the Korean account name instead.")]),

    ("kospi-kosdaq-distress-scores", "Distress scores for KOSPI & KOSDAQ companies (Altman Z'' EM, Piotroski-style F)",
     "Pre-computed Altman Z''-EM and Piotroski-style F-scores for Korean listed companies, with methodology and the FY2024 distribution across ~2,750 companies.",
     f"""<p>KRDART pre-computes bankruptcy and quality signals for every listed company with enough data, so a full-market screen is one request instead of thousands.</p>
<h2>Altman Z''-Score (Emerging Markets)</h2><p><code>Z'' = 3.25 + 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4</code> where X1 = working capital / total assets, X2 = retained earnings / total assets,
X3 = operating income / total assets (EBIT proxy), X4 = book equity / total liabilities. Because of the 3.25 constant the zones are
<b>&gt; 5.85 safe</b>, <b>4.35–5.85 grey</b>, <b>&lt; 4.35 distress</b>.</p>
<h2>Piotroski-style F-score (0–5)</h2><p>The textbook F-score uses 9 signals; the DART single-account data supports 5 of them, so KRDART reports a 0–5 score
(STRONG 4–5, MID 2–3, WEAK 0–1). It is directionally useful, not the 9-point original.</p>
<h2>FY2024 distribution (annual reports)</h2><table><tr><th>Altman zone</th><th>Companies</th></tr>
<tr><td>SAFE</td><td>1,673</td></tr><tr><td>GREY</td><td>299</td></tr><tr><td>DISTRESS</td><td>672</td></tr><tr><td>N/A (insufficient data)</td><td>110</td></tr></table>
<p>The composite grade combines both scores and recent risk events: LOW 1,682 · MEDIUM 343 · HIGH 79 · CRITICAL 650.</p>
<h2>Example: Samsung Electronics (FY2025 half-year)</h2><pre><code>{html.escape(SAMSUNG)}</code></pre>
<pre><code>{html.escape(CURL)}</code></pre>
<h2>Screen the whole market</h2><pre><code>GET /screener?altman_grade=DISTRESS&amp;year=2024&amp;sort=altman_asc&amp;limit=50</code></pre>""",
     [("What Altman Z cutoffs apply to Korean companies?", "KRDART uses the Emerging Markets Z'' model with the 3.25 constant, where scores above 5.85 are safe, 4.35 to 5.85 grey, and below 4.35 distress."),
      ("How many Korean listed companies are in the Altman distress zone?", "For FY2024 annual reports, 672 of about 2,750 scored companies fall in the distress zone, 299 in the grey zone and 1,673 in the safe zone.")]),

    ("korea-risk-events", "Korean listed company risk events (delisting, audit opinion, going concern) as an API",
     "A daily English feed of risk events from DART filings for Korean listed companies: delisting risk, audit opinion issues, going-concern doubt, collateral, lawsuits, capital changes.",
     """<p>Many warning signs for Korean companies only appear as Korean filing titles on DART. KRDART classifies them every night and exposes them as an English event stream.</p>
<h2>Event types and last-90-day counts (as of 2026-10-01)</h2><table><tr><th>Type</th><th>Meaning</th><th>Events</th></tr>
<tr><td>COLLATERAL</td><td>Shares pledged / collateral provided</td><td>299</td></tr>
<tr><td>AUDIT_OPINION</td><td>Qualified, adverse or disclaimer of audit opinion</td><td>185</td></tr>
<tr><td>DELISTING_RISK</td><td>Delisting review, administrative issue designation</td><td>97</td></tr>
<tr><td>LAWSUIT</td><td>Litigation filed against the company</td><td>71</td></tr>
<tr><td>MAJOR_SHAREHOLDER</td><td>Change of largest shareholder</td><td>66</td></tr>
<tr><td>CAPITAL_INCREASE</td><td>Rights issue / third-party allotment</td><td>53</td></tr>
<tr><td>CAPITAL_REDUCTION</td><td>Capital reduction</td><td>39</td></tr>
<tr><td>CONVERTIBLE_BOND</td><td>Convertible / exchangeable bond issuance</td><td>24</td></tr>
<tr><td>GOVERNANCE</td><td>Governance events</td><td>11</td></tr>
<tr><td>GOING_CONCERN</td><td>Going-concern uncertainty</td><td>2</td></tr></table>
<h2>Get the feed</h2><pre><code>GET /events/recent?days=7&amp;type=DELISTING_RISK&amp;limit=100</code></pre>
<p class="note">Events are detected from filing titles with pattern rules, so a small number of misclassifications is possible; every event links back to its DART receipt number.</p>""",
     [("How can I track delisting risk for Korean stocks?", "KRDART classifies DART filings nightly and exposes delisting-risk, audit-opinion and going-concern events through /events/recent, filterable by type and date range.")]),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for slug, title, desc, body, faq in PAGES:
        (OUT / f"{slug}.html").write_text(page(slug, title, desc, body, faq), encoding="utf-8")
    links = "".join(f'<li><a href="/guides/{s}">{html.escape(t)}</a> — {html.escape(d)}</li>' for s, t, d, *_ in PAGES)
    idx = page.__wrapped__ if hasattr(page, "__wrapped__") else None
    (OUT / "index.html").write_text(f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Guides | KRDART — Korea DART API in English</title><meta name="description" content="Guides for using Korean company disclosure data (DART) in English: financial statements, distress scores, risk events and OpenDART gotchas.">
<link rel="canonical" href="{BASE}/guides/"><style>{CSS}</style></head><body><header><a href="/">KRDART</a> · Guides</header>
<main><h1>Korea DART data guides</h1><ul>{links}</ul></main></body></html>""", encoding="utf-8")
    urls = ["/", "/guides/"] + [f"/guides/{s}" for s, *_ in PAGES] + ["/openapi.yaml"]
    sm = "".join(f"<url><loc>{BASE}{u}</loc><changefreq>{'weekly' if u in ('/', '/guides/') else 'monthly'}</changefreq></url>" for u in urls)
    (ROOT / "public" / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sm}</urlset>\n', encoding="utf-8")
    print("pages:", len(PAGES) + 1)


if __name__ == "__main__":
    main()
