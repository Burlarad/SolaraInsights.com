# OpenAI Call Origin + Cost Map — AUDIT ONLY

**Date:** 2025-12-23
**Author:** Claude (Audit Only)
**Scope:** Complete inventory of all OpenAI API calls, triggers, caching behavior, and cost analysis

---

## 1. Call Site Inventory (Master List)

### OpenAI Call Sites — Complete Table

| # | Route / Job | File Path | Line Range | Function | Model ID | Prompt Inputs | Trigger |
|---|-------------|-----------|------------|----------|----------|---------------|---------|
| 1 | `/api/insights` | `app/api/insights/route.ts` | 526-534 | `POST()` | `OPENAI_MODELS.insights` | Profile (birth_date, birth_time, birth_city, timezone, zodiac_sign), Social summaries (if enabled), Tarot card list, Rune list | User opens Sanctuary page, switches timeframe |
| 2 | `/api/birth-chart` (narrative) | `app/api/birth-chart/route.ts` | 864-875 | `POST()` | `OPENAI_MODELS.insights` | Full SwissPlacements (planets, houses, aspects, patterns), Profile name, Language | User opens Soul Path page |
| 3 | `/api/birth-chart` (tab deep dives) | `app/api/birth-chart/route.ts` | 320-328 | `generateAllTabDeepDives()` | `OPENAI_MODELS.insights` | SwissPlacements context (planets summary, houses summary, aspects summary, patterns) | User opens Soul Path page (same request as narrative) |
| 4 | `/api/connection-brief` | `app/api/connection-brief/route.ts` | 328-339 | `POST()` | `OPENAI_MODELS.insights` | Profile, Connection birth data, Social metadata, Local date | Connection card scrolls into view (IntersectionObserver) |
| 5 | `/api/connection-insight` | `app/api/connection-insight/route.ts` | 361-372 | `POST()` | `OPENAI_MODELS.insights` | Profile, Connection, Social summaries, Timeframe | User clicks "View Insight" on connection (deprecated) |
| 6 | `/api/connection-space-between` | `app/api/connection-space-between/route.ts` | 452-459 | `POST()` | `OPENAI_MODELS.deep` (gpt-4o) | Profile (both users), Connection birth data, Social summaries (both users) | User clicks "Space Between" on unlocked connection |
| 7 | `/api/public-horoscope` | `app/api/public-horoscope/route.ts` | 194-202 | `POST()` | `OPENAI_MODELS.horoscope` | Sign, Timeframe, Current date | Anonymous user selects sign on homepage |
| 8 | `/api/public-tarot` | `app/api/public-tarot/route.ts` | 221-228 | `POST()` (retry loop) | `OPENAI_MODELS.horoscope` | Question, Spread type, 78-card list, User context (if provided) | Anonymous user draws tarot on homepage |
| 9 | `/api/public-compatibility` | `app/api/public-compatibility/route.ts` | 300-308 | `POST()` | `OPENAI_MODELS.horoscope` | Sign A, Sign B (normalized to alphabetical order) | Anonymous user selects sign pair on homepage |
| 10 | `/api/cron/prewarm-insights` | `app/api/cron/prewarm-insights/route.ts` | 268-276 | `GET()` | `OPENAI_MODELS.insights` | Same as /api/insights (profile, social, tarot, runes) | Cron job every 30 minutes |
| 11 | `lib/social/summarize.ts` | `lib/social/summarize.ts` | 137-145 | `generateSocialSummary()` | `OPENAI_MODELS.fast` (gpt-4o-mini) | User-pasted social content (up to 50k chars) | User connects social provider |

### Cache Behavior — Detailed Analysis

