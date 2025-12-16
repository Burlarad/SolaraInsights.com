# Repo-Wide Cohesion, Security & Cost Control Audit

**Date:** December 15, 2024
**Auditor:** Claude (Senior Full-Stack Engineer + Security Auditor)
**Scope:** Entire codebase - all routes, components, utilities, caching, OpenAI integrations

---

## 1) System Map

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
├───────────────────┬──────────────────────┬──────────────────────────────┤
│   PUBLIC PAGES    │    AUTH PAGES        │      PROTECTED PAGES          │
│  /, /about, /learn│  /sign-in, /sign-up  │  /sanctuary, /settings        │
│                   │  /join, /welcome     │  /sanctuary/birth-chart       │
│                   │  /onboarding         │  /sanctuary/connections       │
│                   │  /forgot-password    │                               │
│                   │  /reset-password     │                               │
│                   │  /connect-social     │                               │
└───────────────────┴──────────────────────┴──────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              API ROUTES                                  │
├───────────────────────────────────────────────────────────────────────┬─┤
│                     PUBLIC (OpenAI-backed)                            │$│
│  /api/public-horoscope  [Rate: 30/min/IP, Lock: 60s, Cache: 24h]     │ │
│  /api/public-tarot      [Rate: tiered, Cooldown: 60s, Cache: idem]   │ │
│  /api/public-compatibility [Rate: 10/min, DB: forever]               │ │
├───────────────────────────────────────────────────────────────────────┤ │
│                   PROTECTED (OpenAI-backed)                           │ │
│  /api/insights          [Auth required, Lock: 60s, Cache: 48h]       │ │
│  /api/connection-insight [Auth required, NO RATE LIMIT]              │ │
│  /api/birth-chart       [Auth required, NO RATE LIMIT]               │ │
├───────────────────────────────────────────────────────────────────────┤ │
│                       CRON (OpenAI-backed)                            │ │
│  /api/cron/prewarm-insights [x-cron-secret auth, Lock: 60s]          │ │
├───────────────────────────────────────────────────────────────────────┤ │
│                     OTHER (No OpenAI)                                 │ │
│  /api/journal, /api/connections, /api/user/profile                   │ │
│  /api/stripe/checkout, /api/stripe/webhook, /api/health              │ │
└───────────────────────────────────────────────────────────────────────┴─┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
             ┌───────────┐   ┌───────────┐   ┌───────────┐
             │   Redis   │   │  Supabase │   │  OpenAI   │
             │  (Cache)  │   │    (DB)   │   │   (AI)    │
             └───────────┘   └───────────┘   └───────────┘
