# COVERAGE_HEATMAP.md

**Generated:** 2026-01-01
**Scope:** Test coverage analysis with prioritized improvement plan

---

## COVERAGE SUMMARY

```
Overall Coverage: 2.86% (FAILING - threshold is 3%)

Total Files Analyzed: ~200
Files with 0% Coverage: ~180
Files with Partial Coverage: ~15
Files with Good Coverage (>50%): 5
```

---

## RAW VITEST COVERAGE OUTPUT (Sorted by Risk)

### API Routes (ALL 0% COVERAGE)

| Route | Lines | Branches | Functions | Uncovered Lines | Risk Level |
|-------|-------|----------|-----------|-----------------|------------|
| `/api/insights/route.ts` | 0% | 0% | 0% | 1-706 | **CRITICAL** |
| `/api/birth-chart/route.ts` | 0% | 0% | 0% | 1-1041 | **CRITICAL** |
| `/api/stripe/webhook/route.ts` | 0% | 0% | 0% | 1-413 | **CRITICAL** |
| `/api/connections/route.ts` | 0% | 0% | 0% | 1-606 | **HIGH** |
| `/api/connection-space-between/route.ts` | 0% | 0% | 0% | 1-626 | **HIGH** |
| `/api/public-compatibility/route.ts` | 0% | 0% | 0% | 1-552 | **HIGH** |
| `/api/cron/prewarm-insights/route.ts` | 0% | 0% | 0% | 1-590 | **HIGH** |
| `/api/connection-brief/route.ts` | 0% | 0% | 0% | 1-465 | MEDIUM |
| `/api/connection-insight/route.ts` | 0% | 0% | 0% | 1-453 | MEDIUM |
| `/api/location/search/route.ts` | 0% | 0% | 0% | 1-413 | MEDIUM |
| `/api/auth/login/tiktok/callback/route.ts` | 0% | 0% | 0% | 1-384 | MEDIUM |
| `/api/auth/login/x/callback/route.ts` | 0% | 0% | 0% | 1-385 | MEDIUM |
| `/api/social/oauth/[provider]/callback/route.ts` | 0% | 0% | 0% | 1-377 | MEDIUM |
| `/api/public-tarot/route.ts` | 0% | 0% | 0% | 1-367 | MEDIUM |
| `/api/social/sync/route.ts` | 0% | 0% | 0% | 1-291 | MEDIUM |
| `/api/public-horoscope/route.ts` | 0% | 0% | 0% | 1-290 | LOW |
| `/api/user/profile/route.ts` | 0% | 0% | 0% | 1-256 | LOW |

### Core Libraries (Partial Coverage)

| Module | Lines | Branches | Functions | Uncovered Lines | Notes |
|--------|-------|----------|-----------|-----------------|-------|
| `lib/ai/costControl.ts` | **95.45%** | 91.66% | 100% | 34-35, 169-170 | GOOD |
| `lib/ai/pricing.ts` | **91.66%** | 50% | 100% | 56-58 | GOOD |
| `lib/cache/rateLimit.ts` | **88.88%** | 78.37% | 100% | Various | GOOD |
| `lib/auth/socialConsent.ts` | **87.77%** | 80.64% | 91.66% | 99-110, 139-141 | GOOD |
| `lib/cache/redis.ts` | 56.68% | 83.33% | 43.75% | Various | PARTIAL |
| `lib/ai/*` (average) | 55.98% | 86.2% | 90.9% | - | PARTIAL |
| `lib/auth/*` (average) | 30.73% | 80% | 87.5% | - | LOW |

### Untested Libraries (0% Coverage)

| Module | Lines | Risk Level | Why It Matters |
|--------|-------|------------|----------------|
| `lib/openai/client.ts` | 1-39 | **CRITICAL** | OpenAI initialization |
| `lib/stripe/client.ts` | 1-26 | **CRITICAL** | Stripe initialization |
| `lib/stripe/claimCheckoutSession.ts` | 1-183 | **CRITICAL** | Payment claiming |
| `lib/supabase/server.ts` | 1-66 | **HIGH** | Server auth |
| `lib/social/crypto.ts` | 1-91 | **HIGH** | Token encryption |
| `lib/social/summarize.ts` | 1-293 | **HIGH** | AI summarization |
| `lib/birthChart/storage.ts` | 1-230 | **HIGH** | Stone tablet logic |
| `lib/numerology/storage.ts` | 1-349 | **HIGH** | Numerology cache |
| `lib/ephemeris/swissEngine.ts` | 1-460 | MEDIUM | Swiss Ephemeris |
| `lib/ephemeris/solvers.ts` | 1-706 | MEDIUM | Astronomy math |
| `lib/validation/schemas.ts` | 1-296 | MEDIUM | Input validation |

---

## TOP 25 RISKY UNTESTED MODULES