| # | Route | Cache Key Dimensions | Cache Store | TTL | Cache Hit Bypasses Rate Limit? |
|---|-------|---------------------|-------------|-----|-------------------------------|
| 1 | `/api/insights` | `insight:v1:p{V}:{userId}:{period}:{periodKey}:{lang}` | Redis | 48h-400d (varies by timeframe) | **YES** |
| 2 | `/api/birth-chart` (narrative) | `soul_paths.soul_path_narrative_json` + hash/version matching | Supabase DB | Permanent (until birth data changes) | **YES** |
| 3 | `/api/birth-chart` (tabs) | `soul_paths.tab_deep_dives_json` + hash/version matching | Supabase DB | Permanent (until birth data changes) | **YES** |
| 4 | `/api/connection-brief` | `daily_briefs` table: `{connection_id, local_date, language, prompt_version}` | Supabase DB | Permanent (1 per day) | **YES** |
| 5 | `/api/connection-insight` | `connectionInsight:v1:p{V}:{userId}:{connId}:{timeframe}:{periodKey}:{lang}` | Redis | 24h | **YES** |
| 6 | `/api/connection-space-between` | `space_between_reports` table: `{connection_id, language, prompt_version}` | Supabase DB | **PERMANENT** (stone tablet) | **YES** |
| 7 | `/api/public-horoscope` | `publicHoroscope:v1:p{V}:{sign}:{timeframe}:{periodKey}:{lang}` | Redis | 24h | **YES** |
| 8 | `/api/public-tarot` | `tarot:idempotency:{requestId}:{lang}` | Redis | 60s (idempotency only) | **YES** |
| 9 | `/api/public-compatibility` | `public_compatibility` table: `{pair_key}` | Supabase DB | **PERMANENT** (stone tablet, 144 pairs total) | **YES** |
| 10 | `/api/cron/prewarm-insights` | Same as /api/insights | Redis | 48h | N/A (cron job) |
| 11 | `lib/social/summarize.ts` | `social_summaries` table: `{user_id, provider}` | Supabase DB | **PERMANENT** (until re-sync) | N/A (called internally) |

### Rate Limit + Cooldown Behavior

| # | Route | Rate Limit | Window | Cooldown | Burst Limit | Burst Window |
|---|-------|------------|--------|----------|-------------|--------------|
| 1 | `/api/insights` | 60/hour | 1 hour | 5s | 20 req | 10s |
| 2 | `/api/birth-chart` | 20/hour | 1 hour | 10s | 10 req | 10s |
| 3 | `/api/birth-chart` (tabs) | Same request as narrative | — | — | — | — |
| 4 | `/api/connection-brief` | 120/hour | 1 hour | 2s | 30 req | 10s |
| 5 | `/api/connection-insight` | 20/day | 24 hours | 10s | 20 req | 10s |
| 6 | `/api/connection-space-between` | 10/day | 24 hours | 20s | 20 req | 10s |
| 7 | `/api/public-horoscope` | 60/hour | 1 hour | None | 10 req | 10s |
| 8 | `/api/public-tarot` | Custom (tarotRateLimit) | Per session | 10s | 10 req | 10s |
| 9 | `/api/public-compatibility` | 60/hour | 1 hour | 5s | 10 req | 10s |
| 10 | `/api/cron/prewarm-insights` | N/A | N/A | N/A | N/A | N/A |
| 11 | `lib/social/summarize.ts` | N/A (internal) | N/A | N/A | N/A | N/A |

### Classification

| # | Route | Classification |
|---|-------|----------------|
| 1 | `/api/insights` | **Daily** (per timeframe) |
| 2 | `/api/birth-chart` (narrative) | **One-time** (permanent) |
| 3 | `/api/birth-chart` (tabs) | **One-time** (permanent) |
| 4 | `/api/connection-brief` | **Daily** (per connection) |
| 5 | `/api/connection-insight` | **Daily** (deprecated) |
| 6 | `/api/connection-space-between` | **One-time** (permanent stone tablet) |
| 7 | `/api/public-horoscope` | **Daily** (per sign, shared across all users) |
| 8 | `/api/public-tarot` | **On-demand** (rate limited) |
| 9 | `/api/public-compatibility` | **One-time** (stone tablet, 144 pairs total for life) |
| 10 | `/api/cron/prewarm-insights` | **Daily** (automated) |
| 11 | `lib/social/summarize.ts` | **On social connect** |

