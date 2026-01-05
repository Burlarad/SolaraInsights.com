# ROUTE_INVENTORY.md

**Generated:** 2026-01-01
**Scope:** Complete enumeration of all Next.js routes with security, validation, and data flow analysis

---

## RAW BUILD OUTPUT (79 Routes)

```
Route (app)                                   Size  First Load JS  Runtime
┌ ○ /                                      14.6 kB         139 kB  Static
├ ○ /_not-found                              997 B         103 kB  Static
├ ○ /about                                   695 B         111 kB  Static
├ ƒ /api/account/delete                      250 B         102 kB  Dynamic
├ ƒ /api/account/hibernate                   250 B         102 kB  Dynamic
├ ƒ /api/account/reactivate                  250 B         102 kB  Dynamic
├ ƒ /api/auth/complete-signup                250 B         102 kB  Dynamic
├ ƒ /api/auth/login/tiktok                   250 B         102 kB  Dynamic
├ ƒ /api/auth/login/tiktok/callback          250 B         102 kB  Dynamic
├ ƒ /api/auth/login/x                        250 B         102 kB  Dynamic
├ ƒ /api/auth/login/x/callback               250 B         102 kB  Dynamic
├ ƒ /api/auth/reauth/prepare                 250 B         102 kB  Dynamic
├ ƒ /api/auth/reauth/tiktok/callback         250 B         102 kB  Dynamic
├ ƒ /api/auth/reauth/x/callback              250 B         102 kB  Dynamic
├ ƒ /api/auth/resend-signup-link             250 B         102 kB  Dynamic
├ ƒ /api/auth/reset-password                 250 B         102 kB  Dynamic
├ ƒ /api/birth-chart                         250 B         102 kB  Dynamic
├ ƒ /api/connection-brief                    250 B         102 kB  Dynamic
├ ƒ /api/connection-insight                  250 B         102 kB  Dynamic
├ ƒ /api/connection-space-between            250 B         102 kB  Dynamic
├ ƒ /api/connections                         250 B         102 kB  Dynamic
├ ƒ /api/cron/generate-global-events         250 B         102 kB  Dynamic
├ ƒ /api/cron/prewarm-insights               250 B         102 kB  Dynamic
├ ƒ /api/cron/social-sync                    250 B         102 kB  Dynamic
├ ƒ /api/health                              250 B         102 kB  Dynamic
├ ƒ /api/insights                            250 B         102 kB  Dynamic
├ ƒ /api/journal                             250 B         102 kB  Dynamic
├ ƒ /api/journal/delete                      250 B         102 kB  Dynamic
├ ƒ /api/journal/export                      250 B         102 kB  Dynamic
├ ƒ /api/location/search                     250 B         102 kB  Dynamic
├ ƒ /api/meta/facebook/data-deletion         250 B         102 kB  Dynamic
├ ƒ /api/meta/facebook/deauthorize           250 B         102 kB  Dynamic
├ ƒ /api/numerology                          250 B         102 kB  Dynamic
├ ƒ /api/numerology/lucky                    250 B         102 kB  Dynamic
├ ƒ /api/public-compatibility                250 B         102 kB  Dynamic
├ ƒ /api/public-horoscope                    250 B         102 kB  Dynamic
├ ƒ /api/public-tarot                        250 B         102 kB  Dynamic
├ ƒ /api/social/oauth/[provider]/callback    250 B         102 kB  Dynamic
├ ƒ /api/social/oauth/[provider]/connect     250 B         102 kB  Dynamic
├ ƒ /api/social/revoke                       250 B         102 kB  Dynamic
├ ƒ /api/social/status                       250 B         102 kB  Dynamic
├ ƒ /api/social/sync                         250 B         102 kB  Dynamic
├ ƒ /api/social/sync-user                    250 B         102 kB  Dynamic
├ ƒ /api/stripe/checkout                     250 B         102 kB  Dynamic
├ ƒ /api/stripe/claim-session                250 B         102 kB  Dynamic
├ ƒ /api/stripe/session-info                 250 B         102 kB  Dynamic
├ ƒ /api/stripe/webhook                      250 B         102 kB  Dynamic
├ ƒ /api/user/profile                        250 B         102 kB  Dynamic
├ ƒ /api/user/social-insights                250 B         102 kB  Dynamic
├ ƒ /auth/callback                           250 B         102 kB  Dynamic
├ ○ /auth/post-callback                    2.05 kB         104 kB  Static
├ ○ /data-deletion                           702 B         114 kB  Static
├ ƒ /deletion-status                       1.79 kB         126 kB  Dynamic
├ ○ /forgot-password                        3.6 kB         131 kB  Static
├ ○ /join                                  5.08 kB         171 kB  Static
├ ○ /learn                                 5.15 kB         133 kB  Static
├ ● /learn/[slug]                          2.03 kB         130 kB  SSG
├ ○ /onboarding                            7.52 kB         185 kB  Static
├ ○ /privacy                                 695 B         111 kB  Static
├ ○ /reset-password                        5.35 kB         186 kB  Static
├ ƒ /sanctuary                             12.8 kB         215 kB  Dynamic
├ ƒ /sanctuary/birth-chart                 8.53 kB         141 kB  Dynamic
├ ƒ /sanctuary/connections                  9.6 kB         207 kB  Dynamic
├ ƒ /sanctuary/numerology                  5.98 kB         134 kB  Dynamic
├ ○ /set-password                          4.08 kB         181 kB  Static
├ ƒ /settings                              12.9 kB         202 kB  Dynamic
├ ○ /sign-in                               4.96 kB         201 kB  Static
├ ○ /sign-up                               4.53 kB         185 kB  Static
├ ○ /terms                                   695 B         111 kB  Static
└ ƒ /welcome                               5.84 kB         184 kB  Dynamic
```

