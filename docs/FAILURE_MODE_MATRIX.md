# FAILURE_MODE_MATRIX.md

**Generated:** 2026-01-01
**Scope:** Failure behavior analysis for critical flows under infrastructure failures

---

## CRITICAL FLOWS ANALYZED

1. Auth Callback (`/auth/callback`)
2. Stripe Webhook (`/api/stripe/webhook`)
3. Insights Generation (`/api/insights`)
4. Birth Chart Computation (`/api/birth-chart`)
5. Social Sync (`/api/social/sync`)
6. Cron Prewarm (`/api/cron/prewarm-insights`)

---

## 1. AUTH CALLBACK (`/auth/callback`)

**File:** `app/auth/callback/route.ts`

### Failure Matrix

| Failure Mode | Expected Behavior | Status Code | Retry Strategy | Idempotent? | Evidence |
|--------------|-------------------|-------------|----------------|-------------|----------|
| **Redis Down** | N/A (no Redis used) | N/A | N/A | N/A | No Redis calls in auth callback |
| **Supabase Down** | Redirect to `/sign-in?error=auth_callback_failed` | 302 | Manual retry | Yes | Lines 73-85 |
| **Bad Input (no code)** | Redirect to `/sign-in` | 302 | N/A | Yes | Lines 266-267 |
| **Expired Code** | Redirect to `/sign-in?error=auth_callback_failed` | 302 | User must re-auth | Yes | Lines 73-85 |
| **Timeout** | Request timeout (Next.js default) | 504 | Automatic retry | Yes | No explicit timeout |
| **Profile Creation Fails** | Log warning, continue | 302 | Silent degradation | Yes | Lines 120-122 |

### Code Evidence

```typescript
// Lines 73-85: Supabase code exchange failure
if (error) {
  console.error("[AuthCallback] Code exchange failed:", error.message);
  if (type === "recovery") {
    return NextResponse.redirect(
      new URL("/reset-password?error=expired", baseUrl)
    );
  }
  return NextResponse.redirect(
    new URL("/sign-in?error=auth_callback_failed", baseUrl)
  );
}

// Lines 120-122: Profile creation failure (graceful)
if (insertError) {
  console.error(`[AuthCallback] Profile creation failed:`, insertError.message);
  // Continue anyway - SettingsProvider will create profile as fallback
}
```

### Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Graceful Degradation | GOOD | Falls back to redirect with error params |
| Error Visibility | GOOD | Logs errors before redirecting |
| User Experience | GOOD | Clear error states via query params |
| Idempotency | GOOD | Repeated calls are safe |

---

## 2. STRIPE WEBHOOK (`/api/stripe/webhook`)

**File:** `app/api/stripe/webhook/route.ts`

### Failure Matrix

| Failure Mode | Expected Behavior | Status Code | Retry Strategy | Idempotent? | Evidence |
|--------------|-------------------|-------------|----------------|-------------|----------|
| **Redis Down** | N/A (no Redis used) | N/A | N/A | N/A | Webhook doesn't use Redis |
| **Supabase Down** | Return 500, Stripe retries | 500 | Stripe automatic (3 days) | Partial | Lines 296-300 |
| **OpenAI Down** | N/A | N/A | N/A | N/A | No OpenAI calls |
| **Stripe Down** | Webhook never arrives | N/A | N/A | N/A | External dependency |
| **Bad Input (no sig)** | Return 400 | 400 | No retry | Yes | Lines 91-95 |
| **Invalid Signature** | Return 400 | 400 | No retry | Yes | Lines 115-119 |
| **Plan Resolution Fails** | Return 400, Stripe retries | 400 | Stripe automatic | No | Lines 194-198 |
| **Timeout** | Stripe treats as failure | 504 | Stripe automatic | Partial | No explicit timeout |

### Code Evidence

```typescript
// Lines 91-95: Missing signature
if (!signature) {
  return NextResponse.json(
    { error: "Missing signature" },
    { status: 400 }
  );
}

// Lines 115-119: Invalid signature
} catch (err: any) {
  console.error("[Webhook] Signature verification failed:", err.message);
  return NextResponse.json(
    { error: "Invalid signature" },
    { status: 400 }
  );
}

// Lines 296-300: Profile update failure
if (updateError) {
  const error = `Failed to update profile: ${updateError.message}`;
  console.error(`[Webhook] ${error}`);
  return { success: false, error };
}
```

### Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Graceful Degradation | FAIR | Returns 500 on DB failure, Stripe will retry |
| Error Visibility | GOOD | Detailed logging throughout |
| User Experience | FAIR | User may not get membership immediately if DB fails |
| Idempotency | PARTIAL | Same event reprocessed = updates same row (safe) |

### FINDING (MEDIUM)

**Issue:** Plan resolution failure returns 400, causing Stripe to retry. But if env vars are wrong, it will keep failing.

**Evidence (Lines 194-198):**
```typescript
if (!planResult) {
  const error = `Unable to determine plan for session ${session.id}. Check STRIPE_PRICE_ID and STRIPE_FAMILY_PRICE_ID env vars.`;
  console.error(`[Webhook] ${error}`);
  return { success: false, error };
}
```

**Fix:** Add specific error code for config issues vs transient failures. Config issues should return 500 to stop retries.

---

## 3. INSIGHTS GENERATION (`/api/insights`)

**File:** `app/api/insights/route.ts`

### Failure Matrix

| Failure Mode | Expected Behavior | Status Code | Retry Strategy | Idempotent? | Evidence |
|--------------|-------------------|-------------|----------------|-------------|----------|
| **Redis Down** | Return 503 (fail closed) | 503 | Client retry | Yes | Lines 394-404 |
| **Supabase Down** | Return 500 | 500 | Client retry | Yes | Profile fetch fails |
| **OpenAI Down** | Return 500, release lock | 500 | Client retry | Yes | Lines 681-700 |
| **Stripe Down** | N/A | N/A | N/A | N/A | No Stripe calls |
| **Bad Input** | Return 400 | 400 | N/A | Yes | Lines 105-114 |
| **Budget Exceeded** | Return 503 | 503 | Retry after midnight | Yes | Lines 409-419 |
| **Lock Held** | Retry 3x, then 503 | 503 | Automatic 3x | Yes | Lines 442-464 |
| **Timeout** | Next.js timeout, lock orphaned | 504 | Lock TTL expires | Partial | Lock has 60s TTL |

### Code Evidence

```typescript
// Lines 394-404: Redis unavailable (fail closed)
if (!isRedisAvailable()) {
  console.warn("[Insights] Redis unavailable, failing closed");
  return createApiErrorResponse({
    error: "service_unavailable",
    message: "Our cosmic connection is temporarily down. Please try again shortly.",
    errorCode: INSIGHTS_ERROR_CODES.REDIS_UNAVAILABLE,
    status: 503,
    route: "/api/insights",
  });
}

// Lines 421-434: Lock acquisition with fail-closed
const lockResult = await acquireLockFailClosed(lockKey, 60);
if (lockResult.redisDown) {
  console.warn("[Insights] Redis unavailable during lock, failing closed");
  return createApiErrorResponse({
    error: "service_unavailable",
    ...
    status: 503,
  });
}

// Lines 442-464: Retry loop when lock held
if (!lockAcquired) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    const nowCachedInsight = await getCache<SanctuaryInsight>(cacheKey);
    if (nowCachedInsight) {
      return NextResponse.json(normalizeInsight(nowCachedInsight));
    }
  }
  return createApiErrorResponse({
    error: "still_generating",
    status: 503,
  });
}

// Lines 681-700: Error handling with lock release
} catch (error: any) {
  console.error("Error generating insights:", error);
  try {
    if (periodKey) {
      const lockKey = buildInsightLockKey(userId, timeframe, periodKey, PROMPT_VERSION);
      await releaseLock(lockKey);
    }
  } catch (unlockError) {
    console.error("Error releasing lock on failure:", unlockError);
  }
  return createApiErrorResponse({
    error: "generation_failed",
    status: 500,
  });
}
```

### Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Graceful Degradation | EXCELLENT | Multiple fallback strategies |
| Error Visibility | EXCELLENT | Detailed error codes and logging |
| User Experience | GOOD | User-friendly error messages |
| Idempotency | GOOD | Cache key prevents duplicate generation |

---

## 4. BIRTH CHART COMPUTATION (`/api/birth-chart`)

**File:** `app/api/birth-chart/route.ts`