```

### All API Routes Grouped by Feature

| Feature | Route | Auth | OpenAI | Rate Limit | Cache |
|---------|-------|------|--------|------------|-------|
| **Public Home** | `/api/public-horoscope` | None | Yes | 30/min/IP | 24h |
| | `/api/public-tarot` | None | Yes | Tiered (5/day anon) | Idempotent |
| | `/api/public-compatibility` | None | Yes | 10/min/IP | Forever (DB) |
| **Sanctuary** | `/api/insights` | Required | Yes | None | 48h |
| | `/api/connection-insight` | Required | Yes | None | TBD |
| | `/api/birth-chart` | Required | Yes | None | Stored in DB |
| **Cron** | `/api/cron/prewarm-insights` | x-cron-secret | Yes | N/A | 48h |
| **Journal** | `/api/journal` | Required | No | None | None |
| **Connections** | `/api/connections` | Required | No | None | None |
| **Profile** | `/api/user/profile` | Required | No | None | None |
| **Stripe** | `/api/stripe/checkout` | Optional | No | None | None |
| | `/api/stripe/webhook` | Stripe sig | No | None | None |
| **Health** | `/api/health` | None | No | None | None |

### Supabase Usage

| Usage Type | Files |
|------------|-------|
| **Client (anon key)** | `lib/supabase/client.ts` - browser client |
| **Server (anon key + cookies)** | `lib/supabase/server.ts` - `createServerSupabaseClient()` |
| **Admin (service role)** | `lib/supabase/server.ts` - `createAdminSupabaseClient()` |

Admin client used in:
- `/api/stripe/webhook/route.ts` - user creation, profile updates
- `/api/cron/prewarm-insights/route.ts` - profile queries
- Various routes for `touchLastSeen()` activity tracking

### Redis Usage (Cache Keys & Locks)

| Pattern | Purpose | TTL |
|---------|---------|-----|
| `ratelimit:*` | IP-based rate limiting | Window-based (60s typical) |
| `publicHoroscope:v1:p{ver}:{sign}:{tf}:{day}:{lang}` | Horoscope cache | 24h |
| `lock:publicHoroscope:p{ver}:{sign}:{tf}:{day}:{lang}` | Generation lock | 60s |
| `tarot:session:{sessionId}:{ip}:*` | Tarot rate limits | Hourly/daily |
| `tarot:cooldown:{sessionId}:{ip}` | Tarot cooldown | 60s |
| `tarot:idempotent:{requestId}` | Request dedup | 60s |
| `lock:tarot:gen:{requestId}` | Generation lock | 30s |
| `compat:cooldown:{ip}` | Compatibility cooldown | 10s |
| `compat:ratelimit:{ip}` | Compatibility rate limit | 60s |
| `compat:idempotent:{requestId}` | Request dedup | 60s |
| `lock:compat:gen:{pairKey}` | Pair generation lock | 30s |
| `insight:v1:p{ver}:{userId}:{period}:{key}:{lang}` | Insight cache | 48h |
| `lock:insight:p{ver}:{userId}:{period}:{key}` | Insight lock | 60s |

### OpenAI Entry Points

| File | Model | Purpose |
|------|-------|---------|
| `app/api/public-horoscope/route.ts` | `OPENAI_MODELS.horoscope` | Public sign horoscopes |
| `app/api/public-tarot/route.ts` | `OPENAI_MODELS.tarot` | Public tarot readings |
| `app/api/public-compatibility/route.ts` | `OPENAI_MODELS.compatibility` | Sign compatibility |
| `app/api/insights/route.ts` | `OPENAI_MODELS.insights` | Personalized daily insights |
| `app/api/connection-insight/route.ts` | `OPENAI_MODELS.connectionInsight` | Relationship insights |
| `app/api/birth-chart/route.ts` | `OPENAI_MODELS.birthChart` | Birth chart analysis |
| `app/api/cron/prewarm-insights/route.ts` | `OPENAI_MODELS.insights` | Pre-warm cache |

---

## 2) Incoherences & Rule Violations

### Product Laws Checked

| Law | Status | Findings |
|-----|--------|----------|
| "Stone tablet" features generate once forever | **PARTIAL** | Compatibility: YES. Horoscope/Tarot: NO (regenerates each period) |
| Public outputs render in-page (no modals) | **YES** | All arenas render inline |
| Timeframe toggles only where intended | **VIOLATION** | See below |
| "Keep the magic" - no internal sources in UI | **YES** | No personalization sources exposed |
| Mobile ergonomics: no h-scroll, 44px targets, 16px inputs | **PARTIAL** | See below |

### Violations Found

#### V1: ZodiacGrid Contains Dead Tarot/Compatibility Placeholders

**Severity:** P2 (Cleanup)
**Where:** `components/home/ZodiacGrid.tsx:223-242`
**Why:** ZodiacGrid still renders placeholder cards for Tarot/Compatibility experiences, but these are now handled by dedicated TarotArena and CompatibilityArena components.

```tsx
// Lines 223-242: Dead code - placeholders for Tarot/Compatibility
{selectedSign && experience === "Tarot" && (
  <Card>Coming soon for {selectedSign.name}</Card>
)}
{selectedSign && experience === "Compatibility" && (
  <Card>Coming soon for {selectedSign.name}</Card>
)}
```

**Fix:** Remove these placeholder blocks from ZodiacGrid.

#### V2: Timeframe Not Hidden for Non-Horoscope in ZodiacGrid

**Severity:** P2 (UX)
**Where:** `components/home/ZodiacGrid.tsx:100-113`
**Why:** When experience changes away from Horoscope, the component still reloads horoscope on timeframe change.

```tsx
// This effect fires even when experience !== "Horoscope"
if (prevTimeframeRef.current !== timeframe) {
  if (selectedSign && experience === "Horoscope") {
    loadHoroscope(selectedSign.key, timeframe);
  }
}
```

**Fix:** Already has guard, but timeframe toggle is visible in HeroSection - this is correctly gated.

#### V3: Duplicate Tarot Card Definitions

**Severity:** P1 (Correctness)
**Where:** `lib/tarot.ts` vs `lib/tarot/cards.ts`
**Why:** Two different tarot card libraries with incompatible ID schemes:
- `lib/tarot.ts` uses slugs: `the_fool`, `ace_of_cups`
- `lib/tarot/cards.ts` uses prefixed IDs: `major-00-fool`, `minor-cups-01-ace`

**Impact:**
- `lib/tarot.ts` is used by: `/api/insights`, `/api/cron/prewarm-insights`, `/sanctuary/page.tsx`
- `lib/tarot/cards.ts` is used by: `/api/public-tarot`

This could cause confusion if code mixes the two.

**Fix:** Consolidate into one source of truth. The `lib/tarot/cards.ts` version is more complete (has keywords, arcana type). Either:
1. Migrate all usages to `lib/tarot/cards.ts`
2. Or add `getTarotCardNames()` compatibility function to `lib/tarot/cards.ts`

---

## 3) Dead / Unused Code & Dependencies

### Safe to Delete Now

| Item | Location | Reason |
|------|----------|--------|
| Tarot/Compatibility placeholders | `components/home/ZodiacGrid.tsx:223-242` | Replaced by dedicated arenas |
| `joyDeepDiveSchema` (deprecated) | `lib/validation/schemas.ts:139` | Marked deprecated, use `tabDeepDiveSchema` |
| `validateJoyDeepDive` (deprecated) | `lib/validation/schemas.ts:182-186` | Marked deprecated |
| `ValidatedJoyDeepDive` type | `lib/validation/schemas.ts:144` | Alias for `ValidatedTabDeepDive` |

### Keep but Refactor

| Item | Location | Issue |
|------|----------|-------|
| `lib/tarot.ts` | `lib/tarot.ts` | Used by insights for card names, but overlaps with `lib/tarot/cards.ts` |
| `scrollToCenter` function | 3 files | Duplicated - extract to shared utility |
| `crypto.randomUUID()` pattern | TarotArena, CompatibilityArena | Consider shared utility for consistency |

### Needs Confirmation

| Item | Location | Question |
|------|----------|----------|
| `lib/social.ts` | `lib/social.ts` | Check if Facebook integration is still active |
| `lib/resend/client.ts` | `lib/resend/client.ts` | Verify email sending is working in production |
| `swisseph` npm package | `package.json` | Used for ephemeris calculations - verify usage |

### Duplicate Utility Functions

1. **`scrollToCenter`** - defined in:
   - `components/home/TarotArena.tsx:23-28`
   - `components/home/CompatibilityArena.tsx:29-34`
   - `components/home/ZodiacGrid.tsx:25-30`

   **Fix:** Extract to `lib/scroll.ts`:
   ```typescript
   export function scrollToCenter(el: HTMLElement) {
     const rect = el.getBoundingClientRect();
     const absoluteTop = rect.top + window.scrollY;
     const targetY = absoluteTop - window.innerHeight / 2 + rect.height / 2;
     window.scrollTo({ top: targetY, behavior: "smooth" });
   }
   ```

2. **`crypto.randomUUID()`** - used inline in:
   - `components/home/TarotArena.tsx:83`
   - `components/home/CompatibilityArena.tsx:93`
   - `lib/cache/tarotRateLimit.ts:35`

   This is fine - native API doesn't need abstraction.

### npm Packages Audit

Dependencies in `package.json` that may need verification:
- `swisseph` - Swiss Ephemeris for astrology calculations (heavy native module)
- `resend` - Email sending service
- `tz-lookup` - Timezone lookup from coordinates

All other packages appear actively used.

---

## 4) Caching & Consistency Audit

### Cache Key Inventory

| Feature | Key Format | Includes | Verdict |
|---------|------------|----------|---------|
| Public Horoscope | `publicHoroscope:v1:p{ver}:{sign}:{tf}:{dayKey}:{lang}` | promptVersion, sign, timeframe, periodKey, language | **CORRECT** |
| Public Tarot | `tarot:idempotent:{requestId}` | requestId only | **CORRECT** (idempotency) |
| Public Compatibility | `compat:idempotent:{requestId}` | requestId only | **CORRECT** (idempotency) |
| Sanctuary Insights | `insight:v1:p{ver}:{userId}:{period}:{key}:{lang}` | promptVersion, userId, period, periodKey, language | **CORRECT** |

### Lock Verification

| Lock | TTL | Release | Verdict |
|------|-----|---------|---------|
| `lock:publicHoroscope:*` | 60s | Explicit on success, catch releases | **CORRECT** |
| `lock:tarot:gen:*` | 30s | **NOT RELEASED ON ERROR** | **RISK** |
| `lock:compat:gen:*` | 30s | **NOT RELEASED ON ERROR** | **RISK** |
| `lock:insight:*` | 60s | Always released (finally block in prewarm) | **CORRECT** |

### Generate-Once-Forever Features

| Feature | Canonical Key | DB Constraint | Race Handling | Verdict |
|---------|---------------|---------------|---------------|---------|
| Compatibility | Alphabetical `signA__signB` | `pair_key UNIQUE` | Catches error 23505, fetches existing | **CORRECT** |

### Idempotency Key Issues

All idempotency keys correctly include `requestId` from client. No missing dimensions identified.

### Lock Release Issue Detail

**Severity:** P1 (Cost/Correctness)
**Where:**
- `app/api/public-tarot/route.ts` - catch block doesn't release lock
- `app/api/public-compatibility/route.ts` - catch block doesn't release lock

**Why:** If OpenAI call fails, lock stays until TTL expires (30s). Other users hitting same resource get 503 unnecessarily.

**Fix:**
```typescript
} catch (error: any) {
  // Release lock on error
  if (lockAcquired && lockKey) {
    await setCache(lockKey, null, 0).catch(() => {});
  }
  // ... rest of error handling
}
```

---

## 5) Security Audit

### Supabase RLS Verification

| Table | Public Read | Server-Only Write | Verdict |
|-------|-------------|-------------------|---------|
| `profiles` | Own row only | Own row only | **CORRECT** |
| `journal_entries` | Own entries | Own entries | **CORRECT** |
| `connections` | Own connections | Own connections | **CORRECT** |
| `public_compatibility` | All rows | Service role only | **CORRECT** |

### Service Role Key Security

**Severity:** P0 (Security)
**Finding:** Service role key (`SUPABASE_SERVICE_ROLE_KEY`) is:
- Only in `lib/supabase/server.ts` (server-side only)
- Not prefixed with `NEXT_PUBLIC_`
- Not exposed in client bundles

**Verdict:** **SECURE**

### Zod Validation Coverage

| Endpoint | Has Validation | Schema |
|----------|----------------|--------|
| `/api/public-horoscope` | YES | `publicHoroscopeSchema` |
| `/api/public-tarot` | YES | `publicTarotSchema` |
| `/api/public-compatibility` | YES | `publicCompatibilitySchema` |
| `/api/insights` | YES | `insightsSchema` |
| `/api/journal` | PARTIAL | Manual validation, should use `journalEntrySchema` |
| `/api/connections` | PARTIAL | Manual validation, should use `connectionSchema` |
| `/api/user/profile` | NO | Direct JSON parse |

**Recommendation:** Add Zod validation to `/api/journal`, `/api/connections`, `/api/user/profile`.

### Rate Limit Fail-Safe Behavior

**Severity:** P0 (Cost Control)
**Where:** `lib/cache/redis.ts:127-141`

```typescript
export async function acquireLock(...): Promise<boolean> {
  if (!redis || !redisAvailable) {
    // If Redis is unavailable, allow the operation to proceed (no locking)
    console.warn(`[Cache] Redis unavailable, skipping lock for "${lockKey}"`);
    return true;  // FAIL-OPEN!
  }
}
```

**Impact:** If Redis is down:
- All locks return `true` (acquired)
- Multiple requests can hit OpenAI simultaneously for the same resource
- Could cause duplicate DB entries or excessive API costs

**Fix:** For expensive OpenAI endpoints, fail-closed:
```typescript
// In each OpenAI route, check if locking is working
if (!redisAvailable && isExpensiveOperation) {
  return NextResponse.json(
    { error: "Service temporarily unavailable" },
    { status: 503 }
  );
}
```

### Sensitive Data in Logs

**Finding:** Logs do not expose:
- API keys
- User emails
- Personal birth data

Logs show only:
- User IDs (UUIDs)
- Cache keys
- Error messages

**Verdict:** **SECURE**

### Vulnerabilities Summary

| Issue | Severity | Location |
|-------|----------|----------|
| Fail-open locking when Redis down | P0 | `lib/cache/redis.ts:127-141` |
| No Zod validation on profile updates | P1 | `/api/user/profile` |
| No rate limit on protected OpenAI endpoints | P1 | `/api/insights`, `/api/birth-chart` |

---

## 6) OpenAI Abuse / Cost Control Audit

### Endpoint Protection Matrix

| Endpoint | Cooldown | Rate Limit | Idempotency | Output Schema | Token Limit | Verdict |
|----------|----------|------------|-------------|---------------|-------------|---------|
| `/api/public-horoscope` | No | 30/min/IP | No | JSON mode | No | **PARTIAL** |
| `/api/public-tarot` | 60s | Tiered | Yes (requestId) | JSON mode | No | **GOOD** |
| `/api/public-compatibility` | 10s | 10/min/IP | Yes (requestId) | JSON mode | No | **GOOD** |
| `/api/insights` | No | **NONE** | Via cache key | JSON mode | No | **RISK** |
| `/api/connection-insight` | No | **NONE** | No | JSON mode | No | **HIGH RISK** |
| `/api/birth-chart` | No | **NONE** | Via DB check | JSON mode | No | **RISK** |

### Session Cookie Persistence

**Severity:** VERIFIED WORKING
**Where:** `lib/cache/tarotRateLimit.ts`, `app/api/public-tarot/route.ts`

Session cookie is:
- Set with `Set-Cookie` header when `isNewSession: true`
- HttpOnly, SameSite=Lax, Max-Age=30 days
- Used in rate limit key: `${sessionId}:${clientIP}`

**Verdict:** Cannot bypass by clearing localStorage alone.

### Circuit Breaker Requirements

**MISSING - Needs Implementation:**

1. **Per-Day Global Cap**
   - No global daily limit on OpenAI spend
   - Should have: `OPENAI_DAILY_BUDGET_USD=100` with Redis counter

2. **Per-IP Cap (Anonymous)**
   - Public endpoints have per-minute limits but no daily cap
   - User could make 30 req/min * 60 min * 24 hr = 43,200 horoscope requests/day

3. **Per-User Cap (Authenticated)**
   - Protected endpoints have NO rate limits
   - Malicious user could spam `/api/insights` with different timeframes

4. **Fail-Closed When Cache/Lock Unavailable**
   - Currently fail-open (see Security section)

### Recommendation: Add OpenAI Cost Controls

```typescript
// lib/ai/costControl.ts (new file)
const DAILY_BUDGET_USD = parseFloat(process.env.OPENAI_DAILY_BUDGET_USD || "100");
const DAILY_USAGE_KEY = `openai:daily:${new Date().toISOString().split("T")[0]}`;