---

## API ROUTES DETAILED ANALYSIS

### 1. AUTHENTICATION ROUTES

#### `/api/auth/complete-signup`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/auth/complete-signup/route.ts` |
| **Methods** | POST |
| **Auth Guard** | None (creates new user) |
| **Entitlement** | None |
| **Input Validation** | Manual: email format, password length |
| **DB Reads** | `profiles` (check existence) |
| **DB Writes** | `profiles` (insert minimal profile) |
| **Cache Keys** | None |
| **External Calls** | Supabase Auth `signUp()` |
| **Error Codes** | 400 (bad input), 500 (server error) |
| **Tests** | `__tests__/auth/profile-creation.test.ts` (todo stubs) |
| **Risk** | LOW - Standard signup flow |

#### `/api/auth/login/tiktok`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/auth/login/tiktok/route.ts` |
| **Methods** | GET |
| **Auth Guard** | None (initiates OAuth) |
| **Entitlement** | None |
| **Input Validation** | None |
| **DB Reads** | None |
| **DB Writes** | None |
| **Cache Keys** | None |
| **External Calls** | TikTok OAuth URL construction |
| **Error Codes** | 302 (redirect) |
| **Tests** | None |
| **Risk** | LOW - OAuth redirect |

#### `/api/auth/login/tiktok/callback`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/auth/login/tiktok/callback/route.ts` |
| **Methods** | GET |
| **Auth Guard** | OAuth state validation |
| **Entitlement** | None |
| **Input Validation** | Manual: code, state params |
| **DB Reads** | `profiles` (check existence) |
| **DB Writes** | `profiles` (insert if new user) |
| **Cache Keys** | PKCE verifier from cookie |
| **External Calls** | TikTok token exchange, Supabase Auth |
| **Error Codes** | 302 (redirect with error), 400 (missing params) |
| **Tests** | None |
| **Risk** | MEDIUM - OAuth callback, profile creation |

#### `/api/auth/login/x` and `/api/auth/login/x/callback`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/auth/login/x/route.ts`, `callback/route.ts` |
| **Methods** | GET |
| **Auth Guard** | OAuth state validation (callback) |
| **Feature Flag** | `X_OAUTH_ENABLED` (disabled by default) |
| **Risk** | LOW - Feature-flagged OAuth |

