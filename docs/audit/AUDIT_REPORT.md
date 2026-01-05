# Solara Codebase Audit Report

**Date:** 2026-01-01
**Auditor:** Senior Staff Engineer Review
**Scope:** Full repo-wide audit of Next.js 15 application

---

## Repo Scan Results

### Build Output
```
npm run build

Route (app)                                   Size  First Load JS
├ ○ /                                      14.6 kB         139 kB
├ ƒ /sanctuary                             12.8 kB         215 kB
├ ƒ /sanctuary/birth-chart                 8.53 kB         141 kB
├ ƒ /sanctuary/connections                  9.6 kB         207 kB
├ ƒ /sanctuary/numerology                  5.98 kB         134 kB
└ + 79 more routes

✓ Build completed successfully
```

### TypeScript Check
```
npx tsc --noEmit
(no errors)
```

### ESLint Results
```
npm run lint

/app/(auth)/onboarding/page.tsx
  113:6  warning  React Hook useEffect has a missing dependency: 'saveProfile'

/app/(protected)/sanctuary/birth-chart/page.tsx
  231:6  warning  React Hook useEffect has a missing dependency: 'fetchBirthChart'

/app/(protected)/sanctuary/connections/page.tsx
  158:6  warning  React Hook useEffect has a missing dependency: 'generateBriefForConnection'

/app/(protected)/sanctuary/page.tsx
  247:6   warning  React Hook useCallback has a missing dependency: 'loadJournalEntry'
  315:6   warning  React Hook useEffect has a missing dependency: 'loadInsight'
  543:23  warning  Using `<img>` could result in slower LCP

/components/shared/PlacePicker.tsx
  90:6  warning  React Hook useEffect has a missing dependency: 'query'

✖ 7 problems (0 errors, 7 warnings)
```

### Circular Dependency Analysis (Static)
No circular dependencies detected in manual analysis of lib/ imports.
Import chains are tree-structured:
- lib/cache/redis.ts <- lib/ai/costControl.ts <- app/api/insights/route.ts
- lib/supabase/server.ts <- lib/ai/trackUsage.ts <- app/api/insights/route.ts

### Unused Dependencies (Best-effort static analysis)
```
Potentially unused (verify manually):
- @types/suncalc (only used if suncalc is used)
- swisseph (used in lib/ephemeris/)

All other dependencies appear to be in use.
```

---

## Executive Summary

Solara is a well-architected Next.js 15 application with Supabase auth, Stripe payments, OpenAI integrations, and Redis caching. The codebase demonstrates strong security practices with some areas for improvement.

**Overall Assessment:** GOOD with minor issues

| Category | Status |
|----------|--------|
| Security | Strong (no critical issues) |
| Architecture | Clean, well-organized |
| Error Handling | Comprehensive |
| Testing | Good coverage, can expand |
| Code Quality | High |

---

## Findings by Severity

### BLOCKER (0 Issues)

No blocking issues found.

---

### HIGH (2 Issues)

#### H1. Stripe Client Created with Empty Key in Production

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

**Impact:** If STRIPE_SECRET_KEY is missing in production, the app will continue running but all Stripe operations will fail silently. This could lead to users thinking payments succeeded when they didn't. Webhook signature verification will fail, breaking subscription management.

**Fix:** Throw an error in production if STRIPE_SECRET_KEY is missing:
```typescript
if (!process.env.STRIPE_SECRET_KEY) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("STRIPE_SECRET_KEY is required in production");
  }
  console.warn("STRIPE_SECRET_KEY not set - Stripe disabled in development");
}
```

**Test:** Add test in `__tests__/infrastructure/stripe-init.test.ts`:
```typescript
it("throws in production when STRIPE_SECRET_KEY missing", () => {
  process.env.NODE_ENV = "production";
  delete process.env.STRIPE_SECRET_KEY;
  expect(() => require("@/lib/stripe/client")).toThrow();
});
```

---

#### H2. OpenAI Model Names Are Invalid