### Failure Matrix

| Failure Mode | Expected Behavior | Status Code | Retry Strategy | Idempotent? | Evidence |
|--------------|-------------------|-------------|----------------|-------------|----------|
| **Redis Down** | N/A (uses Supabase cache) | N/A | N/A | N/A | Stone tablet in DB |
| **Supabase Down** | Return 500 | 500 | Client retry | Yes | DB fetch fails |
| **OpenAI Down** | Return 500 | 500 | Client retry | Yes | Generation fails |
| **Swiss Ephemeris Fails** | Return 500 | 500 | Client retry | Yes | Placements computation |
| **Bad Input** | Return 400 | 400 | N/A | Yes | Validation errors |
| **Budget Exceeded** | Return 503 | 503 | Retry after midnight | Yes | Cost control |
| **Timeout** | Request timeout | 504 | Client retry | Yes | Stone tablet idempotent |

### Stone Tablet Contract Evidence

```typescript
// lib/birthChart/storage.ts:166-194
export function isStoredChartValid(
  storedChart: BirthChartData | null,
  currentProfile: Profile
): boolean {
  if (!storedChart) return false;

  // Check 1: Schema version must match
  if (storedChart.schemaVersion < BIRTH_CHART_SCHEMA_VERSION) {
    return false;
  }

  // Check 2: Profile must not have been updated after chart was computed
  if (profileDate > chartDate) {
    return false;
  }

  return true;
}
```

### Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Graceful Degradation | GOOD | Falls back to stored chart |
| Error Visibility | GOOD | Clear error responses |
| User Experience | GOOD | Cached results = fast response |
| Idempotency | EXCELLENT | Stone tablet ensures same result |

---

## 5. SOCIAL SYNC (`/api/social/sync`)

**File:** `app/api/social/sync/route.ts`

### Failure Matrix

| Failure Mode | Expected Behavior | Status Code | Retry Strategy | Idempotent? | Evidence |
|--------------|-------------------|-------------|----------------|-------------|----------|
| **Redis Down** | N/A (no Redis in sync) | N/A | N/A | N/A | Direct DB writes |
| **Supabase Down** | Return 500 | 500 | Cron retry | Partial | DB operations fail |
| **OpenAI Down** | Return 500 | 500 | Cron retry | Yes | Summary generation fails |
| **Provider API Down** | Return 401/500 | 401/500 | Cron retry | Yes | Fetch fails |
| **Token Expired** | Attempt refresh, then 401 | 401 | User must re-auth | Yes | Token refresh flow |
| **Token Decryption Fails** | Return 500 | 500 | Manual intervention | N/A | Crypto error |
| **Budget Exceeded** | Return 503 | 503 | Cron retry after midnight | Yes | Cost control |
| **Timeout** | Request timeout | 504 | Cron retry | Yes | Next scheduled run |

### Code Evidence

```typescript
// Token refresh flow (conceptual from reading)
if (tokenExpired) {
  try {
    const newTokens = await refreshAccessToken(provider, refreshToken);
    // Update DB with new tokens
  } catch (refreshError) {
    // Mark account as needs_reauth
    return { error: "Token refresh failed", status: 401 };
  }
}

// Budget check before OpenAI
const budgetCheck = await checkBudget();
if (!budgetCheck.allowed) {
  return { error: "Budget exceeded", status: 503 };
}
```

### Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Graceful Degradation | GOOD | Token refresh, account marking |
| Error Visibility | GOOD | Status written to profiles |
| User Experience | FAIR | User sees needs_reauth in UI |
| Idempotency | GOOD | Same content = same summary |

---

## 6. CRON PREWARM (`/api/cron/prewarm-insights`)

**File:** `app/api/cron/prewarm-insights/route.ts`

### Failure Matrix

| Failure Mode | Expected Behavior | Status Code | Retry Strategy | Idempotent? | Evidence |
|--------------|-------------------|-------------|----------------|-------------|----------|
| **Redis Down** | Skip users (fail closed) | 200 (partial) | Next cron run | Yes | Lock acquisition fails |
| **Supabase Down** | Return 500 | 500 | Next cron run | Yes | User fetch fails |
| **OpenAI Down** | Stop mid-job, return partial | 200 | Next cron run | Yes | Generation fails |
| **Budget Exceeded** | Stop mid-job, return stats | 200 | Next day | Yes | Budget check |
| **Bad Auth** | Return 401 | 401 | N/A | Yes | CRON_SECRET mismatch |
| **Timeout** | Partial completion | 504 | Next cron run | Yes | Already generated users cached |