#### `/api/auth/reauth/prepare`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/auth/reauth/prepare/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Supabase session |
| **Purpose** | Prepare reauth intent for sensitive operations |
| **DB Writes** | Cookie (reauth_intent, 10 min TTL) |
| **Risk** | LOW - Session validation |

#### `/api/auth/resend-signup-link`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/auth/resend-signup-link/route.ts` |
| **Methods** | POST |
| **Auth Guard** | None |
| **Input Validation** | Manual: email format |
| **External Calls** | Supabase Auth `resendConfirmation()` |
| **Risk** | MEDIUM - Email enumeration possible |

#### `/api/auth/reset-password`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/auth/reset-password/route.ts` |
| **Methods** | POST |
| **Auth Guard** | None |
| **Input Validation** | Manual: email format |
| **External Calls** | Supabase Auth `resetPasswordForEmail()` |
| **Risk** | LOW - Standard password reset |

---

### 2. CORE SANCTUARY ROUTES

#### `/api/insights` - **CRITICAL PATH**

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/insights/route.ts:1-704` |
| **Methods** | POST |
| **Auth Guard** | Supabase session (line 69-82) |
| **Entitlement** | Implicit (requires onboarded profile) |
| **Input Validation** | Manual: timeframe enum (lines 105-114) |
| **DB Reads** | `profiles`, `social_summaries`, `soul_paths`, `global_events` |
| **DB Writes** | None (cache-only) |
| **Cache Keys** | `insight:v${PROMPT_VERSION}:${userId}:${timeframe}:${periodKey}:${lang}:${version}` |
| **External Calls** | OpenAI (gpt-4.1-mini or gpt-5.1), Redis |
| **Error Codes** | 401, 400, 429, 503 |
| **Rate Limits** | 60/hour sustained, 20/10s burst, 5s cooldown |
| **Tests** | `__tests__/api/insights.test.ts` (36 todo stubs) |
| **Risk** | HIGH - Cost control critical |

**Evidence (lines 105-114):**
```typescript
const ALLOWED_TIMEFRAMES = ["today", "year"];
if (!ALLOWED_TIMEFRAMES.includes(timeframe)) {
  return createApiErrorResponse({
    error: "Invalid timeframe",
    message: "Only 'today' and 'year' insights are available...",
    errorCode: INSIGHTS_ERROR_CODES.INVALID_TIMEFRAME,
    status: 400,
  });
}
```

**Evidence (fail-closed Redis check, lines 394-404):**
```typescript
if (!isRedisAvailable()) {
  console.warn("[Insights] Redis unavailable, failing closed");
  return createApiErrorResponse({
    error: "service_unavailable",
    errorCode: INSIGHTS_ERROR_CODES.REDIS_UNAVAILABLE,
    status: 503,
  });
}
```

#### `/api/birth-chart` - **CRITICAL PATH**

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/birth-chart/route.ts` |
| **Methods** | GET, POST |
| **Auth Guard** | Supabase session |
| **Entitlement** | Implicit (requires birth data) |
| **Input Validation** | Zod: `validateBirthChartInsight`, `validateBatchedTabDeepDives` |
| **DB Reads** | `profiles`, `soul_paths` |
| **DB Writes** | `soul_paths` (stone tablet - cached forever) |
| **Cache Keys** | Stone tablet contract (hash + schema + prompt + lang) |
| **External Calls** | OpenAI (gpt-5.1), Swiss Ephemeris |
| **Error Codes** | 401, 400, 403, 429, 503 |
| **Rate Limits** | Burst limit (10s window) |
| **Tests** | `__tests__/api/birth-chart.test.ts` (todo stubs) |
| **Risk** | HIGH - Expensive OpenAI model |

#### `/api/numerology`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/numerology/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Supabase session |
| **Input Validation** | Manual: name and birth_date required |
| **DB Reads** | `profiles` |
| **DB Writes** | `profiles.numerology_json` (cached) |
| **External Calls** | OpenAI (gpt-5.1 for deep dives), local computation |
| **Risk** | MEDIUM - Cached results |