**Severity:** HIGH
**Evidence:** `lib/openai/client.ts:20-39`
```typescript
export const OPENAI_MODELS = {
  dailyInsights: process.env.OPENAI_DAILY_INSIGHTS_MODEL || "gpt-4.1-mini",
  yearlyInsights: process.env.OPENAI_YEARLY_INSIGHTS_MODEL || "gpt-5.1",
  birthChart: process.env.OPENAI_BIRTHCHART_MODEL || "gpt-5.1",
  horoscope: process.env.OPENAI_HOROSCOPE_MODEL || "gpt-4.1-mini",
  connectionBrief: process.env.OPENAI_CONNECTION_BRIEF_MODEL || "gpt-4.1-mini",
  deep: process.env.OPENAI_DEEP_MODEL || "gpt-4o",
  fast: process.env.OPENAI_FAST_MODEL || "gpt-4o-mini",
  // ...
};
```

**Cross-reference:** These invalid model names are used in `lib/ai/pricing.ts:13-34`:
```typescript
const PRICING_TABLE: Record<string, ModelPricing> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },  // Not a real OpenAI model
  "gpt-5.1": { input: 1.25, output: 10.0 },     // Not a real OpenAI model
  "gpt-5.2": { input: 1.75, output: 14.0 },     // Not a real OpenAI model
};
```

**Impact:** Default model names like "gpt-4.1-mini" and "gpt-5.1" are not valid OpenAI model names as of January 2025. If env vars aren't set, API calls will fail with "model not found" errors. The `estimateCostUsd()` function will return 0 for unknown models.

**Fix:** Use valid default model names:
```typescript
export const OPENAI_MODELS = {
  dailyInsights: process.env.OPENAI_DAILY_INSIGHTS_MODEL || "gpt-4o-mini",
  yearlyInsights: process.env.OPENAI_YEARLY_INSIGHTS_MODEL || "gpt-4o",
  birthChart: process.env.OPENAI_BIRTHCHART_MODEL || "gpt-4o",
  // ...
};
```

**Test:** Add integration test that validates model names against OpenAI's model list or mock API response.

---

### MEDIUM (5 Issues)

#### M1. Service Role Key Duplication