export async function checkOpenAiBudget(): Promise<{ allowed: boolean; used: number }> {
  const used = await getCache<number>(DAILY_USAGE_KEY) || 0;
  return { allowed: used < DAILY_BUDGET_USD, used };
}

export async function trackOpenAiCost(costUsd: number): Promise<void> {
  const current = await getCache<number>(DAILY_USAGE_KEY) || 0;
  await setCache(DAILY_USAGE_KEY, current + costUsd, 86400);
}
```

### Answer: Are We Safe From OpenAI API Spamming?

**NO - Requires Fixes:**

| Risk | Severity | Fix |
|------|----------|-----|
| No daily budget cap | P0 | Add global daily USD limit |
| Fail-open on Redis failure | P0 | Fail-closed for expensive ops |
| No rate limit on `/api/insights` | P1 | Add per-user hourly limit |
| No rate limit on `/api/birth-chart` | P1 | Add per-user daily limit |
| No rate limit on `/api/connection-insight` | P1 | Add per-user hourly limit |

---

## 7) Bugs & Risk Register

### Probable Runtime Errors

| ID | Issue | Location | Severity | Risk |
|----|-------|----------|----------|------|
| B1 | Lock not released on OpenAI error | `public-tarot/route.ts`, `public-compatibility/route.ts` | P1 | 30s delays for other users |
| B2 | Cooldown set before validation | `public-compatibility/route.ts:103` | Low | Minor UX annoyance |
| B3 | Missing null guard on drawnCards | `public-tarot/route.ts` (if AI returns malformed) | Low | Caught by retry loop |

### Schema Mismatches

| ID | Issue | Client | Server | Impact |
|----|-------|--------|--------|--------|
| S1 | Tarot card ID format | Expects `lib/tarot/cards.ts` IDs | Returns `lib/tarot/cards.ts` IDs | None - consistent |
| S2 | Compatibility content shape | `PublicCompatibilityContent` | AI-generated JSON | Could mismatch if AI hallucinates |

### UI State Desync Risks

| ID | Issue | Location | Trigger |
|----|-------|----------|---------|
| U1 | Double fetch on rapid dropdown change | CompatibilityArena | Fast sign selection changes |
| U2 | Stale horoscope after timeframe change | ZodiacGrid | Rapid timeframe toggle |

**Mitigation:** Both have debounce/lastRef guards.

### Missing Null Guards

| Location | Issue | Fix |
|----------|-------|-----|
| `ZodiacGrid.tsx:186` | `horoscope.summary.split()` | Add `horoscope?.summary?.split()` |
| `CompatibilityArena.tsx` | `content.harmony.summary` | Already has optional chaining |

### "Temporary" Logic That Became Permanent

| Item | Location | Notes |
|------|----------|-------|
| Random password for guest users | `stripe/webhook/route.ts:119` | Users created without proper password flow |
| TODO: Schedule reminder emails | `stripe/webhook/route.ts:170-173` | Commented but not implemented |

---

## 8) Future Development Backlog

### Home

| Task | Dependencies | Complexity |
|------|--------------|------------|
| Add "Your Sign" memory (localStorage) | None | S |
| Pre-warm popular horoscope pairs | Cron job | M |
| Add share buttons to readings | None | S |

### Sanctuary

| Task | Dependencies | Complexity |
|------|--------------|------------|
| Weekly/Monthly insight tabs UI | `/api/insights` supports timeframes | M |
| Birth chart deep dive tabs | Birth chart data stored | L |
| Connection insights UI | `/api/connection-insight` exists | M |

### Settings/Profile

| Task | Dependencies | Complexity |
|------|--------------|------------|
| Add Zod validation to profile PATCH | None | S |
| Password change flow | Supabase auth | M |
| Delete account flow | Stripe cancel, data deletion | M |

### Translation System

| Task | Dependencies | Complexity |
|------|--------------|------------|
| Language selector in settings | Profile.language field | S |
| RTL support for Arabic/Hebrew | Tailwind RTL plugin | M |
| Prompt localization review | AI prompts | M |

### Billing/Stripe

| Task | Dependencies | Complexity |
|------|--------------|------------|
| Customer portal link | Stripe portal config | S |
| Family member management | Profile linking | L |
| Subscription reminder emails | Resend integration | M |

### Journal/Connections

| Task | Dependencies | Complexity |
|------|--------------|------------|
| Journal search/filter | None | M |
| Connection birth chart comparison | Ephemeris calculations | L |
| Export journal entries | None | S |

### Monitoring/Testing

| Task | Dependencies | Complexity |
|------|--------------|------------|
| OpenAI cost dashboard | Usage tracking exists | M |
| Error monitoring (Sentry) | None | S |
| E2E tests (Playwright) | None | L |
| Rate limit monitoring | Redis metrics | M |

---

## 9) Prioritized Fix Plan

### P0 - Security + Cost Containment + Data Integrity

| # | Issue | Location | Fix | Effort |
|---|-------|----------|-----|--------|
| 1 | Add global daily OpenAI budget cap | New: `lib/ai/costControl.ts` | Implement budget tracker with Redis | 2h |
| 2 | Fail-closed for expensive ops when Redis down | `lib/cache/redis.ts` + each route | Add `failClosed` option to `acquireLock` | 2h |
| 3 | Add rate limits to protected OpenAI endpoints | `/api/insights`, `/api/birth-chart`, `/api/connection-insight` | Add `checkRateLimit()` calls | 1h |

### P1 - Correctness + Stability

| # | Issue | Location | Fix | Effort |
|---|-------|----------|-----|--------|
| 4 | Release locks on error | `public-tarot/route.ts`, `public-compatibility/route.ts` | Add lock release to catch blocks | 30m |
| 5 | Add Zod validation to profile updates | `/api/user/profile` | Use `profileUpdateSchema` | 30m |
| 6 | Add Zod validation to journal/connections | `/api/journal`, `/api/connections` | Use existing schemas | 30m |
| 7 | Consolidate tarot card libraries | `lib/tarot.ts`, `lib/tarot/cards.ts` | Merge into single source of truth | 1h |

### P2 - Cleanup + Polish

| # | Issue | Location | Fix | Effort |
|---|-------|----------|-----|--------|
| 8 | Remove dead Tarot/Compatibility placeholders | `ZodiacGrid.tsx` | Delete lines 223-242 | 10m |
| 9 | Extract `scrollToCenter` to shared utility | 3 component files | Create `lib/scroll.ts` | 20m |
| 10 | Delete deprecated Joy schema exports | `lib/validation/schemas.ts` | Remove deprecated aliases | 10m |
| 11 | Move cooldown after validation | `public-compatibility/route.ts` | Reorder cooldown set | 10m |

---

## 10) Verification Checklist

### Build & Lint Commands

```bash
# Type check
npm run build