#### `/api/numerology/lucky`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/numerology/lucky/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Supabase session |
| **Input Validation** | Manual: date format |
| **DB Reads** | `profiles` |
| **External Calls** | Local computation only |
| **Risk** | LOW - No external API calls |

---

### 3. CONNECTION ROUTES

#### `/api/connections`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/connections/route.ts` |
| **Methods** | GET, POST, PATCH, DELETE |
| **Auth Guard** | Supabase session |
| **Input Validation** | Manual inline (no Zod schema) |
| **DB Reads** | `profiles`, `connections`, `daily_briefs` |
| **DB Writes** | `connections` |
| **External Calls** | `tzLookup` (timezone from coords) |
| **Error Codes** | 401, 400, 404, 429, 500 |
| **Rate Limits** | 30/hour create/update, 10/hour delete |
| **Tests** | None |
| **Risk** | MEDIUM - Missing Zod validation |

**FINDING (MEDIUM):** No Zod schema for connection validation.

**Evidence (inline validation):**
```typescript
// Manual validation: Required fields (first_name, last_name, relationship_type)
// Manual validation: Coordinate ranges (-90 to 90 lat, -180 to 180 lon)
// Manual validation: Relationship type enum
// Manual validation: Birth date (YYYY-MM-DD format regex)
// Manual validation: Birth time (HH:MM format regex)
```

**Fix:** Create `connectionCreateSchema` and `connectionUpdateSchema` in `lib/validation/schemas.ts`.

#### `/api/connection-brief`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/connection-brief/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Supabase session |
| **DB Reads** | `profiles`, `connections`, `daily_briefs` |
| **DB Writes** | `daily_briefs` |
| **External Calls** | OpenAI (gpt-4.1-mini) |
| **Risk** | MEDIUM - AI generation |

#### `/api/connection-insight`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/connection-insight/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Supabase session |
| **Input Validation** | Zod: `connectionInsightSchema` |
| **DB Reads** | `profiles`, `connections`, `daily_briefs` |
| **DB Writes** | `daily_briefs` |
| **External Calls** | OpenAI (gpt-4.1-mini) |
| **Risk** | MEDIUM - AI generation |

#### `/api/connection-space-between`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/connection-space-between/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Supabase session |
| **Entitlement** | Family plan required (mutual consent) |
| **DB Reads** | `profiles`, `connections`, `space_between_reports` |
| **DB Writes** | `space_between_reports` (stone tablet) |
| **External Calls** | OpenAI (gpt-4o - premium model) |
| **Risk** | HIGH - Expensive model, entitlement gating |

---

### 4. STRIPE ROUTES

#### `/api/stripe/webhook` - **CRITICAL PATH**

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/stripe/webhook/route.ts:1-414` |
| **Methods** | POST |
| **Auth Guard** | Stripe signature verification (line 109) |
| **Input Validation** | Stripe event construction |
| **DB Reads** | `profiles` (by email) |
| **DB Writes** | `profiles` (membership_plan, stripe_*, subscription_*) |
| **External Calls** | Stripe API (3 calls), Resend (welcome email) |
| **Error Codes** | 400 (invalid signature, plan resolution), 500 (config error) |
| **Tests** | `__tests__/payments/stripe-webhook.test.ts` (todo stubs) |
| **Risk** | HIGH - Payment processing |

**Evidence (signature verification, lines 108-120):**
```typescript
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

#### `/api/stripe/checkout`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/stripe/checkout/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Optional (guest or authenticated) |
| **Input Validation** | Zod: `stripeCheckoutSchema` |
| **External Calls** | Stripe `checkout.sessions.create` |
| **Risk** | MEDIUM - Payment initiation |

#### `/api/stripe/claim-session`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/stripe/claim-session/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Supabase session |
| **Purpose** | Link anonymous checkout to authenticated user |
| **DB Writes** | `profiles` (membership fields) |
| **Tests** | `__tests__/payments/claim-session.test.ts` (todo stubs) |
| **Risk** | MEDIUM - Session claiming |