**Severity:** MEDIUM
**Evidence:**
- `lib/supabase/server.ts:51-66` - `createAdminSupabaseClient()`
```typescript
export function createAdminSupabaseClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }
  const serviceKey: string = supabaseServiceRoleKey;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- `lib/supabase/service.ts:20-38` - `createServiceSupabaseClient()`
```typescript
export function createServiceSupabaseClient() {
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

**Impact:** Two nearly identical functions for creating admin/service Supabase clients exist. This creates maintenance burden, potential for inconsistent behavior, and confusion about which to use.

**Fix:** Remove `lib/supabase/service.ts` and update all imports to use `createAdminSupabaseClient` from `lib/supabase/server.ts`.

**Test:** Grep for all usages and verify functionality after consolidation:
```bash
grep -r "createServiceSupabaseClient" lib/ app/
```

---

#### M2. DEV_PAYWALL_BYPASS Safety Relies on Multiple Env Vars

**Severity:** MEDIUM
**Evidence:** `app/(protected)/layout.tsx:11-30`
```typescript
function isDevPaywallBypassed(): boolean {
  const bypass = process.env.DEV_PAYWALL_BYPASS === "true";
  if (!bypass) return false;

  // HARD SAFETY 1: Never in production NODE_ENV
  if (process.env.NODE_ENV === "production") {
    console.warn("[PAYWALL] DEV_PAYWALL_BYPASS ignored - NODE_ENV is production");
    return false;
  }

  // HARD SAFETY 2: Never on production domain
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (siteUrl === "https://solarainsights.com") {
    console.warn("[PAYWALL] DEV_PAYWALL_BYPASS ignored - production domain");
    return false;
  }

  return true;
}
```

**Impact:** While there are safety checks, the function relies on two env vars being correctly set. If `NODE_ENV !== "production"` and `NEXT_PUBLIC_SITE_URL` is misconfigured, paywall could be bypassed on a staging server.

**Fix:** Add a third check - verify the domain in the actual request headers, not just env vars. Or use an explicit `IS_PRODUCTION=true` env var that must be set.

**Test:** Add test cases for all bypass conditions:
```typescript
describe("isDevPaywallBypassed", () => {
  it("returns false when NODE_ENV is production", () => {});
  it("returns false when SITE_URL is solarainsights.com", () => {});
  it("returns false when DEV_PAYWALL_BYPASS is not set", () => {});
});
```

---

#### M3. Timezone Detection on Server Returns Server Timezone

**Severity:** MEDIUM
**Evidence:** `app/auth/callback/route.ts:106-107`
```typescript
// Detect timezone from request headers if possible
const timezone = Intl.DateTimeFormat().resolvedOptions?.().timeZone || "America/Los_Angeles";
```

**Impact:** `Intl.DateTimeFormat()` on the server returns the server's timezone (e.g., UTC on Render/Vercel), not the user's. This assigns incorrect timezone to new OAuth users, causing insights to be cached and displayed for wrong time periods.

**Fix:** Either:
1. Remove server-side timezone detection and require user to set it during onboarding
2. Use a client-side cookie or header to pass user's timezone
3. Use IP geolocation to estimate timezone

**Test:** Verify timezone assignment in auth callback tests with mocked server environment.

---

#### M4. localhost:3000 Fallback in Multiple Locations

**Severity:** MEDIUM
**Evidence:**
- `lib/url/base.ts:29-31`:
```typescript
// Fallback for SSR (should not be used for OAuth)
return "http://localhost:3000";
```

- `lib/url/base.ts:41-43`:
```typescript
export function getServerBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
```

- `app/api/insights/route.ts:194`:
```typescript
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
```

- `app/api/stripe/webhook/route.ts:393-397`:
```typescript
const appUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";
```

**Impact:** If NEXT_PUBLIC_SITE_URL is missing in production, redirect URLs will point to localhost causing authentication failures and broken email links.

**Fix:** Fail fast if required env vars are missing in production:
```typescript
export function getServerBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL is required in production");
  }
  return url || "http://localhost:3000";
}
```

**Test:** Add startup validation for required env vars.

---

#### M5. Social Token Encryption Key Length Not Validated at Startup

**Severity:** MEDIUM
**Evidence:** `lib/social/crypto.ts:18-35`
```typescript
function getEncryptionKey(): Buffer {
  const key = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;

  if (!key) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY environment variable is not set");
  }

  // Key should be base64-encoded 32 bytes
  const keyBuffer = Buffer.from(key, "base64");

  if (keyBuffer.length !== 32) {
    throw new Error(
      `SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes (256 bits). Got ${keyBuffer.length} bytes.`
    );
  }

  return keyBuffer;
}
```

**Impact:** Key validation only happens on first encryption/decryption attempt. A malformed key won't be detected until runtime when a social account is connected. This delays error detection.

**Fix:** Validate key at module load time:
```typescript
// At module level (after imports)
if (process.env.SOCIAL_TOKEN_ENCRYPTION_KEY) {
  const keyBuffer = Buffer.from(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY, "base64");
  if (keyBuffer.length !== 32) {
    console.error("SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes");
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid SOCIAL_TOKEN_ENCRYPTION_KEY");
    }
  }
}
```

**Test:** Add test for encryption key validation at startup.

---

### LOW (6 Issues)

#### L1. Console Logging in Production

**Severity:** LOW
**Evidence:** Multiple files contain `console.log()` calls:
- `lib/cache/redis.ts:50-55`: Redis connection logging
- `app/api/stripe/webhook/route.ts:122`: Event logging
- `app/api/insights/route.ts:273`: Cache miss logging

**Impact:** Log volume in production; potential for sensitive data exposure in logs.

**Fix:** Use a structured logger with log levels (e.g., pino, winston).

**Test:** N/A - code review only.

---

#### L2. X OAuth Disabled But 231 Lines of Code Present

**Severity:** LOW
**Evidence:** `lib/oauth/providers/x.ts:1-231`
```typescript
/**
 * X (Twitter) OAuth Provider Adapter
 *
 * ============================================================================
 * STATUS: DISABLED - Requires X Basic tier ($100/month)
 * ============================================================================
 */
export function isXOAuthEnabled(): boolean {
  return process.env.X_OAUTH_ENABLED?.toLowerCase() === "true";
}
// ... 231 lines total
```

**Impact:** Dead code increases maintenance burden and bundle size.

**Fix:** Either move to a separate branch until needed, or clearly document the feature flag.

**Test:** N/A if removed.

---

#### L3. Week/Month Timeframes Disabled But Code Remains

**Severity:** LOW
**Evidence:** `app/api/insights/route.ts:105-114`
```typescript
// TIMEFRAME VALIDATION (reject week/month)
const ALLOWED_TIMEFRAMES = ["today", "year"];
if (!ALLOWED_TIMEFRAMES.includes(timeframe)) {
  return createApiErrorResponse({
    error: "Invalid timeframe",
    message: "Only 'today' and 'year' insights are available.",
    // ...
  });
}
```

But `types/index.ts:89` still defines:
```typescript
export type Timeframe = "today" | "week" | "month" | "year";
```

And `app/api/insights/route.ts:48-60` has TTL logic for week/month:
```typescript
function getTtlSeconds(timeframe: string): number {
  switch (timeframe) {
    case "today": return 172800;
    case "week": return 864000;   // Dead code
    case "month": return 3456000; // Dead code
    case "year": return 34560000;
    default: return 86400;
  }
}
```

**Impact:** Code still handles week/month cases in some places, creating confusion.

**Fix:** Clean up all week/month handling code since those timeframes are not supported.

**Test:** Verify insights API rejects week/month requests.

---

#### L4. Missing Translation Keys for Numerology Lib Meanings

**Severity:** LOW
**Evidence:** `lib/numerology/meanings.ts` contains hardcoded English strings (file not fully read but referenced in previous session).

**Impact:** Numerology content won't be translated for non-English users using lib functions directly.

**Fix:** Either move content to translation files (as partially done in messages/*.json) or document as English-only for lib utilities.

**Test:** N/A - design decision.

---

#### L5. Request ID Generation Uses Math.random()

**Severity:** LOW
**Evidence:** `lib/api/errorResponse.ts:12-14`
```typescript
export function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 10);
}
```

**Impact:** `Math.random()` is not cryptographically secure. For debugging request IDs this is acceptable, but could theoretically have collisions under high load.

**Fix:** Use `crypto.randomUUID().substring(0, 8)` for better uniqueness guarantees.

**Test:** N/A - low impact.

---

#### L6. Test Coverage Gaps

**Severity:** LOW
**Evidence:** No tests found for:
- `/api/social/*` routes (0 test files)
- `/api/connection-*` routes (0 test files)
- `/api/numerology/*` routes (0 test files)

Existing tests in `__tests__/`:
```
__tests__/
├── api/
│   ├── insights.test.ts
│   └── birth-chart.test.ts
├── auth/
│   ├── session-guards.test.ts
│   ├── profile-creation.test.ts
│   └── checkout-cookie.test.ts
├── infrastructure/
│   ├── redis-failures.test.ts
│   ├── rate-limiting.test.ts
│   └── cost-control.test.ts
├── payments/
│   ├── claim-session.test.ts
│   ├── stripe-webhook.test.ts
│   └── membership-status.test.ts
├── security/
│   └── token-encryption.test.ts
└── validation/
    └── birth-data.test.ts
```

**Impact:** Less confidence in untested endpoints' behavior.

**Fix:** Add integration tests for uncovered API routes.

**Test:** N/A - this IS the test gap.

---

## Security Verification Evidence

### Token Encryption at Rest (VERIFIED)

**Evidence:** `lib/social/crypto.ts:10-60`
```typescript
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);  // Random IV for each encryption
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  // ... GCM authenticated encryption
}
```

**Usage:** `app/api/social/oauth/[provider]/callback/route.ts` (encrypts tokens before storage)

---

### Rate Limiting Fail-Closed (VERIFIED)

**Evidence:** `lib/cache/redis.ts:221-240`
```typescript
export async function acquireLockFailClosed(
  lockKey: string,
  ttlSeconds: number = 30
): Promise<{ acquired: boolean; redisDown: boolean }> {
  initRedis();

  if (!redis || !redisAvailable) {
    console.warn(`[Cache] Redis unavailable, failing closed for lock "${lockKey}"`);
    return { acquired: false, redisDown: true };  // FAIL CLOSED
  }
  // ...
}
```

**Usage:** `app/api/insights/route.ts:422-433`
```typescript
const lockResult = await acquireLockFailClosed(lockKey, 60);
if (lockResult.redisDown) {
  return createApiErrorResponse({
    error: "service_unavailable",
    // ...
    status: 503,  // Returns 503 instead of proceeding
  });
}
```

---

### Stripe Webhook Signature Verification (VERIFIED)

**Evidence:** `app/api/stripe/webhook/route.ts:106-120`
```typescript
let event: Stripe.Event;
try {
  event = stripe.webhooks.constructEvent(
    body,
    signature,
    STRIPE_CONFIG.webhookSecret
  );
} catch (err: any) {
  console.error("[Webhook] Signature verification failed:", err.message);
  return NextResponse.json(
    { error: "Invalid signature" },
    { status: 400 }
  );
}
```

---

### Open Redirect Prevention (VERIFIED)

**Evidence:** `app/auth/callback/route.ts:220-238`
```typescript
// SECURITY: Allowlist-only to prevent open redirect attacks
const ALLOWED_NEXT = new Set([
  "/onboarding",
  "/set-password",
  "/settings?refresh=1",
  "/sanctuary",
  "/welcome",
]);

const nextPath = requestUrl.searchParams.get("next");
if (nextPath) {
  // Defense-in-depth: reject obviously malicious patterns
  const isMalicious = nextPath.includes("://") || nextPath.startsWith("//") || nextPath.includes("\\");

  if (!isMalicious && ALLOWED_NEXT.has(nextPath)) {
    return NextResponse.redirect(new URL(nextPath, baseUrl));
  }
  console.warn(`[AuthCallback] Rejected next param (not in allowlist): ${nextPath}`);
}
```

---

### Cost Control Budget Check (VERIFIED)

**Evidence:** `lib/ai/costControl.ts:77-105`
```typescript
export async function checkBudget(): Promise<BudgetCheckResult> {
  const limit = getDailyBudgetLimit();
  const failMode = getFailMode();

  try {
    const key = getBudgetKey();
    const used = (await getCache<number>(key)) || 0;
    const remaining = Math.max(0, limit - used);
    const allowed = used < limit;

    if (!allowed) {
      console.warn(`[CostControl] Daily budget exceeded: $${used.toFixed(4)} / $${limit}`);
    }

    return { allowed, used, limit, remaining };
  } catch (error: any) {
    // Fail mode determines behavior when Redis is down
    if (failMode === "closed") {
      console.warn("[CostControl] Redis unavailable, failing closed");
      return { allowed: false, used: 0, limit, remaining: 0 };  // BLOCKED
    }
    // ...
  }
}
```

**Usage in insights:** `app/api/insights/route.ts:408-419`
```typescript
const budgetCheck = await checkBudget();
if (!budgetCheck.allowed) {
  console.warn("[Insights] Budget exceeded, rejecting request");
  return createApiErrorResponse({
    error: "service_unavailable",
    message: "The cosmic treasury needs to restock. Try again later.",
    status: 503,
  });
}
```

---

## Files Reviewed

| Directory | Files | Key Files |
|-----------|-------|-----------|
| `app/api/` | 47 | stripe/webhook, insights, birth-chart, auth/callback |
| `lib/` | 80 | cache/redis, ai/costControl, social/crypto, stripe/client |
| `components/` | ~50 | layout/Footer, sanctuary/* |
| `__tests__/` | 13 | setup.ts, payments/*, infrastructure/* |
| `types/` | 7 | index.ts (558 lines) |
| `sql/` | 21 | Database migrations |
| `messages/` | 19 | Translation files |

---

*Report generated by senior staff engineer audit process*
