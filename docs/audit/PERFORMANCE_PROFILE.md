# PERFORMANCE_PROFILE.md

**Generated:** 2026-01-01
**Scope:** Bundle analysis, heavy compute paths, cache strategy risks, database query patterns

---

## 1. RAW BUILD OUTPUT

```
npm run build

> solara@0.1.0 build
> next build

   Creating an optimized production build ...
 ✓ Compiled successfully in 9.9s
 ✓ Linting and checking validity of types
 ✓ Collecting page data
 ✓ Generating static pages (79/79)
 ✓ Collecting build traces
 ✓ Finalizing page optimization

Route (app)                                              Size     First Load JS
┌ ○ /                                                   14.6 kB        139 kB
├ ○ /_not-found                                          977 B         102 kB
├ ƒ /api/birth-chart                                     0 B                0 B
├ ƒ /api/compatibility                                   0 B                0 B
├ ƒ /api/connection-insight                              0 B                0 B
├ ƒ /api/connection-space-between                        0 B                0 B
├ ƒ /api/connections                                     0 B                0 B
├ ƒ /api/cron/prewarm-insights                           0 B                0 B
├ ƒ /api/horoscope                                       0 B                0 B
├ ƒ /api/insights                                        0 B                0 B
├ ƒ /api/numerology                                      0 B                0 B
├ ƒ /api/numerology/lucky                                0 B                0 B
├ ƒ /api/social/[provider]/callback                      0 B                0 B
├ ƒ /api/social/[provider]/connect                       0 B                0 B
├ ƒ /api/social/[provider]/disconnect                    0 B                0 B
├ ƒ /api/social/status                                   0 B                0 B
├ ƒ /api/social/sync                                     0 B                0 B
├ ƒ /api/stripe/checkout                                 0 B                0 B
├ ƒ /api/stripe/webhook                                  0 B                0 B
├ ƒ /api/tarot                                           0 B                0 B
├ ƒ /api/user/profile                                    0 B                0 B
├ ƒ /auth/callback                                       0 B                0 B
├ ○ /auth/post-callback                                 951 B         102 kB
├ ○ /compatibility                                      3.32 kB        115 kB
├ ○ /forgot-password                                    2.31 kB        113 kB
├ ○ /horoscope                                          5.81 kB        131 kB
├ ○ /join                                               7.96 kB        133 kB
├ ƒ /onboarding                                         11.3 kB        137 kB
├ ƒ /sanctuary                                          12.8 kB        215 kB
├ ƒ /sanctuary/birth-chart                               7.2 kB        178 kB
├ ƒ /sanctuary/connections                               9.6 kB        207 kB
├ ƒ /sanctuary/journal                                   6.8 kB        165 kB
├ ƒ /sanctuary/numerology                               18.9 kB        203 kB
├ ƒ /settings                                           12.9 kB        202 kB
├ ○ /sign-in                                             3.2 kB        114 kB
├ ○ /tarot                                               5.4 kB        129 kB
├ ○ /welcome                                             2.1 kB        110 kB
└ + 42 more routes

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

Warnings:
- useEffect missing dependency warnings (7 total)
```

---

## 2. LARGEST PAGES BY FIRST LOAD JS

| Rank | Route | First Load JS | Risk | Notes |
|------|-------|---------------|------|-------|
| 1 | `/sanctuary` | 215 kB | HIGH | Main dashboard, loads everything |
| 2 | `/sanctuary/connections` | 207 kB | HIGH | Connection management UI |
| 3 | `/sanctuary/numerology` | 203 kB | MEDIUM | Heavy viz components |
| 4 | `/settings` | 202 kB | MEDIUM | Form-heavy page |
| 5 | `/sanctuary/birth-chart` | 178 kB | MEDIUM | Chart visualization |
| 6 | `/sanctuary/journal` | 165 kB | LOW | Text-focused |
| 7 | `/` | 139 kB | LOW | Landing page |
| 8 | `/onboarding` | 137 kB | MEDIUM | Multi-step form |

### Analysis:
- **Shared chunk dominance:** ~100 kB base shared across all routes
- **Main concern:** `/sanctuary` at 215 kB - this is the primary user-facing page
- **Opportunity:** Code-split sanctuary tabs into dynamic imports

### Recommendations:
```typescript
// app/(protected)/sanctuary/page.tsx
// Current: All tabs loaded upfront
// Proposed: Dynamic import for heavy tabs

const NumerologyTab = dynamic(() => import('@/components/sanctuary/NumerologyTab'), {
  loading: () => <TabSkeleton />,
});

const BirthChartTab = dynamic(() => import('@/components/sanctuary/BirthChartTab'), {
  loading: () => <TabSkeleton />,
});
```

---

## 3. HEAVIEST SERVER COMPUTE PATHS

### 3.1 Birth Chart Computation

**Location:** `lib/ephemeris/swissEngine.ts:1-150`