#### `/api/stripe/session-info`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/stripe/session-info/route.ts` |
| **Methods** | GET |
| **Auth Guard** | None (session ID in query) |
| **External Calls** | Stripe `checkout.sessions.retrieve` |
| **Risk** | LOW - Read-only |

---

### 5. SOCIAL ROUTES

#### `/api/social/oauth/[provider]/connect`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/social/oauth/[provider]/connect/route.ts` |
| **Methods** | GET |
| **Auth Guard** | Supabase session |
| **Dynamic Param** | `[provider]`: facebook, instagram, tiktok, x, reddit |
| **External Calls** | OAuth provider authorization URL |
| **Risk** | LOW - OAuth redirect |

#### `/api/social/oauth/[provider]/callback`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/social/oauth/[provider]/callback/route.ts` |
| **Methods** | GET |
| **Auth Guard** | OAuth state validation + Supabase session |
| **DB Writes** | `social_accounts` (encrypted tokens) |
| **External Calls** | Provider token exchange |
| **Risk** | MEDIUM - Token storage |

#### `/api/social/sync` - **CRITICAL PATH**

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/social/sync/route.ts` |
| **Methods** | POST |
| **Auth Guard** | CRON_SECRET header |
| **DB Reads** | `social_accounts` (encrypted tokens) |
| **DB Writes** | `social_accounts`, `social_summaries`, `profiles` |
| **External Calls** | Social APIs (fetch content), OpenAI (summarize) |
| **Error Codes** | 400, 401, 403, 500, 503 |
| **Risk** | HIGH - Token decryption, external API calls |

**Evidence (CRON_SECRET auth):**
```typescript
const cronSecret = req.headers.get("x-cron-secret");
if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

#### `/api/social/sync-user`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/social/sync-user/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Supabase session OR CRON_SECRET |
| **Purpose** | User-triggered sync (fire-and-forget) |
| **Risk** | MEDIUM - User can trigger sync |

#### `/api/social/status`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/social/status/route.ts` |
| **Methods** | GET |
| **Auth Guard** | Supabase session |
| **DB Reads** | `social_accounts`, `social_summaries` |
| **Risk** | LOW - Read-only |

#### `/api/social/revoke`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/social/revoke/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Supabase session |
| **DB Writes** | `social_accounts` (delete) |
| **Risk** | LOW - Revocation |

---

### 6. CRON ROUTES

#### `/api/cron/prewarm-insights`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/cron/prewarm-insights/route.ts` |
| **Methods** | GET |
| **Auth Guard** | CRON_SECRET header (x-cron-secret) |
| **DB Reads** | `profiles`, `connections`, `daily_briefs`, `social_summaries` |
| **DB Writes** | `daily_briefs` |
| **External Calls** | OpenAI (batch generation), Redis |
| **Budget Control** | Stops mid-job if budget exceeded |
| **Risk** | HIGH - Batch AI generation |

#### `/api/cron/social-sync`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/cron/social-sync/route.ts` |
| **Methods** | GET |
| **Auth Guard** | CRON_SECRET header |
| **Purpose** | Batch social sync for all users |
| **Risk** | HIGH - Batch token usage |

#### `/api/cron/generate-global-events`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/cron/generate-global-events/route.ts` |
| **Methods** | GET |
| **Auth Guard** | CRON_SECRET header |
| **DB Writes** | `global_events` |
| **External Calls** | Swiss Ephemeris (astronomy calculations) |
| **Risk** | MEDIUM - Batch computation |

---

### 7. PUBLIC ROUTES

#### `/api/public-horoscope`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/public-horoscope/route.ts` |
| **Methods** | POST |
| **Auth Guard** | None (public) |
| **Input Validation** | Zod: `publicHoroscopeSchema` |
| **Cache Keys** | `horoscope:${sign}:${timeframe}:${periodKey}:${lang}` |
| **External Calls** | OpenAI (gpt-4.1-mini), Redis |
| **Rate Limits** | IP-based (100/hour) |
| **Risk** | MEDIUM - Public AI endpoint |