# Lint
npm run lint

# Check for TypeScript errors without building
npx tsc --noEmit
```

### Manual QA Checklist

#### Public Home Page
- [ ] Select sign → horoscope loads inline (no modal)
- [ ] Change timeframe → horoscope reloads
- [ ] Rapid sign clicks → only one request visible in network
- [ ] Mobile: no horizontal scroll on page
- [ ] Mobile: TogglePills scroll horizontally if overflow

#### Tarot Arena
- [ ] Enter question < 10 chars → validation error
- [ ] Valid question → loading skeleton → cards appear
- [ ] Check `tarot_session` cookie is set (HttpOnly)
- [ ] 5 draws in 1 hour → hourly limit message

#### Compatibility Arena
- [ ] Select both signs → auto-generates
- [ ] Same pair twice → no duplicate fetch
- [ ] During cooldown → shows "Try again in Xs"

### Spam Test Steps

```bash
# Test rate limiting (should get 429 after limit)
for i in {1..35}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://your-app.com/api/public-horoscope \
    -H "Content-Type: application/json" \
    -d '{"sign":"aries","timeframe":"today","timezone":"UTC"}'
done

# Test tarot cooldown (should get cooldown message)
curl -X POST https://your-app.com/api/public-tarot \
  -H "Content-Type: application/json" \
  -d '{"question":"What is my purpose?","spread":1,"requestId":"test-123","timezone":"UTC"}'
