# Solara Cleanup Checklist

**Version:** 1.0
**Date:** 2026-01-01

---

## Priority Legend

| Priority | Timeline | Criteria |
|----------|----------|----------|
| P0 | Before next deploy | Security, payment, or data integrity |
| P1 | This sprint | High-impact code quality |
| P2 | Backlog | Tech debt, nice-to-have |

---

## P0 - Immediate (Before Next Deploy)

### P0-1. Fix OpenAI Model Name Defaults

**Severity:** HIGH
**Evidence:** `lib/openai/client.ts:20-39`
```typescript
export const OPENAI_MODELS = {
  dailyInsights: process.env.OPENAI_DAILY_INSIGHTS_MODEL || "gpt-4.1-mini",  // INVALID
  yearlyInsights: process.env.OPENAI_YEARLY_INSIGHTS_MODEL || "gpt-5.1",     // INVALID
  birthChart: process.env.OPENAI_BIRTHCHART_MODEL || "gpt-5.1",              // INVALID
  horoscope: process.env.OPENAI_HOROSCOPE_MODEL || "gpt-4.1-mini",           // INVALID
  // ...
};
```

**Also update:** `lib/ai/pricing.ts:13-34` - Remove invalid model entries from pricing table

**Fix:**
```typescript
export const OPENAI_MODELS = {
  dailyInsights: process.env.OPENAI_DAILY_INSIGHTS_MODEL || "gpt-4o-mini",
  yearlyInsights: process.env.OPENAI_YEARLY_INSIGHTS_MODEL || "gpt-4o",
  birthChart: process.env.OPENAI_BIRTHCHART_MODEL || "gpt-4o",
  horoscope: process.env.OPENAI_HOROSCOPE_MODEL || "gpt-4o-mini",
  connectionBrief: process.env.OPENAI_CONNECTION_BRIEF_MODEL || "gpt-4o-mini",
  deep: process.env.OPENAI_DEEP_MODEL || "gpt-4o",
  fast: process.env.OPENAI_FAST_MODEL || "gpt-4o-mini",
};
```

**Test:** Verify API calls succeed without env overrides

- [ ] Update `lib/openai/client.ts`
- [ ] Update `lib/ai/pricing.ts`
- [ ] Test insights generation
- [ ] Test birth chart generation

---

### P0-2. Add Stripe Key Validation in Production

**Severity:** HIGH
**Evidence:** `lib/stripe/client.ts:3-12`
```typescript
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY is not set; Stripe client will be created with an empty key.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  typescript: true,
});
```

**Fix:**
```typescript
if (!process.env.STRIPE_SECRET_KEY) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("STRIPE_SECRET_KEY is required in production");
  }
  console.warn("STRIPE_SECRET_KEY not set - Stripe payments disabled in development");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  typescript: true,
});
```

**Test:** Verify build fails in production mode without key

- [ ] Update `lib/stripe/client.ts`
- [ ] Test local build without key
- [ ] Test production build without key (should fail)

---

### P0-3. Fix Server-Side Timezone Detection

**Severity:** MEDIUM
**Evidence:** `app/auth/callback/route.ts:106-107`
```typescript
// Detect timezone from request headers if possible
const timezone = Intl.DateTimeFormat().resolvedOptions?.().timeZone || "America/Los_Angeles";
```

**Problem:** `Intl.DateTimeFormat()` returns server timezone (UTC on Vercel/Render), not user's

**Fix Options:**
1. Remove server-side detection, require user to set during onboarding
2. Use IP-based geolocation (via Cloudflare headers or external API)
3. Store timezone in cookie from client-side before OAuth

**Recommended Fix:**
```typescript
// Remove timezone detection - let onboarding handle it
const { error: insertError } = await supabase.from("profiles").insert({
  id: data.user.id,
  email: data.user.email || "",
  timezone: null,  // Will be set during onboarding
  language: "en",
  is_onboarded: false,
  // ...
});
```

- [ ] Update `app/auth/callback/route.ts`
- [ ] Verify onboarding requires timezone
- [ ] Test OAuth flow end-to-end

---

## P1 - This Sprint

### P1-1. Consolidate Supabase Admin Clients

**Evidence:**
- `lib/supabase/server.ts:51-66` - `createAdminSupabaseClient()`
- `lib/supabase/service.ts:20-38` - `createServiceSupabaseClient()`

**Usages of service.ts:**
```bash
$ grep -r "createServiceSupabaseClient" lib/ app/
# (run to identify all usages)
```

**Fix:** Delete `lib/supabase/service.ts` and update imports to use `createAdminSupabaseClient`

- [ ] Identify all `createServiceSupabaseClient` usages
- [ ] Update imports to `createAdminSupabaseClient`
- [ ] Delete `lib/supabase/service.ts`
- [ ] Run tests