---

## 2. "Normal User" Load Map

### Model Pricing Reference (from `lib/ai/pricing.ts`)

| Model | Input (per 1M) | Output (per 1M) |
|-------|---------------|-----------------|
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4.1-mini | $0.40 | $1.60 |
| gpt-5.1 | $1.25 | $10.00 |
| gpt-4o (deep) | Not in pricing.ts | ~$2.50 / $10.00 (inference) |

**Note:** `lib/ai/pricing.ts` is missing `gpt-4o` used by `OPENAI_MODELS.deep`. This is a gap.

### Persona Analysis

#### Light User (checks Sanctuary once/day, no connections, no social)

| Action | Endpoint | Cache Status | Model | Est. Tokens (in/out) | Est. Cost |
|--------|----------|--------------|-------|---------------------|-----------|
| First visit to Sanctuary | `/api/insights` | MISS | insights | ~800/600 | ~$0.0005 |
| Return visit same day | `/api/insights` | **HIT** | — | 0/0 | $0.00 |
| First Soul Path visit | `/api/birth-chart` | MISS | insights (x2 calls) | ~4500/7000 | ~$0.005 |
| Return Soul Path visit | `/api/birth-chart` | **HIT** | — | 0/0 | $0.00 |

**Light User 24h Total (first day):** ~$0.006
**Light User 24h Total (after first day):** ~$0.0005 (only daily insight if new period)

#### Typical User (Sanctuary today+year, 3-5 connections, checks connections once)

| Action | Endpoint | Cache Status | Model | Est. Tokens (in/out) | Est. Cost |
|--------|----------|--------------|-------|---------------------|-----------|
| Sanctuary "today" | `/api/insights` | MISS (first time) | insights | ~800/600 | ~$0.0005 |
| Sanctuary "year" | `/api/insights` | MISS (first time) | insights | ~1000/1000 | ~$0.0008 |
| Soul Path (one-time) | `/api/birth-chart` | MISS | insights (x2) | ~4500/7000 | ~$0.005 |
| Connection briefs (5 cards visible) | `/api/connection-brief` | MISS x5 | insights | ~3000/2000 | ~$0.0015 |
| Space Between (1 unlocked) | `/api/connection-space-between` | MISS (stone tablet) | **deep (gpt-4o)** | ~2000/2500 | **~$0.03** |

**Typical User 24h Total (first day):** ~$0.04
**Typical User 24h Total (after setup):** ~$0.002-$0.003 (daily insight + briefs)

#### Heavy User (toggles timeframes, refreshes, opens all connections)

| Action | Endpoint | Cache Status | Model | Est. Tokens (in/out) | Est. Cost |
|--------|----------|--------------|-------|---------------------|-----------|
| Sanctuary today → year → today | `/api/insights` | MISS x2 (cache between) | insights | ~1800/1600 | ~$0.001 |
| Soul Path refresh (same data) | `/api/birth-chart` | **HIT** | — | 0/0 | $0.00 |
| Connection briefs (10 connections) | `/api/connection-brief` | MISS x10 | insights | ~6000/4000 | ~$0.003 |
| Space Between (3 unlocked) | `/api/connection-space-between` | MISS x3 (stone tablets) | **deep** | ~6000/7500 | **~$0.09** |
| Multiple tarot draws (homepage) | `/api/public-tarot` | MISS x3 | horoscope | ~1500/1800 | ~$0.001 |

**Heavy User 24h Total (first day):** ~$0.10
**Heavy User 24h Total (after setup):** ~$0.005 (mostly cache hits)

### Unexpected Calls Analysis