#### `/api/public-tarot`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/public-tarot/route.ts` |
| **Methods** | POST |
| **Auth Guard** | None (public) |
| **Input Validation** | Zod: `publicTarotSchema` |
| **Rate Limits** | IP-based + session cooldown |
| **External Calls** | OpenAI (gpt-4.1-mini) |
| **Risk** | HIGH - No caching (unique draws), abuse potential |

#### `/api/public-compatibility`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/public-compatibility/route.ts` |
| **Methods** | POST |
| **Auth Guard** | None (public) |
| **Input Validation** | Zod: `publicCompatibilitySchema` |
| **Cache Keys** | `compatibility:${signA}:${signB}` (144 combinations) |
| **External Calls** | OpenAI (gpt-4.1-mini), Redis |
| **Risk** | LOW - Heavily cached |

---

### 8. META COMPLIANCE ROUTES

#### `/api/meta/facebook/data-deletion`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/meta/facebook/data-deletion/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Meta signed_request verification |
| **Purpose** | GDPR data deletion callback |
| **DB Writes** | `social_accounts` (delete), `social_summaries` (delete) |
| **Risk** | LOW - Compliance endpoint |

#### `/api/meta/facebook/deauthorize`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/meta/facebook/deauthorize/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Meta signed_request verification |
| **Purpose** | OAuth deauthorization callback |
| **Risk** | LOW - Compliance endpoint |

---

### 9. ACCOUNT MANAGEMENT ROUTES

#### `/api/account/delete`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/account/delete/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Supabase session |
| **DB Writes** | Full account deletion (cascading) |
| **Risk** | HIGH - Irreversible action |

#### `/api/account/hibernate`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/account/hibernate/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Supabase session |
| **DB Writes** | `profiles.is_hibernated = true` |
| **Risk** | LOW - Soft deactivation |

#### `/api/account/reactivate`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/account/reactivate/route.ts` |
| **Methods** | POST |
| **Auth Guard** | Supabase session |
| **DB Writes** | `profiles.is_hibernated = false` |
| **Risk** | LOW - Reactivation |

---

### 10. UTILITY ROUTES

#### `/api/health`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/health/route.ts` |
| **Methods** | GET |
| **Auth Guard** | None |
| **Purpose** | Health check for load balancers |
| **Risk** | LOW |

#### `/api/location/search`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/location/search/route.ts` |
| **Methods** | GET |
| **Auth Guard** | None (public) |
| **External Calls** | Google Places API |
| **Rate Limits** | IP-based |
| **Risk** | MEDIUM - API key exposure in requests |

#### `/api/journal`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/journal/route.ts` |
| **Methods** | GET, POST |
| **Auth Guard** | Supabase session |
| **DB Reads/Writes** | `journal_entries` |
| **Risk** | LOW - CRUD operations |

#### `/api/user/profile`

| Attribute | Value |
|-----------|-------|
| **File** | `app/api/user/profile/route.ts` |
| **Methods** | GET, PATCH |
| **Auth Guard** | Supabase session |
| **Input Validation** | Zod: `profileUpdateSchema` |
| **DB Reads/Writes** | `profiles` |
| **Risk** | MEDIUM - Profile modification |

---

## PAGE ROUTES ANALYSIS

### Protected Pages (require auth + entitlement)

| Route | File | Auth | Entitlement | First Load JS |
|-------|------|------|-------------|---------------|
| `/sanctuary` | `app/(protected)/sanctuary/page.tsx` | Session | membership_plan != "none" OR is_comped | 215 kB |
| `/sanctuary/birth-chart` | `app/(protected)/sanctuary/birth-chart/page.tsx` | Session | Same | 141 kB |
| `/sanctuary/connections` | `app/(protected)/sanctuary/connections/page.tsx` | Session | Same | 207 kB |
| `/sanctuary/numerology` | `app/(protected)/sanctuary/numerology/page.tsx` | Session | Same | 134 kB |
| `/settings` | `app/(protected)/settings/page.tsx` | Session | None | 202 kB |