# Wait <60s and try again with same session cookie
```

### Cache Hit/Miss Checks

```bash
# First request (should be cache miss)
curl -X POST https://your-app.com/api/public-horoscope \
  -H "Content-Type: application/json" \
  -d '{"sign":"aries","timeframe":"today","timezone":"UTC"}'

# Second request (should be cache hit - check server logs)
curl -X POST https://your-app.com/api/public-horoscope \
  -H "Content-Type: application/json" \
  -d '{"sign":"aries","timeframe":"today","timezone":"UTC"}'

# Server logs should show:
# [PublicHoroscope] Cache miss for publicHoroscope:v1:p2:aries:today:day:2024-12-15:en
# [PublicHoroscope] Cache hit for publicHoroscope:v1:p2:aries:today:day:2024-12-15:en
```

### Generate-Once-Forever Check (Compatibility)

```sql
-- In Supabase SQL editor:
-- Check that pair_key is unique and alphabetically sorted
SELECT pair_key, sign_a, sign_b, created_at
FROM public_compatibility
ORDER BY created_at DESC
LIMIT 10;

-- Verify no duplicate pairs exist
SELECT pair_key, COUNT(*)
FROM public_compatibility
GROUP BY pair_key
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

---

## Summary

### Critical Issues (P0)
1. **No global OpenAI budget cap** - could rack up unlimited costs
2. **Fail-open locking** - duplicate API calls when Redis is down
3. **No rate limits on protected OpenAI endpoints** - authenticated users can spam

### Recommended Next Steps
1. Implement P0 fixes before next production deploy
2. Add error monitoring (Sentry) to catch issues in production
3. Set up Redis metrics dashboard to monitor rate limiting
4. Review OpenAI costs weekly until budget cap is in place

### Code Quality Score
- **Security:** 7/10 (good RLS, needs rate limits on protected routes)
- **Cost Control:** 5/10 (public routes protected, protected routes vulnerable)
- **Maintainability:** 8/10 (good structure, some duplication)
- **Overall:** 7/10 - Production-ready with P0 fixes

---

*Generated: December 15, 2024*