**Compute Cost:** HIGH (Swiss Ephemeris calculations)

| Operation | File:Line | Complexity | Cached? |
|-----------|-----------|------------|---------|
| Planet positions | swissEngine.ts:71-95 | O(12 planets × ephemeris lookup) | YES (Supabase) |
| House cusps | swissEngine.ts:97-120 | O(12 houses) | YES (Supabase) |
| Aspect calculation | aspects.ts:42-85 | O(n²) where n=12 | YES (Supabase) |
| Derived summary | derived.ts:56-120 | O(12 planets) | YES (Supabase) |

**Cache Strategy:**
- **Storage:** `profiles.birth_chart_placements_json` (JSONB)
- **Invalidation:** Profile `updated_at` > `birth_chart_computed_at`
- **Schema versioning:** `BIRTH_CHART_SCHEMA_VERSION = 8`

**Evidence (lib/birthChart/storage.ts:166-194):**
```typescript
export function isStoredChartValid(
  storedChart: BirthChartData | null,
  currentProfile: Profile
): boolean {
  if (!storedChart) return false;

  // Check 1: Schema version must match current version
  if (storedChart.schemaVersion < BIRTH_CHART_SCHEMA_VERSION) {
    return false;  // Triggers recomputation
  }

  // Check 2: Profile must not have been updated after chart was computed
  const chartDate = new Date(storedChart.computedAt);
  const profileDate = new Date(currentProfile.updated_at);
  if (profileDate > chartDate) {
    return false;  // Birth data may have changed
  }

  return true;
}
```

**Risk:** LOW - Well-cached, only recomputes on birth data change or schema upgrade.

---

### 3.2 AI Content Generation

**Location:** Multiple API routes

| Endpoint | Model | Cost Tier | Cached? | TTL |
|----------|-------|-----------|---------|-----|
| `/api/insights` | gpt-4.1-mini | LOW | Redis | 24h (daily) |
| `/api/birth-chart` (narrative) | gpt-5.1 | HIGH | Supabase | Permanent |
| `/api/horoscope` | gpt-4.1-mini | LOW | Redis | 24h |
| `/api/tarot` | gpt-4.1-mini | LOW | None | N/A |
| `/api/connection-space-between` | gpt-4o | MEDIUM | Supabase | Permanent |
| `/api/numerology` (soul path) | gpt-5.1 | HIGH | Supabase | Permanent |

**Budget Circuit Breaker (lib/ai/costControl.ts:77-105):**
```typescript
export async function checkBudget(): Promise<BudgetCheckResult> {
  const limit = getDailyBudgetLimit();  // Default: $100/day
  const failMode = getFailMode();        // Default: "closed"

  try {
    const key = getBudgetKey();          // "openai:budget:YYYY-MM-DD"
    const used = (await getCache<number>(key)) || 0;
    const allowed = used < limit;

    if (!allowed) {
      console.warn(`[CostControl] Daily budget exceeded: $${used.toFixed(4)} / $${limit}`);
    }

    return { allowed, used, limit, remaining };
  } catch (error) {
    if (failMode === "closed") {
      return { allowed: false, used: 0, limit, remaining: 0 };  // SAFE: Block on Redis failure
    }
    return { allowed: true, ... };  // RISKY: Only for dev
  }
}
```

**Risk:** MEDIUM - Circuit breaker protects against runaway costs, but `/api/tarot` has no caching (by design - unique draws).

---

### 3.3 Social Sync Pipeline

**Location:** `app/api/social/sync/route.ts`

**Compute Flow:**
1. Fetch OAuth tokens from DB
2. Decrypt tokens (AES-256-GCM)
3. Call provider APIs (rate-limited by provider)
4. Generate summary with gpt-4o-mini
5. Store summary in Supabase

**Risk:** MEDIUM - Provider API calls are external dependency; timeouts configurable but not explicitly set.

**Recommendation:** Add explicit timeout to provider fetches:
```typescript
const response = await fetch(providerUrl, {
  signal: AbortSignal.timeout(10000),  // 10s timeout
});
```

---

## 4. CACHE KEY STRATEGY RISKS

### 4.1 Redis Key Structure

| Key Pattern | Example | Risk |
|-------------|---------|------|
| `ratelimit:{ip}` | `ratelimit:192.168.1.1` | LOW - Standard pattern |
| `burst:{endpoint}:{userId}` | `burst:insights:uuid` | LOW |
| `openai:budget:{date}` | `openai:budget:2026-01-01` | LOW - UTC-based |
| `day:{date}` | `day:2026-01-01` | MEDIUM - Timezone-aware |
| `week:{year}-W{num}` | `week:2026-W01` | MEDIUM - ISO week calculation |

