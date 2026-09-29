# Show HN — KRDART

**Timing**: Post within 24h of RapidAPI listing going live (which gives you a "Ships on RapidAPI" credibility signal). Best window: **Tue–Thu, 08:00 ET / 21:00 KST**.

## Title (max 80 chars — pick ONE, A/B if you post twice)

Primary:
```
Show HN: KRDART – English JSON on top of Korea's DART filings, with distress scores
```

Alternates (backups if first flops within 30 min):
```
Show HN: An English API for Korea's XBRL filings + Altman Z & Piotroski-style F
```
```
Show HN: KOSPI/KOSDAQ financials + distress signals as an API
```

## Body (paste as post body)

```
Hi HN — I built KRDART, an API that turns Korea's DART filings (FSS's EDGAR
equivalent) into clean English JSON, and adds pre-computed distress signals
on top: Altman Z''-Score (Emerging Markets) + a Piotroski-style F-Score + a
90-day risk-event stream (delisting risk, going-concern doubt, audit
qualification, capital reduction, major shareholder change).

Live: https://dart.ryanpp.com
RapidAPI: https://rapidapi.com/krdartapi/api/krdart
OpenAPI: https://dart.ryanpp.com/openapi.yaml
GitHub demo repo (Python/JS/Postman): https://github.com/krdata-api/korea-dart-api-examples

Why I built it

Every time I wanted to screen KOSPI/KOSDAQ for distress or ESG-adjacent
risk, the same three barriers hit me:

1. XBRL is in Korean, and half the taxonomy IDs are blank (fnlttSinglAcnt
   returns account_id = "" often), so you can't key on IFRS.
2. Distress scores aren't provided anywhere — you need Refinitiv/S&P or
   compute them yourself from raw filings.
3. Risk events (관리종목, 감사의견 거절, 상장폐지 우려) are buried in Korean
   filing titles. Nobody indexes them cross-market.

So it's three tables of data collapsed into one API. Response is O(1) —
distress is nightly-precomputed, not on-the-fly.

What's actually novel

- English account labels layered over IFRS taxonomy where present, Korean
  account name as fallback key (needed because DART's account_id field is
  often empty in the fnlttSinglAcnt endpoint — surprised me at first).
- The 90-day risk-event stream is derived from regex over report_nm on the
  cross-market filings feed. Not perfect, but I couldn't find another
  aggregated source in English.
- Redistribution is deliberately narrow: derived indicators + English
  summaries + event counts only. Original XBRL stays on dart.fss.or.kr —
  each response carries rcept_no so you can pull the source.

Coverage right now: ~120K registered entities, ~4,000 KOSPI/KOSDAQ listed,
~2,750 distress scores per fiscal year (FY2022–FY2024 annual, plus
FY2025 half-year), and a daily risk-event crawl.

Stack

- Cloudflare Workers (Hono) + D1 (~40 MB) + R2 for XBRL raw backup.
- Cron at 03:00 KST for the filings crawl.
- OpenDART as the upstream (20K req/day free tier, more than enough).
- OpenAPI 3.0.3 spec (RapidAPI doesn't accept 3.1 yet, learned that the
  hard way).

Pricing: Free tier (3K req/mo) on RapidAPI, then $9/$49/$199 monthly.
(An api.market listing with the same tiers is in review.)

Honest limitations I know about

- The F-score is Piotroski-style, not the textbook 9-signal version: it
  uses the 5 signals the fnlttSinglAcnt data supports and scores 0–5
  (STRONG 4–5, MID 2–3, WEAK 0–1).
- CFS (consolidated) only right now. OFS (separate) coming after v0.2 if
  people ask.
- Financials cover FY2022–FY2024 annual plus FY2025 half-year. Q1/Q3
  (11013/11014) are on the roadmap.
- Not investment advice. Please read the terms — this is derived
  indicators, not signals to trade.

Happy to answer anything about the DART/XBRL side. Roasting the pricing,
the pattern set, or the fallback-to-account_nm hack is very welcome.
```

## Comment prep (post 3–5 min after main post)

If low engagement:
```
Small note — the fnlttSinglAcnt endpoint returns blank account_id for ~30%
of items, which I only discovered after mapping was already built on
account_id as PK. Ended up using account_nm as the fallback. Cost me half
a day. Sharing in case it saves someone else.
```

If distress method challenged:
```
Fair — Altman Z (EM) is the 2005 revision by Altman himself, aimed at
non-US markets where market data is less reliable. Formula:
3.25 + 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4. No X5 (sales/assets)
because it varies too much cross-industry. Because of the 3.25
constant the zones are >5.85 safe, 4.35–5.85 grey, <4.35 distress.
Details in the /distress endpoint description.
```

## What to reply to & what to ignore

- **Reply to**: pricing critiques, coverage gaps, feature requests, XBRL
  taxonomy questions, comparisons with S&P/Refinitiv
- **Skim only**: "why not use the free DART?" (answer: encoding, XBRL,
  distress compute — already in body)
- **Ignore**: "not investment advice" concern trolling — footer already
  says it

## After 24h

Track: upvotes, ranking, referrer traffic (Cloudflare Analytics).
If it hits front page top-30 → immediate Reddit follow-up same evening.
If flops (< 20 upvotes) → wait 48h before Reddit to avoid burnout.
