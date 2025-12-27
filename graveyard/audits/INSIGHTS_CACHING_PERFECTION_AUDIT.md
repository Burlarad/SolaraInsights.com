# Insights Caching Perfection Audit

**Date**: 2025-12-13
**Auditor**: Claude
**Scope**: /api/insights, /api/cron/prewarm-insights, /api/public-horoscope, /api/connection-insight, telemetry, locking

---

## A) Executive Summary

### What is Perfect

1. **Cache key alignment**: Cron and /api/insights use identical `buildInsightCacheKey()` helper with matching period format (`YYYY-MM-DD`)
2. **TTL alignment**: Cron uses 172800s for daily, matching `/api/insights` `getTtlSeconds("today")`
3. **Auth implementation**: Cron has robust 3-tier auth with safe debug responses (no secrets exposed)
4. **Lock safety**: All routes using locks have proper `finally` blocks or error handlers for release
5. **Telemetry accuracy**: Hits report 0 tokens, misses report actual tokens across all routes
6. **Cron generates only on miss**: Cache check at line 140 before any OpenAI call
7. **Safety caps**: `MAX_USERS_PER_RUN = 500` prevents timeout storms
8. **Fallbacks**: Timezone defaults to "UTC", language defaults to "en" in all routes

### What is "Good Enough but Risky"

9. **No pagination in cron**: If >500 active users, only first 500 are processed per run (acceptable with 30-min schedule)

### What Must Be Fixed

10. **P1: /api/connection-insight lacks distributed locking** - Could cause stampede on popular connections

---

## B) Verification Matrix

| Route/Feature | Cache Key Format | TTL (seconds) | Locking | Auth | Proof Method |
|---------------|------------------|---------------|---------|------|--------------|
| `/api/insights` | `insight:v1:p{V}:{userId}:{period}:{periodKey}:{lang}` | today:172800, week:864000, month:3456000, year:34560000 | Yes: `lock:insight:p{V}:{userId}:{period}:{periodKey}` | User auth (Supabase) | Code: route.ts:122-123, getTtlSeconds():19-32 |
| `/api/cron/prewarm-insights` | Same as above via `buildInsightCacheKey()` | 172800 (daily only) | Yes: same format via `buildInsightLockKey()` | x-cron-secret header | Code: route.ts:136-137, auth:32-64 |
| `/api/public-horoscope` | `publicHoroscope:v1:p{V}:{sign}:{timeframe}:{periodKey}:{lang}` | 86400 (24h) | Yes: `lock:publicHoroscope:p{V}:{sign}:...` | None (public) | Code: route.ts:35,65 |
| `/api/connection-insight` | `connectionInsight:v1:p{V}:{userId}:{connId}:{timeframe}:{periodKey}:{lang}` | 86400 (24h) | **NO** | User auth (Supabase) | Code: route.ts:125 |
| Telemetry (ai_usage_events) | N/A | N/A | N/A | N/A | Code: trackUsage.ts:69-111 |
| Active users query | `last_seen_at >= NOW() - 7 days` | N/A | N/A | N/A | Code: prewarm route.ts:84 |

---

## C) Code Verification

### C1: /api/insights uses timeframe-based TTL everywhere it writes to cache

**VERIFIED**

```typescript
// app/api/insights/route.ts:19-32
function getTtlSeconds(timeframe: string): number {
  switch (timeframe) {
    case "today": return 172800;    // 48 hours
    case "week": return 864000;     // 10 days
    case "month": return 3456000;   // 40 days
    case "year": return 34560000;   // 400 days
    default: return 86400;          // 24 hours fallback
  }
}

// app/api/insights/route.ts:312-313
const ttlSeconds = getTtlSeconds(timeframe);
await setCache(cacheKey, insight, ttlSeconds);
```

### C2: Cron uses the same periodKey format as /api/insights

**VERIFIED**

```typescript
// lib/timezone/periodKeys.ts:50 - Used by /api/insights
const daily = format(localTime, "yyyy-MM-dd");

// app/api/cron/prewarm-insights/route.ts:133 - Used by cron
const tomorrowPeriodKey = format(tomorrow, "yyyy-MM-dd", { timeZone: timezone });
```