| Pattern | Endpoint | Cause | Risk Level |
|---------|----------|-------|------------|
| **IntersectionObserver parallel loads** | `/api/connection-brief` | All visible connection cards trigger generation simultaneously | MEDIUM - mitigated by 2s cooldown |
| **Prewarm cron job** | `/api/cron/prewarm-insights` | Runs every 30 minutes for users within 3h of midnight | LOW - budget-controlled |
| **useEffect on timeframe change** | `/api/insights` | Triggers on every timeframe toggle | LOW - cache key includes timeframe |
| **Soul Path dual call** | `/api/birth-chart` | Single request triggers 2 OpenAI calls (narrative + tabs) | LOW - one-time |
| **Tarot retry loop** | `/api/public-tarot` | May call OpenAI up to 3x if card validation fails | MEDIUM - tokens accumulate |

---

## 3. Token Audit Alignment

### Correlation: Call Sites → `ai_usage_events` Table

| Call Site | `feature_label` in ai_usage_events | `route` column | Match? |
|-----------|-----------------------------------|----------------|--------|
| `/api/insights` | "Sanctuary • Daily Light" | "/api/insights" | **YES** |
| `/api/birth-chart` (narrative) | "Soul Print • Narrative" | "/api/birth-chart" | **YES** |
| `/api/birth-chart` (tabs) | "Soul Print • Tab Deep Dives" | "/api/birth-chart" | **YES** |
| `/api/connection-brief` | "Connections • Daily Brief" | "/api/connection-brief" | **YES** |
| `/api/connection-insight` | "Connections • Insight" | "/api/connection-insight" | **YES** |
| `/api/connection-space-between` | "Connections • Space Between" | "/api/connection-space-between" | **YES** |
| `/api/public-horoscope` | "Home • Public Horoscope" | "/api/public-horoscope" | **YES** |
| `/api/public-tarot` | "Home • Public Tarot" | "/api/public-tarot" | **YES** |
| `/api/public-compatibility` | "Home • Public Compatibility" | "/api/public-compatibility" | **YES** |
| `/api/cron/prewarm-insights` | "Sanctuary • Daily Light (Prewarm)" | "/api/cron/prewarm-insights" | **YES** |
| `lib/social/summarize.ts` | **NOT TRACKED** | — | **NO** |

**Gap Found:** `lib/social/summarize.ts` has `logTokenAudit()` but no `trackAiUsage()` call. Social summaries are not tracked in `ai_usage_events`.

### Duplicate Model Usage Analysis

| Endpoint | Expected Model | Actual Model (Code) | Environment Override? |
|----------|----------------|--------------------|-----------------------|
| `/api/insights` | gpt-4o-mini | `OPENAI_MODELS.insights` | YES - `OPENAI_INSIGHTS_MODEL` |
| `/api/birth-chart` | gpt-4o-mini | `OPENAI_MODELS.insights` | YES - `OPENAI_INSIGHTS_MODEL` |
| `/api/connection-brief` | gpt-4o-mini | `OPENAI_MODELS.insights` | YES - `OPENAI_INSIGHTS_MODEL` |
| `/api/connection-insight` | gpt-4o-mini | `OPENAI_MODELS.insights` | YES - `OPENAI_INSIGHTS_MODEL` |
| `/api/connection-space-between` | **gpt-4o** | `OPENAI_MODELS.deep` | YES - `OPENAI_DEEP_MODEL` |
| `/api/public-horoscope` | gpt-4o-mini | `OPENAI_MODELS.horoscope` | YES - `OPENAI_HOROSCOPE_MODEL` |
| `/api/public-tarot` | gpt-4o-mini | `OPENAI_MODELS.horoscope` | YES - `OPENAI_HOROSCOPE_MODEL` |
| `/api/public-compatibility` | gpt-4o-mini | `OPENAI_MODELS.horoscope` | YES - `OPENAI_HOROSCOPE_MODEL` |
| `/api/cron/prewarm-insights` | gpt-4o-mini | `OPENAI_MODELS.insights` | YES - `OPENAI_INSIGHTS_MODEL` |
| `lib/social/summarize.ts` | gpt-4o-mini | `OPENAI_MODELS.fast` | YES - `OPENAI_FAST_MODEL` |

