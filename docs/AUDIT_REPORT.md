# Solara Codebase Audit Report

**Date:** 2026-01-01
**Auditor:** Senior Staff Engineer Review
**Scope:** Full repo-wide audit of Next.js 15 application

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

**Evidence:** [lib/stripe/client.ts:3-12](lib/stripe/client.ts#L3-L12)

```typescript
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY is not set; Stripe client will be created with an empty key.");
}
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
```

**Impact:** If STRIPE_SECRET_KEY is missing in production, the app will continue running but all Stripe operations will fail silently. This could lead to users thinking payments succeeded when they didn't.

**Fix:** Throw an error in production if STRIPE_SECRET_KEY is missing:
```typescript
if (!process.env.STRIPE_SECRET_KEY) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("STRIPE_SECRET_KEY is required in production");
  }
  console.warn("STRIPE_SECRET_KEY not set - Stripe disabled in development");
}
```

**Test:** Add test in `__tests__/infrastructure/` to verify Stripe client initialization fails when key is missing in production mode.

---

#### H2. Service Role Key Duplication

**Evidence:**
- [lib/supabase/server.ts:51-66](lib/supabase/server.ts#L51-L66) - `createAdminSupabaseClient()`
- [lib/supabase/service.ts:20-38](lib/supabase/service.ts#L20-L38) - `createServiceSupabaseClient()`

**Impact:** Two nearly identical functions for creating admin/service Supabase clients exist. This creates maintenance burden and potential for inconsistent behavior.

**Fix:** Remove one and alias the other, or consolidate into a single factory function.

**Test:** Ensure all callers use the canonical function after consolidation.

---

### MEDIUM (5 Issues)

#### M1. OpenAI Model Names May Be Invalid

**Evidence:** [lib/openai/client.ts:20-39](lib/openai/client.ts#L20-L39)

```typescript
export const OPENAI_MODELS = {
  dailyInsights: process.env.OPENAI_DAILY_INSIGHTS_MODEL || "gpt-4.1-mini",
  yearlyInsights: process.env.OPENAI_YEARLY_INSIGHTS_MODEL || "gpt-5.1",
```

**Impact:** Default model names like "gpt-4.1-mini" and "gpt-5.1" are not valid OpenAI model names. If env vars aren't set, API calls will fail.

**Fix:** Use valid default model names:
- `gpt-4o-mini` instead of `gpt-4.1-mini`
- `gpt-4o` instead of `gpt-5.1`

**Test:** Add integration test that validates model names against OpenAI's model list.

---

#### M2. DEV_PAYWALL_BYPASS Could Leak to Production

**Evidence:** [app/(protected)/layout.tsx:11-30](app/(protected)/layout.tsx#L11-L30)

```typescript
function isDevPaywallBypassed(): boolean {
  const bypass = process.env.DEV_PAYWALL_BYPASS === "true";
  if (!bypass) return false;
  if (process.env.NODE_ENV === "production") { return false; }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (siteUrl === "https://solarainsights.com") { return false; }
  return true;
}
```

**Impact:** While there are safety checks, the function relies on two env vars being correctly set. A misconfiguration could bypass the paywall.

**Fix:** Add a third check - verify the domain in the actual request headers, not just env vars.

**Test:** Add test cases for all bypass conditions including edge cases.

---

#### M3. Timezone Detection on Server May Be Incorrect

**Evidence:** [app/auth/callback/route.ts:106](app/auth/callback/route.ts#L106)

```typescript
const timezone = Intl.DateTimeFormat().resolvedOptions?.().timeZone || "America/Los_Angeles";
```

**Impact:** `Intl.DateTimeFormat()` on the server returns the server's timezone, not the user's. This could assign incorrect timezone to new users.

**Fix:** Either:
1. Remove server-side timezone detection and require user to set it during onboarding
2. Use a client-side cookie or header to pass user's timezone

**Test:** Verify timezone assignment logic in auth callback tests.

---

#### M4. Request ID Generation Not Cryptographically Secure

**Evidence:** [lib/api/errorResponse.ts:12-14](lib/api/errorResponse.ts#L12-L14)

```typescript
export function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 10);
}
```

**Impact:** `Math.random()` is not cryptographically secure. For debugging purposes this is acceptable, but could be improved.

**Fix:** Consider using `crypto.randomUUID().substring(0, 8)` for better uniqueness guarantees.

**Test:** No immediate test needed - low impact.

---

#### M5. Social Token Encryption Key Validation Missing

**Evidence:** Social tokens are encrypted using `SOCIAL_TOKEN_ENCRYPTION_KEY` but no validation exists to ensure the key is the correct length or format.

**Impact:** If the encryption key is malformed, tokens could be improperly encrypted or decryption could silently fail.

**Fix:** Add validation at startup:
```typescript
const key = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
if (key && Buffer.from(key, 'base64').length !== 32) {
  throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes base64 encoded");
}
```

**Test:** Add test for encryption key validation.

---

### LOW (6 Issues)

#### L1. Console Logging in Production

**Evidence:** Multiple files contain `console.log()` and `console.warn()` that will run in production.

**Impact:** Log volume in production; potential for sensitive data exposure in logs.

**Fix:** Consider using a structured logger with log levels, or conditionally log based on NODE_ENV.

---

#### L2. X OAuth Disabled But Code Present

**Evidence:** [lib/oauth/providers/x.ts](lib/oauth/providers/x.ts) - 231 lines of code for a disabled feature.

**Impact:** Dead code increases maintenance burden.

**Fix:** Either:
1. Move to a separate branch until needed
2. Add clear feature flag documentation

---

#### L3. Hardcoded Fallback URLs

**Evidence:** Multiple API routes fall back to `http://localhost:3000` when env vars are missing.

**Impact:** Could cause redirect issues if NEXT_PUBLIC_SITE_URL is missing.

**Fix:** Fail fast if required env vars are missing in production.

---

#### L4. Week/Month Timeframes Disabled But Not Removed

**Evidence:** [app/api/insights/route.ts:105-114](app/api/insights/route.ts#L105-L114)

```typescript
const ALLOWED_TIMEFRAMES = ["today", "year"];
if (!ALLOWED_TIMEFRAMES.includes(timeframe)) {
  return createApiErrorResponse({...});
}
```

**Impact:** Code still handles week/month cases in some places, creating confusion.

**Fix:** Clean up all week/month handling code since those timeframes are not supported.

---

#### L5. Missing Translation Keys for Numerology Lib Meanings

**Evidence:** [lib/numerology/meanings.ts](lib/numerology/meanings.ts) contains hardcoded English strings that should use translation keys.

**Impact:** Numerology content won't be translated for non-English users.

**Fix:** Either move content to translation files or accept English-only for this content.

---

#### L6. Test Coverage Gaps

**Evidence:** No tests found for:
- `/api/social/*` routes
- `/api/connection-*` routes
- `/api/numerology/*` routes

**Impact:** Less confidence in these endpoints' behavior.

**Fix:** Add integration tests for uncovered API routes.

---

## Security Analysis

### Authentication Flow (SECURE)

- Supabase auth with PKCE for OAuth flows
- Secure cookie handling with `httpOnly`, `secure`, `sameSite`
- Reauth flow has proper intent validation with expiry
- Open redirect protection with allowlist

### Payment Flow (SECURE)

- Stripe webhook signature verification
- Service role client used appropriately for admin operations
- Checkout session claiming has proper user validation

### Data Protection (SECURE)

- Social tokens encrypted at rest
- Service role key only used for server-to-server operations
- RLS properly enforced via user-scoped Supabase client

### Rate Limiting (SECURE)

- Redis-based rate limiting with burst protection
- Fail-closed behavior when Redis is unavailable
- Per-user rate limits for AI endpoints

---

## Recommendations Summary

### Immediate (Before Next Deploy)

1. Fix OpenAI model name defaults
2. Add Stripe key validation in production

### Short-term (This Sprint)

3. Consolidate Supabase admin client functions
4. Add missing API route tests
5. Fix server-side timezone detection

### Long-term (Tech Debt)

6. Remove or properly feature-flag X OAuth code
7. Clean up week/month timeframe handling
8. Implement structured logging

---

## Files Reviewed

| Directory | Files | Purpose |
|-----------|-------|---------|
| `app/api/` | 47 | API routes |
| `lib/` | 80 | Shared utilities |
| `components/` | ~50 | React components |
| `__tests__/` | 13 | Test files |
| `types/` | 7 | TypeScript definitions |
| `sql/` | 21 | Database migrations |

---

*Report generated by senior staff engineer audit process*