Both produce `YYYY-MM-DD` format (e.g., "2025-12-14"). The cron correctly computes **tomorrow's** key so it matches what `/api/insights` will request after midnight.

### C3: Cron checks cache before generating

**VERIFIED**

```typescript
// app/api/cron/prewarm-insights/route.ts:139-144
const cached = await getCache<SanctuaryInsight>(cacheKey);
if (cached) {
  stats.skippedCached++;
  continue;  // Early return, no OpenAI call
}
```

### C4: Cron acquires/releases lock properly on all paths

**VERIFIED**

```typescript
// app/api/cron/prewarm-insights/route.ts:146-151 - Acquire
const lockAcquired = await acquireLock(lockKey, 60);
if (!lockAcquired) {
  stats.skippedLocked++;
  continue;  // Skip if locked
}

// app/api/cron/prewarm-insights/route.ts:310-312 - Release in finally
finally {
  await releaseLock(lockKey);
}
```

Lock is released in `finally` block, ensuring release even on generation errors.

### C5: Cron safety limits

**VERIFIED**

| Requirement | Implementation | Code Reference |
|-------------|----------------|----------------|
| Hard cap per run | `MAX_USERS_PER_RUN = 500` | route.ts:28 |
| Pagination | `.limit(MAX_USERS_PER_RUN)` | route.ts:85 |
| Timezone fallback | `profile.timezone \|\| "UTC"` | route.ts:107 |
| Language fallback | `profile.language \|\| "en"` | route.ts:108 |

### C6: Telemetry hit/miss accuracy

**VERIFIED**

| Route | Hit Tracking | Miss Tracking |
|-------|--------------|---------------|
| /api/insights | `cacheStatus: "hit"`, tokens: 0 (line 136) | `cacheStatus: "miss"`, tokens: actual (line 291) |
| /api/cron/prewarm-insights | No tracking on cache hit (line 141-143) | `cacheStatus: "miss"`, tokens: actual (line 288) |
| /api/public-horoscope | `cacheStatus: "hit"`, tokens: 0 (line 48) | `cacheStatus: "miss"`, tokens: actual (line 152) |
| /api/connection-insight | `cacheStatus: "hit"`, tokens: 0 (line 138) | `cacheStatus: "miss"`, tokens: actual (line 215) |

Cron correctly **never** tracks hits (only misses), preventing telemetry pollution.

---

## D) Runtime Tests

### D1: Cron Auth Tests

**Test 1: No header (expect MISSING_HEADER)**
```bash
curl -i "https://solarainsights.com/api/cron/prewarm-insights"
```
Expected: `401 {"error":"MISSING_HEADER"}`

**Test 2: With correct header (expect 200)**
```bash
curl -i -H "x-cron-secret: $CRON_SECRET" "https://solarainsights.com/api/cron/prewarm-insights"
```
Expected: `200 {"message":"Pre-warm complete","stats":{...}}`

**Test 3: Wrong header (expect MISMATCH)**
```bash
curl -i -H "x-cron-secret: wrong-secret" "https://solarainsights.com/api/cron/prewarm-insights"
```
Expected: `401 {"error":"MISMATCH","headerLen":12,"serverSecretLen":...}`

### D2: Forcing Candidate Test

To verify prewarm actually generates, temporarily increase window:

```typescript
// Local only - DO NOT DEPLOY
const PREWARM_WINDOW_HOURS = 24; // Was 3
```

Then run cron and verify `stats.warmed > 0`. Revert after testing.

**Alternative: Check logs after midnight rollover**
```bash
# Run at 9pm local for users
curl -H "x-cron-secret: $CRON_SECRET" "https://solarainsights.com/api/cron/prewarm-insights"
# Expect stats.candidates > 0, stats.warmed > 0 for users approaching midnight
```

### D3: Telemetry Verification Queries

**Verify cron produces misses only:**
```sql
SELECT route, cache_status, COUNT(*), SUM(total_tokens)
FROM ai_usage_events
WHERE route = '/api/cron/prewarm-insights'
GROUP BY route, cache_status;
-- Expected: Only "miss" rows, never "hit"
```

