# TOKEN_LEDGER.md — OpenAI Call Site Inventory

**Last Updated:** 2025-12-23
**Prompt Version Tracked:** v2 (most routes)

---

## Overview

This document inventories all OpenAI API call sites in the Solara codebase. Each call site is instrumented with `logTokenAudit()` to emit structured JSON logs for cost analysis.

**Log Format:**
```
[TOKEN_AUDIT] {"route":"/api/insights","feature":"Sanctuary • Insight","model":"gpt-4o-mini","cache":"miss","pv":2,"in":1234,"out":456,"total":1690,"lang":"en","tf":"today"}
```

**How to extract logs:**
```bash
grep '\[TOKEN_AUDIT\]' logs.txt | sed 's/.*\[TOKEN_AUDIT\] //' > raw_audit.json
jq -s '[.[] | select(.cache == "miss")] | {total_in: (map(.in) | add), total_out: (map(.out) | add)}' raw_audit.json
```

---

## OpenAI Call Site Inventory

| # | Route / File | Feature Label | Model Key | Line | Cache TTL | Notes |
|---|--------------|---------------|-----------|------|-----------|-------|
| 1 | `/api/insights` | Sanctuary • Insight | `insights` (gpt-4o-mini / gpt-5.1) | 537 | 48h Redis | Daily/weekly/monthly insights |
| 2 | `/api/birth-chart` (narrative) | Soul Print • Narrative | `insights` | 864 | Permanent (DB) | One-time generation per user |
| 3 | `/api/birth-chart` (tabs) | Soul Print • Tab Deep Dives | `insights` | 319 | Permanent (DB) | 8 tabs generated in batch |
| 4 | `/api/connection-brief` | Connections • Daily Brief | `insights` | 327 | 24h (DB) | Light daily "weather report" |
| 5 | `/api/connection-insight` | Connections • Insight | `insights` | 360 | 24h Redis | Deprecated - use brief/space-between |
| 6 | `/api/connection-space-between` | Connections • Space Between | `deep` (gpt-4o) | 451 | Permanent (DB) | Stone tablet - never regenerates |
| 7 | `/api/public-horoscope` | Home • Public Horoscope | `horoscope` (gpt-4o-mini / gpt-5.1) | 193 | 24h Redis | Anonymous, per-sign |
| 8 | `/api/public-tarot` | Home • Public Tarot | `horoscope` | 220 | 60s idempotency | Anonymous, may retry up to 3x |
| 9 | `/api/public-compatibility` | Home • Public Compatibility | `horoscope` | 299 | Permanent (DB) | 144 sign pairs, stone tablet |
| 10 | `/api/cron/prewarm-insights` | Sanctuary • Daily Light (Prewarm) | `insights` | 267 | 48h Redis | Cron job, pre-warms cache |
| 11 | `lib/social/summarize.ts` | Social • Summary | `fast` (gpt-4o-mini) | 136 | Permanent (DB) | Called from social sync |

---

## Model Configuration

From `lib/openai/client.ts`:

```typescript
export const OPENAI_MODELS = {
  horoscope: process.env.OPENAI_HOROSCOPE_MODEL || "gpt-4o-mini",
  insights: process.env.OPENAI_INSIGHTS_MODEL || "gpt-4o-mini",
  placements: process.env.OPENAI_PLACEMENTS_MODEL || "gpt-5.1",
  deep: process.env.OPENAI_DEEP_MODEL || "gpt-4o",
  fast: process.env.OPENAI_FAST_MODEL || "gpt-4o-mini",
} as const;
```

**Current Environment Overrides (if set):**
- `OPENAI_HOROSCOPE_MODEL`: gpt-5.1 (if env set)
- `OPENAI_INSIGHTS_MODEL`: gpt-5.1 (if env set)

---

## Estimated Token Usage Per Feature

| Feature | Typical Input | Typical Output | Est. Total | Frequency |
|---------|---------------|----------------|------------|-----------|
| Sanctuary Insight (daily) | ~800 | ~600 | ~1,400 | 1/day per user |
| Sanctuary Insight (weekly) | ~900 | ~800 | ~1,700 | 1/week per user |
| Sanctuary Insight (monthly) | ~1,000 | ~1,000 | ~2,000 | 1/month per user |
| Soul Print Narrative | ~2,500 | ~3,000 | ~5,500 | 1x per user (permanent) |
| Soul Print Tab Deep Dives | ~2,000 | ~4,000 | ~6,000 | 1x per user (permanent) |
| Connection Brief | ~600 | ~400 | ~1,000 | 1/day per connection |
| Space Between | ~2,000 | ~2,500 | ~4,500 | 1x per connection (permanent) |
| Public Horoscope | ~400 | ~350 | ~750 | 1/day per sign (36 total) |
| Public Tarot | ~500 | ~600 | ~1,100 | Per draw (rate limited) |
| Public Compatibility | ~600 | ~1,200 | ~1,800 | 1x per pair (144 total) |
| Social Summary | ~1,500 | ~500 | ~2,000 | Per social sync |

---

## Cache Behavior

### Cache Hit = 0 Tokens
When cache returns valid data, no OpenAI call is made. The `logTokenAudit` function is NOT called on cache hits (by design - we only log actual API calls).

### Cache Miss = Full Token Count
When cache is empty or expired, OpenAI is called and `logTokenAudit` records:
- `cache: "miss"`
- Actual `prompt_tokens` and `completion_tokens` from OpenAI response

---

## Token Audit Helper

Located at `lib/ai/tokenAudit.ts`:

```typescript
// Only logs when TOKEN_AUDIT_ENABLED=true or NODE_ENV=development
logTokenAudit({
  route: "/api/insights",
  featureLabel: "Sanctuary • Insight",
  model: OPENAI_MODELS.insights,
  cacheStatus: "miss",
  promptVersion: PROMPT_VERSION,
  inputTokens: completion.usage?.prompt_tokens || 0,
  outputTokens: completion.usage?.completion_tokens || 0,
  language: "en",
  timeframe: "today",
});
```

---

## Enabling Token Audit Logging

**Development:** Logs automatically in `NODE_ENV=development`

**Production:** Set environment variable:
```
TOKEN_AUDIT_ENABLED=true
```

---

## Files Modified for Token Audit

1. `lib/ai/tokenAudit.ts` — Created helper
2. `app/api/insights/route.ts` — Added logTokenAudit
3. `app/api/birth-chart/route.ts` — Added logTokenAudit (2 calls)
4. `app/api/connection-brief/route.ts` — Added logTokenAudit
5. `app/api/connection-insight/route.ts` — Added logTokenAudit
6. `app/api/connection-space-between/route.ts` — Added logTokenAudit
7. `app/api/public-horoscope/route.ts` — Added logTokenAudit
8. `app/api/public-tarot/route.ts` — Added logTokenAudit
9. `app/api/public-compatibility/route.ts` — Added logTokenAudit
10. `app/api/cron/prewarm-insights/route.ts` — Added logTokenAudit
11. `lib/social/summarize.ts` — Added logTokenAudit

---

## Cost Analysis (Per 1M Tokens)

| Model | Input Cost | Output Cost |
|-------|------------|-------------|
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4o | $2.50 | $10.00 |
| gpt-5.1 | $2.00 | $8.00 |

**Note:** Check OpenAI pricing page for current rates.

---

## Next Steps

1. Enable `TOKEN_AUDIT_ENABLED=true` in production
2. Collect 24-48 hours of logs
3. Analyze with jq or import to spreadsheet
4. Calculate actual cost per user per day
5. Tune prompt versions or models based on findings