| Rank | Module | Lines | Risk | Business Impact |
|------|--------|-------|------|-----------------|
| 1 | `app/api/insights/route.ts` | 706 | CRITICAL | Core AI feature, $$$, rate limiting |
| 2 | `app/api/birth-chart/route.ts` | 1041 | CRITICAL | Premium AI, stone tablet |
| 3 | `app/api/stripe/webhook/route.ts` | 413 | CRITICAL | Payment processing |
| 4 | `lib/stripe/claimCheckoutSession.ts` | 183 | CRITICAL | Payment to membership |
| 5 | `app/api/cron/prewarm-insights/route.ts` | 590 | HIGH | Batch AI generation |
| 6 | `app/api/connections/route.ts` | 606 | HIGH | User data CRUD |
| 7 | `app/api/connection-space-between/route.ts` | 626 | HIGH | Premium feature |
| 8 | `lib/social/crypto.ts` | 91 | HIGH | Token encryption |
| 9 | `lib/birthChart/storage.ts` | 230 | HIGH | Stone tablet contract |
| 10 | `lib/social/summarize.ts` | 293 | HIGH | Social AI |
| 11 | `app/api/social/sync/route.ts` | 291 | HIGH | Social sync pipeline |
| 12 | `app/api/public-compatibility/route.ts` | 552 | HIGH | Public AI endpoint |
| 13 | `lib/numerology/storage.ts` | 349 | MEDIUM | Numerology cache |
| 14 | `lib/ephemeris/swissEngine.ts` | 460 | MEDIUM | Core astronomy |
| 15 | `lib/validation/schemas.ts` | 296 | MEDIUM | Input validation |
| 16 | `app/api/public-tarot/route.ts` | 367 | MEDIUM | Public AI (uncached) |
| 17 | `lib/soulPath/storage.ts` | 282 | MEDIUM | Soul path cache |
| 18 | `lib/supabase/server.ts` | 66 | MEDIUM | Auth utilities |
| 19 | `app/api/auth/login/tiktok/callback/route.ts` | 384 | MEDIUM | OAuth callback |
| 20 | `lib/cache/tarotRateLimit.ts` | 189 | MEDIUM | Rate limiting |
| 21 | `lib/social/staleness.ts` | 170 | MEDIUM | Sync scheduling |
| 22 | `app/api/location/search/route.ts` | 413 | LOW | Location API |
| 23 | `lib/numerology/coreNumbers.ts` | 265 | LOW | Numerology math |
| 24 | `app/api/user/profile/route.ts` | 256 | LOW | Profile CRUD |
| 25 | `lib/timezone/periodKeys.ts` | 150 | LOW | Cache key generation |

---

## EXISTING TEST FILES ANALYSIS

### Test Files Found

```
__tests__/api/birth-chart.test.ts          → 0 implemented (all todo)
__tests__/api/insights.test.ts             → 0 implemented (all todo)
__tests__/auth/checkout-cookie.test.ts     → 0 implemented (all todo)
__tests__/auth/profile-creation.test.ts    → 0 implemented (all todo)
__tests__/auth/session-guards.test.ts      → 0 implemented (all todo)
__tests__/infrastructure/cost-control.test.ts  → IMPLEMENTED (95% coverage)
__tests__/infrastructure/rate-limiting.test.ts → IMPLEMENTED (88% coverage)
__tests__/infrastructure/redis-failures.test.ts → IMPLEMENTED (56% coverage)
__tests__/payments/claim-session.test.ts   → 0 implemented (all todo)
__tests__/payments/membership-status.test.ts → 0 implemented (all todo)
__tests__/payments/stripe-webhook.test.ts  → 0 implemented (all todo)
__tests__/security/token-encryption.test.ts → 0 implemented (all todo)
__tests__/validation/birth-data.test.ts    → 0 implemented (all todo)
```

### Pattern Analysis

**What's Working:**
- Infrastructure tests (cost-control, rate-limiting, redis) are well-implemented
- These cover the most critical failure modes

**What's Missing:**
- All API route tests are stubs
- All auth flow tests are stubs
- All payment tests are stubs
- Security tests are stubs

---

## 2-SPRINT TEST PLAN

### Sprint 1: Critical Path Coverage (5 days)

**Goal:** Get coverage to 10% by covering payment and core AI flows

#### Day 1-2: Payment Flow

| File | Tests to Add | Priority |
|------|--------------|----------|
| `__tests__/payments/stripe-webhook.test.ts` | checkout.session.completed, subscription.updated, subscription.deleted, signature verification | P0 |
| `__tests__/payments/claim-session.test.ts` | successful claim, already claimed, invalid session, user mismatch | P0 |
| `__tests__/payments/membership-status.test.ts` | hasActiveSubscription, is_comped bypass, role bypass | P0 |

**Test Template:**
```typescript
describe("Stripe Webhook - checkout.session.completed", () => {
  it("updates profile with membership_plan for valid session", async () => {
    // Mock Stripe constructEvent to return valid event
    // Mock Supabase profile lookup and update
    // Assert profile.membership_plan = "individual"
  });

  it("returns 400 for invalid signature", async () => {
    // Mock constructEvent to throw
    // Assert 400 response
  });

  it("returns 400 when plan cannot be resolved", async () => {
    // Mock session without metadata or matching price ID
    // Assert 400 with specific error message
  });
});
```