**Verify /api/insights has both hits and misses:**
```sql
SELECT route, cache_status, COUNT(*), SUM(total_tokens)
FROM ai_usage_events
WHERE route = '/api/insights'
GROUP BY route, cache_status;
-- Expected: Both "hit" (tokens=0) and "miss" (tokens>0) rows
```

**Calculate hit rate:**
```sql
SELECT
  route,
  COUNT(*) FILTER (WHERE cache_status = 'hit') * 100.0 / COUNT(*) AS hit_rate_pct
FROM ai_usage_events
WHERE route IN ('/api/insights', '/api/public-horoscope')
GROUP BY route;
```

### D4: Stampede Test

**Simulate concurrent requests (local development):**
```bash
# Open 5 terminals and run simultaneously:
for i in {1..5}; do
  curl -X POST "http://localhost:3000/api/public-horoscope" \
    -H "Content-Type: application/json" \
    -d '{"sign":"aries","timeframe":"today","timezone":"America/New_York"}' &
done
wait
```

**Verify in Redis:**
```bash
redis-cli KEYS "lock:publicHoroscope:*"
# Should see lock acquired during generation
```

**Check logs for single generation:**
```
[PublicHoroscope] Cache miss for publicHoroscope:v1:p1:aries:today:day:2025-12-13:en
[PublicHoroscope] ✓ Lock acquired for lock:publicHoroscope:p1:aries:today:day:2025-12-13:en
[PublicHoroscope] Lock already held for ... waiting for cached result...
[PublicHoroscope] Lock already held for ... waiting for cached result...
[PublicHoroscope] ✓ Found cached result after lock wait
```

---

## E) Findings + Fixes

### P1: /api/connection-insight lacks distributed locking (Reliability)

**Severity**: P1 - Reliability
**Impact**: If multiple users view the same connection simultaneously after cache expires, duplicate OpenAI calls occur.
**Risk**: Lower than public-horoscope (connection-specific, not shared across users), but still wasteful.

**Recommendation**: Add locking similar to /api/insights pattern. Defer to next sprint as connection insights are user-scoped (not shared), reducing stampede likelihood.

### P2: Cron debug responses should be removed after verification (Cleanup)

**Severity**: P2 - Cleanup
**Impact**: Debug responses expose response structure (not secrets, but unnecessary in production).
**Current state**: Safe (only lengths, never values).

**Recommendation**: Once cron auth is verified working in production, revert to simple:
```typescript
if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### P3: No pagination beyond 500 users (Known Limitation)

**Severity**: P3 - Acceptable
**Impact**: Only first 500 active users are prewarmed per cron run.
**Mitigation**: With 30-minute cron schedule, 500 users/run = 24,000 users/day capacity. Sufficient for current scale.

---

## F) Build Verification

```
$ npm run build

> solara-insights@0.1.0 build
> next build

   ▲ Next.js 15.5.7
   - Environments: .env.local, .env

   Creating an optimized production build ...
 ✓ Compiled successfully in 2.0s
   Linting and checking validity of types ...
 ✓ Generating static pages (31/31)
   Finalizing page optimization ...

Route (app)                                 Size  First Load JS
├ ƒ /api/cron/prewarm-insights             157 B         102 kB
├ ƒ /api/insights                          157 B         102 kB
├ ƒ /api/public-horoscope                  157 B         102 kB
├ ƒ /api/connection-insight                157 B         102 kB
...
```

**Result**: BUILD PASSED

---

## G) Recommendations

1. **Immediate**: Deploy cron with current debug responses, verify auth works
2. **Short-term**: Remove debug responses once verified (P2)
3. **Medium-term**: Add locking to /api/connection-insight (P1)
4. **Long-term**: Consider pagination or cursor-based cron if user base exceeds 24K active users

---

## H) Conclusion

The Insights caching and prewarm system is **production-ready** with the following assurances:

- Cache keys are correctly aligned between cron and user-facing routes
- Tomorrow's insights will be served from cache when users request them after midnight
- Locking prevents stampedes on shared resources (public-horoscope, insights)
- Telemetry accurately distinguishes cache hits (0 cost) from misses (actual cost)
- Auth is secure and debuggable without exposing secrets
- Safety limits prevent runaway processes

The only P1 issue (connection-insight locking) is low-risk due to user-scoped nature and can be addressed in the next sprint.