**Inference:** If env `OPENAI_INSIGHTS_MODEL=gpt-5.1` is set (per .env.example comments), multiple endpoints could be using expensive gpt-5.1 for non-permanent content.

### gpt-5.1 Usage Analysis (if env override is set)

| Endpoint | Is Stone Tablet? | Uses OPENAI_INSIGHTS_MODEL? | Concern |
|----------|-----------------|----------------------------|---------|
| `/api/insights` | NO (daily) | YES | **HIGH** - daily regeneration at gpt-5.1 prices |
| `/api/birth-chart` | YES (permanent) | YES | LOW - one-time generation |
| `/api/connection-brief` | NO (daily) | YES | **HIGH** - per-connection daily at gpt-5.1 |
| `/api/connection-insight` | NO (daily) | YES | **MEDIUM** - deprecated but still callable |
| `/api/cron/prewarm-insights` | NO (daily) | YES | **HIGH** - automated daily generation |

---

## 4. Top Cost Drivers (Ranked)

### Cost Formula
`Cost = Frequency × Average Tokens × Model Price`

### Ranking

| Rank | Feature | Model | Frequency (per user/day) | Avg Tokens | Est. Cost/User/Day | Why |
|------|---------|-------|-------------------------|------------|-------------------|-----|
| **1** | **Space Between** | gpt-4o (deep) | ~0.1 (rare but expensive) | ~4500 | **$0.03-0.09** | Uses expensive gpt-4o model, large prompts with dual user data |
| **2** | **Connection Briefs** | insights | N × 1/day (N = connections) | ~1000 | **$0.001 × N** | Multiplied by connection count, IntersectionObserver triggers |
| **3** | **Sanctuary Insight** | insights | ~1.5/day (today + year) | ~1400 | **$0.001** | Daily content, users toggle timeframes |
| **4** | **Prewarm Cron** | insights | ~1/user (automated) | ~1400 | **$0.001** | Runs for all active users within 3h of midnight |
| **5** | **Soul Path** | insights (x2) | ~0.03 (one-time) | ~11500 | **$0.005** (amortized) | Two OpenAI calls, but stone tablet |
| **6** | **Public Tarot** | horoscope | ~0.5 (anonymous) | ~1100 | **$0.0003** | Low volume, idempotency cache |
| **7** | **Public Horoscope** | horoscope | ~36/day (all signs) | ~750 | **$0.00003** | Shared across users, 24h cache |
| **8** | **Public Compatibility** | horoscope | ~0 (144 total lifetime) | ~1800 | **$0.00** | Stone tablets, finite set |
| **9** | **Social Summary** | fast | ~0.1 (on connect) | ~2000 | **$0.0004** | Rare, on social provider connect |
| **10** | **Connection Insight** | insights | ~0 (deprecated) | ~1500 | ~$0 | Deprecated, rarely triggered |

### Critical Cost Drivers Summary

1. **Space Between (gpt-4o):** Most expensive per-call due to gpt-4o model. However, stone tablet means one-time cost per connection.

2. **Connection Briefs (at scale):** With 10+ connections, daily regeneration adds up. Key optimization target.

3. **If OPENAI_INSIGHTS_MODEL=gpt-5.1:** All daily features become 8-16x more expensive:
   - Insight: $0.001 → $0.008
   - Connection Brief: $0.001 → $0.008 per connection
   - Prewarm: $0.001 → $0.008 per user

---

## 5. Caching Maturity Scorecard