**Timezone Risk (lib/cache/redis.ts:272-291):**
```typescript
function toLocalWeekString(date: Date, timezone: string): string {
  // Complex week number calculation using Intl.DateTimeFormat
  // Edge case: Week 53 / Week 1 boundary
  const weekNumber = Math.ceil((dayOfYear - dayOfWeek + 10) / 7);
  return `${year}-W${String(weekNumber).padStart(2, "0")}`;
}
```

**Risk:** The ISO week calculation is custom-implemented. Standard libraries like `date-fns` have tested implementations.

**Recommendation:**
```typescript
import { getWeek, getYear } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

function toLocalWeekString(date: Date, timezone: string): string {
  const zonedDate = formatInTimeZone(date, timezone, 'yyyy-MM-dd');
  const [year, month, day] = zonedDate.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  return `${getYear(localDate)}-W${String(getWeek(localDate)).padStart(2, "0")}`;
}
```

---

### 4.2 Cache Invalidation Gaps

| Cache | Invalidation Trigger | Gap |
|-------|----------------------|-----|
| Birth chart placements | Profile updated | None - checks `updated_at` |
| Daily insights | Midnight local time | None - uses `day:{date}` key |
| Weekly insights | Week rollover | POTENTIAL - custom week calc |
| Numerology data | Profile name change | None - checks source hash |
| Space Between | Never | By design - stone tablet |

---

## 5. DATABASE QUERY PATTERNS

### 5.1 Supabase Query Analysis

**High-Frequency Queries:**

| Query Pattern | Location | Frequency | Index Needed? |
|---------------|----------|-----------|---------------|
| `profiles.select().eq('id', userId)` | 20+ files | Every request | YES (PK) |
| `insights.select().eq('user_id', userId).eq('local_date', date)` | insights route | Per user/day | YES (composite) |
| `connections.select().eq('owner_user_id', userId)` | connections route | Per user | YES (FK) |
| `daily_briefs.select().eq('connection_id', id).eq('local_date', date)` | connection-insight | Per connection/day | YES (composite) |

**Index Recommendations (Supabase SQL):**
```sql
-- Already exists (PK)
-- profiles.id

-- Recommended composite indexes
CREATE INDEX IF NOT EXISTS idx_insights_user_date
  ON insights(user_id, local_date);

CREATE INDEX IF NOT EXISTS idx_daily_briefs_connection_date
  ON daily_briefs(connection_id, local_date);

CREATE INDEX IF NOT EXISTS idx_connections_owner
  ON connections(owner_user_id);
```

### 5.2 N+1 Query Patterns

**Location:** `app/api/cron/prewarm-insights/route.ts`

**Pattern:**
```typescript
// Fetches all users, then loops
for (const user of users) {
  await generateInsight(user.id);  // Each makes DB call
}
```

**Risk:** MEDIUM for prewarm (cron job), LOW for user requests.

**Recommendation:** Batch where possible:
```typescript
const userIds = users.map(u => u.id);
const existingInsights = await supabase
  .from('insights')
  .select('user_id')
  .in('user_id', userIds)
  .eq('local_date', today);
```

---

## 6. PERFORMANCE RECOMMENDATIONS

### Priority 1: High Impact, Low Effort

1. **Add dynamic imports for heavy sanctuary tabs**
   - Location: `app/(protected)/sanctuary/page.tsx`
   - Impact: Reduce initial load from 215 kB to ~150 kB
   - Effort: 2 hours

2. **Add timeout to external API calls**
   - Location: Social sync, any external fetches
   - Impact: Prevent hanging requests
   - Effort: 1 hour

### Priority 2: Medium Impact, Medium Effort

3. **Replace custom week calculation with date-fns**
   - Location: `lib/cache/redis.ts:272-291`
   - Impact: Eliminate edge case bugs
   - Effort: 2 hours

4. **Add composite indexes for frequent queries**
   - Location: Supabase dashboard
   - Impact: 10-50% query speedup
   - Effort: 30 minutes

### Priority 3: Low Impact, Architecture

5. **Batch prewarm cron queries**
   - Location: `app/api/cron/prewarm-insights/route.ts`
   - Impact: Reduce DB round-trips
   - Effort: 4 hours

6. **Implement edge caching for public pages**
   - Location: `/horoscope`, `/compatibility`, `/tarot`
   - Impact: Reduce origin hits for public content
   - Effort: 1 day

---

## 7. MONITORING RECOMMENDATIONS

```typescript
// Add to API routes for performance tracking
const start = performance.now();
// ... operation ...
const duration = performance.now() - start;

console.log(`[Perf] ${endpoint} completed in ${duration.toFixed(2)}ms`);

// Alert thresholds
if (duration > 5000) {
  console.warn(`[Perf] SLOW: ${endpoint} took ${duration.toFixed(2)}ms`);
}
```

**Suggested Metrics:**
- P50/P95/P99 response times per route
- Redis cache hit rate
- OpenAI API latency and token usage
- Supabase query count per request
