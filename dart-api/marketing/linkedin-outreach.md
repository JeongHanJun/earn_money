# LinkedIn Outreach — Korea Sell-Side Analysts

**Timing**: 1 week after HN + Reddit posts. By then you have social
proof (Show HN thread, GitHub stars, RapidAPI listing) that survives a
click-through check.

**Target list**: 20 people. Quality over quantity. Send 3–5/day, not
20 at once (LinkedIn flags bulk outreach).

## Who to target (in this order)

1. **Sell-side equity analysts** at Korean brokerages (Samsung, Mirae,
   NH Investment, Kiwoom, Hana, Shinhan Investment) covering
   small/mid-caps or ESG/distress. They screen names daily and their
   pain is real.
2. **Fixed-income / credit analysts** at Korean asset managers
   (Mirae Asset, Samsung Asset, Hanwha, KIC). They care about
   distress signals for corporate bond pricing.
3. **Quant researchers** at hedge funds with Korea allocation (Point72
   Asia, Segantii, Millennium APAC, Balyasny APAC). Long tail — most
   won't reply but even 1 hit at these firms is worth all the effort.
4. **Fintech/compliance SaaS builders** doing cross-border KYC/AML in
   Korea. They need entity lookup + distress signals for periodic
   reviews.

## LinkedIn search filters

- Job title: "equity analyst" OR "credit analyst" OR "quant researcher"
- Location: South Korea + Hong Kong + Singapore
- Industry: Financial Services, Investment Management, Investment
  Banking
- Company: 2nd-degree connections only (LinkedIn shows better response
  rate)
- Language: Korean OR English on profile

Skip: recruiters, sales, HR, C-level (won't reply, won't be the buyer).

## Message templates

### V1 — English, quant/researcher (default)

Subject: (LinkedIn DMs don't have subjects — use first line as hook)

```
Hi {firstName},

I noticed you cover {Korean small-caps / ESG / distress / whatever
their public posts show}. I built a small API on top of Korea's DART
filings that might save you some of the XBRL wrestle:

• English-labeled financials for 4,000 KOSPI/KOSDAQ names
• Pre-computed Altman Z (EM) and Piotroski F, refreshed nightly
• Cross-market risk-event stream (delisting risk, going-concern,
  audit qualifications) — the one I couldn't find aggregated anywhere

Free tier is 3K/mo, no card needed. dart.ryanpp.com
(or via RapidAPI: rapidapi.com/krdartapi/api/krdart)

Not selling anything — I'd genuinely like your view on the composite
risk formula and what's missing for sell-side workflows. 10 min this
week?

— {yourName}
```

### V2 — Korean, brokerage/asset manager

```
{firstName}님, 안녕하세요.

DART 공시에서 재무제표·상장폐지 위험·감사의견 같은 신호를 매번 손으로
추출하는 게 불편해서, 이걸 영문 JSON API로 만들었습니다.

• KOSPI/KOSDAQ 4,000社 재무제표 (영문 라벨 매핑)
• Altman Z (EM) + Piotroski F 사전계산 (매일 갱신)
• 90일 위험 공시 스트림 (관리종목, 감사의견 거절, 감자 등)

dart.ryanpp.com — 3,000 req/mo 무료 티어라 카드 없이 바로 테스트 가능
합니다.

혹시 sell-side 워크플로우 관점에서 뭐가 빠졌는지 짧게 (10분) 피드백
받을 수 있을까요? 판매보다는 방향성 정하려는 목적입니다.

감사합니다.
{yourName} 드림
```

### V3 — Fintech/compliance builder

```
Hi {firstName},

I saw your work on {their published fintech/compliance thing}. Curious
if you'd find value in an API for Korean corporate lookup + distress
signals:

• 120K registered entities, DART master lookup by name/ticker
• Nightly Altman Z + Piotroski F for KOSPI/KOSDAQ
• 90-day risk-event feed (going-concern, delisting risk, etc.) —
  useful for periodic review triggers

Free tier: 3K/mo, dart.ryanpp.com. Would 15 min next week to
understand what compliance workflows need be too much to ask?

— {yourName}
```

## Rules

- **No follow-ups if silent.** One message, done. Follow-up spam kills
  future response rate.
- **Reply within 1h if they respond**. Fast reply signals you're a real
  human not a bot.
- **If they say "not interested"**, thank them, close the loop. Never
  argue.
- **Don't attach the OpenAPI or a deck**. Link only. Attachments look
  like sales pitch.
- **Track**: opens, replies, meetings scheduled. LinkedIn Sales Nav
  (if you have it) does this natively; otherwise a Google Sheet.

## What to say on the call

If they take the meeting, DO NOT pitch. Ask:

1. "What's the workflow you actually do today?" (understand pain)
2. "What data source would you swap out first if given a magic wand?"
   (find where you fit)
3. "What's your data budget authority?" (are they a buyer or referrer?)
4. "Who else on your team hits the same problem?" (referral network)

You want #3 and #4. Pitching KRDART features is #5 priority — they
already know the features from your DM.

## Follow-up email (if they gave email)

Send within 2h of call. Include:
- 1-paragraph recap of what they said
- 1-paragraph of how KRDART solves it (specific to their workflow)
- Signup link with a 1-month Pro trial code (create manually in Stripe
  or note it internally)

Never ask for a decision in the follow-up. Just make it easy for them
to say yes later.

## Target list (fill in as you research)

```
1. Name / firm / role / LinkedIn URL / language / sent date / reply date / status
2.
3.
...
20.
```

Track this offline (Google Sheet or Notion). Don't put personal data
in a git repo — LinkedIn ToS + Korean PIPA both frown on it.