| Feature | Caching Exists? | Cache Key Correct? | Cache Hit = Free (no RL)? | Issues / Suggested Fixes |
|---------|----------------|-------------------|--------------------------|--------------------------|
| `/api/insights` | **YES** | **YES** (buildInsightCacheKey) | **YES** | None - exemplary |
| `/api/birth-chart` | **YES** | **YES** (hash + version) | **YES** | None - stone tablet |
| `/api/connection-brief` | **YES** | **YES** (DB: date+lang+version) | **YES** | None - exemplary |
| `/api/connection-insight` | **YES** | **YES** (inline template) | **YES** | Deprecated - remove |
| `/api/connection-space-between` | **YES** | **YES** (DB: lang+version) | **YES** | None - stone tablet |
| `/api/public-horoscope` | **YES** | **YES** (inline template) | **YES** | Could use helper function |
| `/api/public-tarot` | **PARTIAL** | **YES** (idempotency only) | **YES** | No result caching - intentional (unique readings) |
| `/api/public-compatibility` | **YES** | **YES** (DB: pair_key) | **YES** | None - stone tablet |
| `/api/cron/prewarm-insights` | **YES** | **YES** (buildInsightCacheKey) | N/A | None - budget-controlled |
| `lib/social/summarize.ts` | **YES** | **YES** (DB: user+provider) | N/A | Add trackAiUsage() |

### Scorecard Summary

- **10/10 have caching** (appropriate for use case)
- **10/10 cache keys are correct**
- **9/10 cache hits bypass rate limits** (tarot intentionally doesn't cache results)
- **1 gap:** Social summary not in ai_usage_events

---

## 6. Recommendations Draft (Audit Only)

### P0: Model Swaps (High Impact, Low Risk)

| Change | Current | Proposed | Est. Savings | Risk |
|--------|---------|----------|--------------|------|
| **Ensure OPENAI_INSIGHTS_MODEL is gpt-4o-mini in prod** | May be gpt-5.1 | gpt-4o-mini | 8-16x on daily content | LOW - same quality for daily content |
| **Space Between: Consider gpt-4o-mini** | gpt-4o (deep) | gpt-4o-mini | ~10x per stone tablet | MEDIUM - quality trade-off for permanent content |

### P1: Cache Policy Changes

| Change | Current | Proposed | Impact |
|--------|---------|----------|--------|
| **Connection Brief: Extend TTL** | 24h (daily) | 48h (allow staleness) | 50% fewer regenerations |
| **Public Horoscope: Extend TTL** | 24h | 48h or 72h | Fewer regenerations for same-day requests |

### P2: Rate Limit Optimization

All routes already have correct pattern (cache check BEFORE rate limit). No changes needed.

### P3: Quarterly Refresh for Space Between

| Change | Current | Proposed | Impact |
|--------|---------|----------|--------|
| Add `quarter_key` to Space Between cache | Permanent forever | Quarterly refresh | Fresh content, but 4x cost per year per connection |

**Recommendation:** Do NOT implement quarterly refresh for Space Between. The "stone tablet" model is correct for relationship blueprints - they shouldn't change frequently.

### P4: Missing Tracking

| Change | File | Action |
|--------|------|--------|
| Add trackAiUsage to social summary | `lib/social/summarize.ts:195` | Add after logTokenAudit |
| Add gpt-4o to pricing.ts | `lib/ai/pricing.ts` | Add pricing entry for cost estimates |

---

## One Paragraph Summary

The Solara codebase has **11 OpenAI call sites** across 10 routes plus 1 library function. Caching is mature and well-implemented across all endpoints with correct cache keys and "cache hit = free" behavior. The **primary cost driver is Space Between** using gpt-4o (~$0.03-0.09 per stone tablet), followed by **Connection Briefs** which multiply by connection count. If `OPENAI_INSIGHTS_MODEL=gpt-5.1` is set in production, daily content (insights, briefs, prewarm) becomes 8-16x more expensive than necessary. **Recommended PR actions:** (1) Verify OPENAI_INSIGHTS_MODEL=gpt-4o-mini in production, (2) Add trackAiUsage to social summary, (3) Add gpt-4o to pricing.ts, (4) Consider gpt-4o-mini for Space Between if quality is acceptable.