### Code Evidence

```typescript
// Budget exhaustion mid-job (conceptual)
for (const user of eligibleUsers) {
  const budgetCheck = await checkBudget();
  if (!budgetCheck.allowed) {
    console.log("[Prewarm] Budget exhausted, stopping");
    break; // Return partial stats
  }
  // Generate insight for user
}

// Lock acquisition per user
const lockAcquired = await acquireLock(lockKey, 60);
if (!lockAcquired) {
  console.log(`[Prewarm] Lock held for user ${user.id}, skipping`);
  continue; // Skip this user
}
```

### Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Graceful Degradation | EXCELLENT | Partial completion is fine |
| Error Visibility | GOOD | Stats in response |
| User Experience | N/A | Background job |
| Idempotency | EXCELLENT | Skips already-generated |

---

## SUMMARY MATRIX

| Flow | Redis Down | Supabase Down | OpenAI Down | Budget Exceeded | Overall Rating |
|------|------------|---------------|-------------|-----------------|----------------|
| Auth Callback | N/A | 302 + error | N/A | N/A | GOOD |
| Stripe Webhook | N/A | 500 (retry) | N/A | N/A | FAIR |
| Insights | 503 (closed) | 500 | 500 | 503 | EXCELLENT |
| Birth Chart | N/A | 500 | 500 | 503 | GOOD |
| Social Sync | N/A | 500 | 500 | 503 | GOOD |
| Cron Prewarm | Skip user | 500 | Stop | Stop | EXCELLENT |

---

## FINDINGS

### HIGH SEVERITY

| ID | Issue | Location | Fix |
|----|-------|----------|-----|
| F1 | Stripe webhook plan resolution returns 400 for config errors | `webhook/route.ts:194-198` | Return 500 for config errors to stop retries |

### MEDIUM SEVERITY

| ID | Issue | Location | Fix |
|----|-------|----------|-----|
| F2 | No explicit timeout on OpenAI calls | Multiple files | Add `AbortController` with 30s timeout |
| F3 | Lock orphaned on hard crash | `insights/route.ts` | Lock TTL handles this (60s) but could be shorter |

### LOW SEVERITY

| ID | Issue | Location | Fix |
|----|-------|----------|-----|
| F4 | Auth callback profile creation failure silent | `callback/route.ts:120-122` | Consider failing the auth flow |

---

## RECOMMENDED TESTS

### 1. Redis Failure Test

```typescript
describe("Insights API - Redis Down", () => {
  beforeEach(() => {
    vi.mock("@/lib/cache/redis", () => ({
      isRedisAvailable: () => false,
    }));
  });

  it("returns 503 when Redis unavailable", async () => {
    const response = await POST(createMockRequest({ timeframe: "today" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      errorCode: INSIGHTS_ERROR_CODES.REDIS_UNAVAILABLE,
    });
  });
});
```

### 2. Budget Exhaustion Test

```typescript
describe("Insights API - Budget Exceeded", () => {
  beforeEach(() => {
    vi.mock("@/lib/ai/costControl", () => ({
      checkBudget: async () => ({ allowed: false, used: 100, limit: 100 }),
    }));
  });

  it("returns 503 when budget exceeded", async () => {
    const response = await POST(createMockRequest({ timeframe: "today" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      errorCode: INSIGHTS_ERROR_CODES.BUDGET_EXCEEDED,
    });
  });
});
```

### 3. Lock Contention Test

```typescript
describe("Insights API - Lock Held", () => {
  beforeEach(() => {
    vi.mock("@/lib/cache/redis", () => ({
      acquireLockFailClosed: async () => ({ acquired: false, redisDown: false }),
      getCache: async () => null, // No cached result even after retries
    }));
  });

  it("returns 503 after retry exhaustion", async () => {
    const response = await POST(createMockRequest({ timeframe: "today" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      errorCode: INSIGHTS_ERROR_CODES.LOCK_BUSY,
    });
  });
});
```