### Auth Pages

| Route | File | First Load JS |
|-------|------|---------------|
| `/onboarding` | `app/(auth)/onboarding/page.tsx` | 185 kB |
| `/sign-in` | `app/(auth)/sign-in/page.tsx` | 201 kB |
| `/sign-up` | `app/(auth)/sign-up/page.tsx` | 185 kB |
| `/join` | `app/(auth)/join/page.tsx` | 171 kB |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | 131 kB |
| `/reset-password` | `app/(auth)/reset-password/page.tsx` | 186 kB |
| `/set-password` | `app/(auth)/set-password/page.tsx` | 181 kB |
| `/welcome` | `app/(auth)/welcome/page.tsx` | 184 kB |

### Public Pages

| Route | File | First Load JS |
|-------|------|---------------|
| `/` | `app/(public)/page.tsx` | 139 kB |
| `/about` | `app/(public)/about/page.tsx` | 111 kB |
| `/privacy` | `app/(public)/privacy/page.tsx` | 111 kB |
| `/terms` | `app/(public)/terms/page.tsx` | 111 kB |
| `/learn` | `app/(public)/learn/page.tsx` | 133 kB |
| `/learn/[slug]` | `app/(public)/learn/[slug]/page.tsx` | 130 kB (SSG) |
| `/data-deletion` | `app/(public)/data-deletion/page.tsx` | 114 kB |

---

## FINDINGS SUMMARY

### BLOCKERS

None identified.

### HIGH SEVERITY

| ID | Issue | Location | Evidence | Fix |
|----|-------|----------|----------|-----|
| H1 | Public tarot has no caching | `/api/public-tarot` | Each request generates new AI content | Add idempotency via `requestId` cache key |
| H2 | Social sync exposes token decryption | `/api/social/sync` | Token decryption in request path | Verify CRON_SECRET is set in production |
| H3 | Account delete is irreversible | `/api/account/delete` | No soft-delete period | Add 30-day grace period |

### MEDIUM SEVERITY

| ID | Issue | Location | Evidence | Fix |
|----|-------|----------|----------|-----|
| M1 | No Zod schema for connections | `/api/connections` | Inline validation only | Create `connectionSchema` in schemas.ts |
| M2 | Email enumeration via resend | `/api/auth/resend-signup-link` | Different error for existing/new | Return generic success message |
| M3 | Location search exposes API key | `/api/location/search` | Google API key in client requests | Proxy through server |

### LOW SEVERITY

| ID | Issue | Location | Evidence | Fix |
|----|-------|----------|----------|-----|
| L1 | Insights test file has all todo stubs | `__tests__/api/insights.test.ts` | 36 test.todo() | Implement tests |
| L2 | Missing tests for connections | No test file | N/A | Create test file |
| L3 | Birth chart test file has todo stubs | `__tests__/api/birth-chart.test.ts` | All tests are todo | Implement tests |

---

## ROUTE SECURITY MATRIX

| Route | Auth | Rate Limit | Input Validation | Cache | Cost Control | Test Coverage |
|-------|------|------------|------------------|-------|--------------|---------------|
| `/api/insights` | Session | Yes (3 levels) | Manual | Redis | Yes | 0% (todo) |
| `/api/birth-chart` | Session | Yes (burst) | Zod | DB | Yes | 0% (todo) |
| `/api/stripe/webhook` | Signature | No | Stripe SDK | No | N/A | 0% (todo) |
| `/api/connections` | Session | Yes | Manual | No | N/A | 0% |
| `/api/social/sync` | CRON_SECRET | No | Manual | No | Yes | 0% |
| `/api/public-horoscope` | None | IP-based | Zod | Redis | No | 0% |
| `/api/public-tarot` | None | IP + session | Zod | No | No | 0% |
| `/api/public-compatibility` | None | IP-based | Zod | Redis | No | 0% |