---

### P1-2. Add Missing Security Tests

**Evidence:** No tests for these critical security functions:

| Function | File | Line | Test Needed |
|----------|------|------|-------------|
| `constructEvent` | `app/api/stripe/webhook/route.ts` | 106-120 | Signature rejection |
| `acquireLockFailClosed` | `lib/cache/redis.ts` | 221-240 | Fail-closed behavior |
| `ALLOWED_NEXT` | `app/auth/callback/route.ts` | 220-238 | Open redirect rejection |

**Tests to create:**
```
__tests__/payments/webhook-security.test.ts
__tests__/infrastructure/redis-failclosed.test.ts
__tests__/auth/callback-security.test.ts
```

- [ ] Create `webhook-security.test.ts`
- [ ] Create `redis-failclosed.test.ts`
- [ ] Create `callback-security.test.ts`
- [ ] Run full test suite

---

### P1-3. Fix localhost:3000 Fallbacks

**Evidence:**
- `lib/url/base.ts:29-31`
- `lib/url/base.ts:41-43`
- `app/api/insights/route.ts:194`
- `app/api/stripe/webhook/route.ts:393-397`

**Fix:** Add production validation

```typescript
// lib/url/base.ts
export function getServerBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL is required in production");
  }
  return url || "http://localhost:3000";
}
```

- [ ] Update `lib/url/base.ts`
- [ ] Update all direct `process.env.NEXT_PUBLIC_SITE_URL` usages to use helper
- [ ] Test in production mode

---

### P1-4. Add Encryption Key Validation at Startup

**Evidence:** `lib/social/crypto.ts:18-35`
Key is only validated on first use, not at startup.

**Fix:** Add module-level validation
```typescript
// At module level in lib/social/crypto.ts
if (process.env.SOCIAL_TOKEN_ENCRYPTION_KEY) {
  const keyBuffer = Buffer.from(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY, "base64");
  if (keyBuffer.length !== 32) {
    const error = `SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes. Got ${keyBuffer.length} bytes.`;
    console.error(error);
    if (process.env.NODE_ENV === "production") {
      throw new Error(error);
    }
  }
}
```

- [ ] Update `lib/social/crypto.ts`
- [ ] Test with invalid key length
- [ ] Test production build with invalid key (should fail)

---

## P2 - Backlog

### P2-1. Remove X OAuth Dead Code

**Evidence:** `lib/oauth/providers/x.ts` - 231 lines of disabled code
```typescript
/**
 * ============================================================================
 * STATUS: DISABLED - Requires X Basic tier ($100/month)
 * ============================================================================
 */
export function isXOAuthEnabled(): boolean {
  return process.env.X_OAUTH_ENABLED?.toLowerCase() === "true";
}
```

**Options:**
1. Move to `lib/oauth/providers/_disabled/x.ts`
2. Delete and restore from git when needed
3. Keep but add clearer documentation

- [ ] Decide on approach
- [ ] Execute removal/move
- [ ] Update any references

---

### P2-2. Clean Up Week/Month Timeframe Code

**Evidence:** Week/month disabled but code remains:

`app/api/insights/route.ts:105-114`:
```typescript
const ALLOWED_TIMEFRAMES = ["today", "year"];
if (!ALLOWED_TIMEFRAMES.includes(timeframe)) {
  return createApiErrorResponse({...});
}
```

But `types/index.ts:89`:
```typescript
export type Timeframe = "today" | "week" | "month" | "year";  // Still includes week/month
```

And `app/api/insights/route.ts:48-60`:
```typescript
function getTtlSeconds(timeframe: string): number {
  switch (timeframe) {
    case "week": return 864000;   // Dead code
    case "month": return 3456000; // Dead code
```

- [ ] Update `Timeframe` type to only include "today" | "year"
- [ ] Remove week/month cases from `getTtlSeconds`
- [ ] Search for other week/month references
- [ ] Run type check

---

### P2-3. Implement Structured Logging

**Evidence:** Console logging throughout:
- `lib/cache/redis.ts:50-55` - Redis connection logs
- `app/api/stripe/webhook/route.ts:122` - Webhook event logs
- `app/api/insights/route.ts:273` - Cache miss logs

**Recommendation:** Use pino with log levels
```typescript
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty" }
    : undefined,
});
```

- [ ] Add pino dependency
- [ ] Create logger utility
- [ ] Replace console.log/warn/error calls
- [ ] Configure log levels per environment

---

### P2-4. Fix ESLint Warnings

**Evidence:** 7 warnings from `npm run lint`:

