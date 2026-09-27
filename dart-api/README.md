# dart-api

Korean corporate financial + distress signal API. Sold on RapidAPI, api.market, and dart.ryanpp.com.

## Endpoints (planned)

- `GET /companies/:corp_code` — master record (Korean/English name, stock code, market)
- `GET /companies/search?q=...` — search by name or ticker
- `GET /financials/:corp_code?year=2024&reprt=11011` — financial statements (English labels)
- `GET /distress/:corp_code` — Altman Z (EM) + Piotroski F + 90-day risk event count
- `GET /events/recent?days=7&type=DELISTING_RISK` — recent risky filings across all companies

## Local setup

```bash
npm install
# .env is auto-loaded by scripts (--env-file=.env)

# 1) Create D1 DB (once, from Cloudflare dashboard OR CLI)
npx wrangler d1 create dart-db
# → paste returned database_id into wrangler.jsonc

# 2) Apply migrations
npm run d1:apply:local

# 3) Probe DART API (verify key & rate limit)
npm run probe

# 4) Bootstrap corp_codes (~100K rows, 3.6MB zip)
npm run bootstrap:corp

# 5) Local dev server
npm run dev
```

## Deploy

```bash
# Set secrets
npx wrangler secret put OPENDART_KEY
npx wrangler secret put ADMIN_SECRET

# Deploy
npm run deploy

# Apply remote migrations
npm run d1:apply:remote

# Bootstrap remote corp_codes
npm run bootstrap:corp:remote
```

## Sales principle

**No raw redistribution.** Only computed indicators, events, and English-normalized summaries are exposed.
DART terms allow republishing under gray zone; we stay safe by:
- exposing only Altman Z / Piotroski F / risk event counts (not raw DART XML)
- referencing DART rcept_no as the source of each event
- link-out to `dart.fss.or.kr` for original text
