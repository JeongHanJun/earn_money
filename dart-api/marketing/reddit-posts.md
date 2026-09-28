# Reddit Posts — KRDART

**Timing**: 24–48h *after* Show HN. Reddit dislikes cross-posted flavor
if it's identical to HN — keep the tone different (less "polished
Show HN", more "hey I built this").

---

## r/algotrading — post 1

**Post type**: Text (self post). Subs allow tool posts if you contribute
value. Do NOT ask for feedback in title — Reddit flags that as low
effort.

### Title (max 300 chars — keep short)

```
Built an API that turns Korea's DART filings into English JSON + distress scores (Altman Z EM + Piotroski F)
```

### Body

```
Was screening KOSPI/KOSDAQ for a personal portfolio and hit the same 3
walls every quant hits with Korean data:

1. DART (Korea's EDGAR) returns XBRL with Korean labels. The IFRS
   taxonomy IDs are there in theory but ~30% come back blank from the
   summary endpoint.
2. Distress scores (Altman Z, Piotroski F) aren't published — you need
   Refinitiv or you compute them from raw XBRL.
3. Risk events (going-concern doubt, delisting risk, audit qualification,
   capital reduction) exist as Korean text buried in filing titles.

Built an API around solving those 3 problems. Live at dart.ryanpp.com
(also on RapidAPI: rapidapi.com/krdartapi/api/krdart), free tier is
3K/mo which is enough for backtests on the KOSPI200 name list.

What it does
- /companies/search?q= — search by Korean name, English name, or ticker
- /financials/{corp_code}?year=2024 — BS/IS/CF with English labels
- /distress/{corp_code} — Altman Z EM + Piotroski F + composite risk
- /events/recent?days=30&type=DELISTING_RISK — cross-market event stream

Coverage: 4,000 KOSPI/KOSDAQ, 120K registered entities, 3 fiscal years
back (2022–2024). Distress precomputed nightly (O(1) response).

Quant use cases I actually care about
- Weekly rebalance screen: pull /events/recent and drop names where
  DELISTING_RISK or GOING_CONCERN fired in the last 30d
- Cross-listed pair trading: Samsung 005930.KS vs SSNLF (ADR) — pull
  fundamentals same-day
- Distress alpha: bottom-quintile Altman Z historically underperforms
  top-quintile by 3-4% annualized on KOSPI (my rough backtest, not a
  published paper — YMMV)

Not investment advice, obviously. Underlying source is Korea's FSS —
each response carries rcept_no so you can trace back to the raw filing
on dart.fss.or.kr.

Roast the pattern set, the pricing, the F-score subset (I only use 5 of
9 signals because the summary endpoint doesn't expose the rest — mea
culpa).
```

### Best flair
`Strategy` or `Data` (whichever your account can post to)

### Rules to watch
- r/algotrading bans "product spam" — you MUST engage in comments and
  explain the tech. Don't just drop a link and leave.
- No affiliate or paid links in top comment. Only free tier + link is
  fine.

---

## r/quant — post 2 (later, only if r/algotrading worked)

r/quant is stricter about self-promo. Only post if r/algotrading gave you
positive signal (upvoted, decent comments). Otherwise skip.

### Title

```
Korean market data API with pre-computed Altman Z (EM) and Piotroski F — feedback wanted on the composite risk formula
```

### Body

```
Working on a Korean market data API (KRDART, dart.ryanpp.com) that
publishes pre-computed distress scores per company. Composite risk is
0–100 blending three signals, and I'd appreciate a sanity check from
folks who've done this in production:

Current formula:
  composite = altman_component + piotroski_component
  altman: SAFE=0, GREY=30, DISTRESS=70, N/A=15
  piotroski: STRONG=0, MID=10, WEAK=20, N/A=10

Then thresholds → LOW (<25) / MEDIUM (<50) / HIGH (<75) / CRITICAL.

What I want to swap in but haven't:
- Merton distance-to-default (need daily equity vol → external data)
- 90-day risk-event count as a hard multiplier (currently additive with
  weight 0)
- z-score residual vs sector median rather than absolute thresholds

Anyone using EM Altman in production have views on whether the 2005
calibration (3.25 constant, SAFE > 5.85 / DISTRESS < 4.35) still holds
for post-COVID Korea? I haven't done the empirical work on Korean
small-caps yet.

Sample: /distress/00126380 (Samsung) → Z=8.57 SAFE, F=2/5 MID,
composite=10 LOW. Bottom-quintile mostly small-cap KOSDAQ names.

Free tier is 3K/mo if you want to poke at it, no credit card. Just
looking for methodology critique — trade secrets welcome.
```

Deliberately weaker sell here, stronger methodological ask. r/quant
respects "I built X, help me make it correct" more than "check out my
launch".

---

## r/koreanfinance / r/investing_kr — post 3 (Korean audience)

Only if you have appetite for Korean-language response. English post +
Korean comment reply strategy works fine.

Not writing this one now — the English quant audience is 10x bigger
and more likely to pay. Save for post-Show-HN if you want to broaden.

---

## Do NOT post to
- r/personalfinance, r/stocks — off-topic, will downvote
- r/programming — HN already covers this audience
- r/webdev — this isn't a webdev story
- r/entrepreneur — meta-launches ("I launched an API!") get downvoted
  unless you have real revenue

## Timing rules
- Weekday 08:00–10:00 ET for r/algotrading (US morning, quants online)
- Never Sundays
- 24h between subreddit posts to avoid the auto-throttle