```
app/(auth)/onboarding/page.tsx:113:6
  - useEffect missing dependency: 'saveProfile'

app/(protected)/sanctuary/birth-chart/page.tsx:231:6
  - useEffect missing dependency: 'fetchBirthChart'

app/(protected)/sanctuary/connections/page.tsx:158:6
  - useEffect missing dependency: 'generateBriefForConnection'

app/(protected)/sanctuary/page.tsx:247:6
  - useCallback missing dependency: 'loadJournalEntry'

app/(protected)/sanctuary/page.tsx:315:6
  - useEffect missing dependency: 'loadInsight'

app/(protected)/sanctuary/page.tsx:543:23
  - Using <img> instead of next/image

components/shared/PlacePicker.tsx:90:6
  - useEffect missing dependency: 'query'
```

- [ ] Fix each warning or add eslint-disable with justification
- [ ] Run `npm run lint` to verify clean

---

### P2-5. Remove Legacy OPENAI_MODELS Entries

**Evidence:** `lib/openai/client.ts:36-38`
```typescript
// Legacy: kept for backward compatibility, maps to dailyInsights
insights: process.env.OPENAI_DAILY_INSIGHTS_MODEL || "gpt-4.1-mini",
// Legacy: placements (not used for AI calls)
placements: process.env.OPENAI_PLACEMENTS_MODEL || "gpt-5.1",
```

- [ ] Search for usages: `grep -r "OPENAI_MODELS.insights" .`
- [ ] Search for usages: `grep -r "OPENAI_MODELS.placements" .`
- [ ] Update callers if any
- [ ] Remove legacy entries

---

## Files to Delete

| File | Reason | Verification |
|------|--------|--------------|
| `scripts/add-asian-translations.js` | One-time migration script | Check git history |
| `scripts/add-final-translations.js` | One-time migration script | Check git history |
| `scripts/add-numerology-translations.js` | One-time migration script | Check git history |
| `scripts/add-remaining-translations.js` | One-time migration script | Check git history |
| `lib/supabase/service.ts` | Duplicate of server.ts admin client | After P1-1 |

**Current state:**
```bash
ls scripts/
# add-asian-translations.js
# add-final-translations.js
# add-numerology-translations.js
# add-remaining-translations.js
```

- [ ] Delete `scripts/add-*.js` files
- [ ] Verify no references remain
- [ ] Commit deletion

---

## Database Cleanup

### Review Unused Columns

| Table | Column | Question |
|-------|--------|----------|
| `profiles` | `location_for_charity` | Is this used? |
| `profiles` | `latitude`, `longitude` | Duplicate of `birth_lat`, `birth_lon`? |

```sql
-- Check if location_for_charity is populated
SELECT COUNT(*) FROM profiles WHERE location_for_charity IS NOT NULL;

-- Check if latitude/longitude are used differently than birth_lat/birth_lon
SELECT COUNT(*) FROM profiles
WHERE latitude IS NOT NULL
  AND (latitude != birth_lat OR longitude != birth_lon);
```

- [ ] Run queries to verify usage
- [ ] Document or remove unused columns

---

## Dependency Audit

### Run Security Audit
```bash
npm audit
```

### Check for Updates
```bash
npm outdated
```

**Key dependencies to watch:**
- `next`: Currently 15.0.0
- `@supabase/ssr`: Currently 0.8.0
- `stripe`: Currently 20.0.0
- `openai`: Currently 6.10.0

- [ ] Run `npm audit fix`
- [ ] Review major version updates
- [ ] Test after updates

---

## Environment Variable Documentation

### Missing from .env.example

Verify `.env.example` includes all required variables:

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
OPENAI_API_KEY=
NEXT_PUBLIC_SITE_URL=

# Optional
REDIS_URL=
OPENAI_DAILY_BUDGET_USD=100
OPENAI_BUDGET_FAIL_MODE=closed
META_CLIENT_ID=
META_CLIENT_SECRET=
SOCIAL_TOKEN_ENCRYPTION_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
CRON_SECRET=

# Development only (NEVER in production)
DEV_PAYWALL_BYPASS=false
```

- [ ] Compare `.env.example` to actual usage
- [ ] Add missing variables
- [ ] Add comments explaining each variable

---

## Verification Checklist

After completing P0 items:

- [ ] `npm run lint` - No errors
- [ ] `npm run build` - Success
- [ ] `npm run test` - All pass
- [ ] Test Stripe webhook with test events
- [ ] Test OAuth login flow
- [ ] Test insights generation
- [ ] Verify production env vars are set

---

## Progress Tracking

### Week of 2026-01-01

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| P0-1 OpenAI models | P0 | Not Started | |
| P0-2 Stripe validation | P0 | Not Started | |
| P0-3 Timezone fix | P0 | Not Started | |
| P1-1 Consolidate clients | P1 | Not Started | |
| P1-2 Security tests | P1 | Not Started | |

---

*Cleanup checklist for Solara Insights*
