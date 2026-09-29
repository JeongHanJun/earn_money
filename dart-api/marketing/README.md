# KRDART Launch Marketing Kit

Ready-to-fire copy for the launch sequence. All copy is drafted for
**immediate execution**. RapidAPI is live, so launch does not wait for api.market.

## Execution order

```
T=0h    RapidAPI hub URL live
        → post `hn-show-hn.md` primary title
        → post the "small note" first comment 3–5 min later

T=+24h  If HN hit front-page top-30:
        → post `reddit-posts.md` § r/algotrading
        Otherwise wait 48h.

T=+48h  If r/algotrading upvoted (>20):
        → post `reddit-posts.md` § r/quant

T=+7d   → begin `linkedin-outreach.md` (3–5 messages/day, 20 total)
```

## Files

| File | Purpose |
|---|---|
| `hn-show-hn.md` | Show HN title, body, first-comment prep |
| `reddit-posts.md` | r/algotrading + r/quant text posts |
| `linkedin-outreach.md` | 20-person outreach templates (English + Korean) |

## Pre-flight checks (before firing)

- [ ] `dart.ryanpp.com` loads and stats widget shows real numbers
- [ ] `/openapi.yaml` accessible
- [ ] GitHub examples repo public and README polished
- [ ] `/health` 200, landing demo (`/distress/00126380`) 200, direct data calls 401, RapidAPI playground call 200
- [ ] Landing page mentions RapidAPI + api.market links (add once live URLs known)
- [ ] Twitter/X handle for HN sig (optional but adds trust)

## Anti-patterns to avoid

- **Don't post identical copy across channels** — HN/Reddit/LinkedIn each need a different tone
- **Don't fire more than one channel per 24h** — spreads engagement thin
- **Don't reply defensively to critical HN comments** — thank & clarify only
- **Don't DM anyone before HN post** — LinkedIn traffic that hits a "coming soon" landing dies immediately