#### Day 3-4: Insights API

| File | Tests to Add | Priority |
|------|--------------|----------|
| `__tests__/api/insights.test.ts` | Implement all 36 existing todo stubs | P0 |

**Key Test Cases:**
1. Authentication (401 for unauthenticated)
2. Timeframe validation (400 for week/month)
3. Profile validation (400 for missing birth data)
4. Cache hit (no OpenAI call)
5. Cache miss (OpenAI called, cached after)
6. Rate limiting (429 after burst)
7. Budget exceeded (503)
8. Redis unavailable (503)
9. Lock contention (503 after retries)

#### Day 5: Birth Chart API

| File | Tests to Add | Priority |
|------|--------------|----------|
| `__tests__/api/birth-chart.test.ts` | Authentication, validation, stone tablet contract | P1 |

---

### Sprint 2: Auth & Social Coverage (5 days)

**Goal:** Get coverage to 20%

#### Day 1-2: Auth Flows

| File | Tests to Add | Priority |
|------|--------------|----------|
| `__tests__/auth/profile-creation.test.ts` | OAuth profile creation, minimal profile | P1 |
| `__tests__/auth/session-guards.test.ts` | Redirect logic, entitlement checks | P1 |
| `__tests__/auth/checkout-cookie.test.ts` | Cookie set, cookie claim, cookie clear | P1 |

#### Day 3-4: Social Sync

| File | Tests to Add | Priority |
|------|--------------|----------|
| `__tests__/social/sync.test.ts` (NEW) | Token decrypt, content fetch, summarize, budget | P1 |
| `__tests__/social/oauth.test.ts` (NEW) | OAuth initiation, callback, token storage | P2 |
| `__tests__/security/token-encryption.test.ts` | Encrypt/decrypt round-trip, key validation | P1 |

#### Day 5: Validation

| File | Tests to Add | Priority |
|------|--------------|----------|
| `__tests__/validation/birth-data.test.ts` | Birth date format, coordinate ranges, timezone validation | P2 |
| `__tests__/validation/schemas.test.ts` (NEW) | All Zod schemas | P2 |

---

## FILE-LEVEL TEST TARGETS

### Sprint 1 Target: 10% Overall Coverage

| File | Current | Target | Tests Needed |
|------|---------|--------|--------------|
| `lib/ai/costControl.ts` | 95% | 100% | +2 edge cases |
| `lib/cache/rateLimit.ts` | 88% | 95% | +3 edge cases |
| `lib/cache/redis.ts` | 56% | 80% | +10 tests |
| `app/api/stripe/webhook/route.ts` | 0% | 60% | +15 tests |
| `lib/stripe/claimCheckoutSession.ts` | 0% | 70% | +8 tests |
| `app/api/insights/route.ts` | 0% | 50% | +20 tests |
| `app/api/birth-chart/route.ts` | 0% | 40% | +15 tests |

### Sprint 2 Target: 20% Overall Coverage

| File | Current | Target | Tests Needed |
|------|---------|--------|--------------|
| `lib/social/crypto.ts` | 0% | 90% | +5 tests |
| `lib/birthChart/storage.ts` | 0% | 70% | +8 tests |
| `app/auth/callback/route.ts` | 0% | 60% | +10 tests |
| `app/api/social/sync/route.ts` | 0% | 50% | +12 tests |
| `app/api/connections/route.ts` | 0% | 40% | +10 tests |
| `lib/validation/schemas.ts` | 0% | 80% | +15 tests |

---

## TEST INFRASTRUCTURE RECOMMENDATIONS

### 1. Add Test Factories

Create `__tests__/factories/index.ts`:

```typescript
export function createMockProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "test-user-id",
    email: "test@example.com",
    birth_date: "1990-01-15",
    birth_time: "14:30",
    birth_lat: 40.7128,
    birth_lon: -74.0060,
    timezone: "America/New_York",
    membership_plan: "individual",
    subscription_status: "active",
    is_comped: false,
    role: "user",
    ...overrides,
  };
}

export function createMockStripeEvent(type: string, data: object): Stripe.Event {
  return {
    id: `evt_${Date.now()}`,
    type,
    data: { object: data },
    // ...other fields
  };
}
```

### 2. Add Mock Modules

Enhance `__tests__/mocks/index.ts` with:
- `createMockOpenAIResponse()`
- `createMockSupabaseQuery()`
- `createMockRedisClient()`

### 3. Add Integration Test Setup

Create `__tests__/integration/setup.ts`:
- Seed test database
- Reset Redis between tests
- Mock external APIs (Stripe, OpenAI)

---

## METRICS TO TRACK

| Metric | Current | Sprint 1 Target | Sprint 2 Target |
|--------|---------|-----------------|-----------------|
| Line Coverage | 2.86% | 10% | 20% |
| Branch Coverage | ~5% | 15% | 25% |
| Critical Path Coverage | 0% | 60% | 80% |
| API Route Coverage | 0% | 40% | 60% |
| Test Count | ~20 | ~80 | ~150 |
