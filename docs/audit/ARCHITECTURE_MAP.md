# Solara Architecture Map

**Version:** 1.0
**Date:** 2026-01-01

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Frontend | Next.js (App Router) | 15.0.0 | React framework with SSR |
| UI | Tailwind CSS | 3.4.1 | Styling |
| UI Components | Radix UI | Various | Accessible primitives |
| Auth | Supabase Auth | 2.86.2 | User authentication |
| Database | Supabase PostgreSQL | - | Primary data store |
| Cache | Redis/Valkey (ioredis) | 5.4.2 | Caching and rate limiting |
| AI | OpenAI API | 6.10.0 | Content generation |
| Payments | Stripe | 20.0.0 | Subscription billing |
| Email | Resend | 4.0.1 | Transactional email |
| i18n | next-intl | 4.6.1 | Internationalization (19 locales) |
| Testing | Vitest | 2.1.8 | Unit/integration tests |
| Astrology | swisseph | 0.5.17 | Ephemeris calculations |

**Source:** `package.json:16-65`

---

## Directory Structure

```
solara/
├── app/                          # Next.js App Router (77 files)
│   ├── (auth)/                   # Auth pages (unauthenticated)
│   │   ├── sign-in/page.tsx      # Email/password + OAuth login
│   │   ├── sign-up/page.tsx      # Registration
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── set-password/page.tsx # For OAuth users setting password
│   │   ├── welcome/page.tsx      # Post-payment landing
│   │   ├── onboarding/page.tsx   # Birth data entry
│   │   └── join/page.tsx         # Pricing/checkout
│   │
│   ├── (protected)/              # Auth-gated pages
│   │   ├── layout.tsx            # Auth + paywall guard (118 lines)
│   │   ├── sanctuary/
│   │   │   ├── page.tsx          # Insights tab (700+ lines)
│   │   │   ├── connections/page.tsx
│   │   │   ├── birth-chart/page.tsx
│   │   │   └── numerology/page.tsx
│   │   └── settings/page.tsx
│   │
│   ├── (public)/                 # Public pages
│   │   ├── page.tsx              # Landing page
│   │   ├── privacy/page.tsx
│   │   ├── terms/page.tsx
│   │   ├── about/page.tsx
│   │   ├── learn/                # Educational content
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   └── data-deletion/page.tsx
│   │
│   ├── auth/                     # Auth callback handlers
│   │   ├── callback/route.ts     # OAuth callback (269 lines)
│   │   └── post-callback/page.tsx
│   │
│   └── api/                      # API routes (47 endpoints)
│       ├── auth/                 # 10 routes
│       │   ├── complete-signup/route.ts
│       │   ├── reset-password/route.ts
│       │   ├── resend-signup-link/route.ts
│       │   ├── login/tiktok/route.ts
│       │   ├── login/tiktok/callback/route.ts
│       │   ├── login/x/route.ts
│       │   ├── login/x/callback/route.ts
│       │   └── reauth/*/route.ts
│       │
│       ├── stripe/               # 4 routes
│       │   ├── checkout/route.ts
│       │   ├── webhook/route.ts  # 414 lines
│       │   ├── claim-session/route.ts
│       │   └── session-info/route.ts
│       │
│       ├── insights/route.ts     # 704 lines - AI insight generation
│       ├── birth-chart/route.ts
│       ├── numerology/route.ts
│       ├── numerology/lucky/route.ts
│       │
│       ├── journal/              # 3 routes
│       │   ├── route.ts
│       │   ├── delete/route.ts
│       │   └── export/route.ts
│       │
│       ├── connections/route.ts
│       ├── connection-brief/route.ts
│       ├── connection-insight/route.ts
│       ├── connection-space-between/route.ts
│       │
│       ├── social/               # 6 routes
│       │   ├── oauth/[provider]/connect/route.ts
│       │   ├── oauth/[provider]/callback/route.ts
│       │   ├── status/route.ts
│       │   ├── sync/route.ts
│       │   ├── sync-user/route.ts
│       │   └── revoke/route.ts
│       │
│       ├── user/                 # 2 routes
│       │   ├── profile/route.ts
│       │   └── social-insights/route.ts
│       │
│       ├── account/              # 3 routes
│       │   ├── delete/route.ts
│       │   ├── hibernate/route.ts
│       │   └── reactivate/route.ts
│       │
│       ├── cron/                 # 3 routes
│       │   ├── social-sync/route.ts
│       │   ├── prewarm-insights/route.ts
│       │   └── generate-global-events/route.ts
│       │
│       ├── public-*/route.ts     # 3 public AI routes
│       │   ├── public-horoscope/route.ts
│       │   ├── public-tarot/route.ts
│       │   └── public-compatibility/route.ts
│       │
│       ├── location/search/route.ts
│       ├── health/route.ts
│       └── meta/facebook/        # GDPR compliance
│           ├── data-deletion/route.ts
│           └── deauthorize/route.ts
│
├── lib/                          # Shared utilities (80 files)
│   ├── supabase/                 # Database clients
│   │   ├── client.ts             # Browser client (25 lines)
│   │   ├── server.ts             # Server client + admin (67 lines)
│   │   └── service.ts            # Service role client (39 lines)
│   │
│   ├── cache/                    # Caching layer
│   │   ├── redis.ts              # Redis client + locking (349 lines)
│   │   ├── rateLimit.ts          # Rate limiting (262 lines)
│   │   └── tarotRateLimit.ts
│   │
│   ├── openai/
│   │   └── client.ts             # OpenAI setup + models (40 lines)
│   │
│   ├── stripe/
│   │   ├── client.ts             # Stripe client (27 lines)
│   │   └── claimCheckoutSession.ts
│   │
│   ├── ai/                       # AI utilities
│   │   ├── costControl.ts        # Budget circuit breaker (180 lines)
│   │   ├── trackUsage.ts         # Usage telemetry (112 lines)
│   │   ├── tokenAudit.ts         # Token logging
│   │   ├── pricing.ts            # Cost estimation (65 lines)
│   │   └── voice.ts              # AI personality prompts
│   │
│   ├── auth/
│   │   ├── helpers.ts
│   │   ├── oauthSession.ts       # OAuth state management (89 lines)
│   │   ├── reauth.ts
│   │   └── socialConsent.ts
│   │
│   ├── oauth/providers/          # OAuth adapters
│   │   ├── meta.ts               # Facebook/Instagram
│   │   ├── x.ts                  # X/Twitter (231 lines, disabled)
│   │   ├── tiktok.ts
│   │   ├── reddit.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── social/
│   │   ├── oauth.ts              # Token management
│   │   ├── crypto.ts             # Token encryption (92 lines)
│   │   ├── staleness.ts          # Stale data detection
│   │   ├── summarize.ts          # Post summarization
│   │   └── socialRateLimit.ts
│   │
│   ├── numerology/               # Numerology calculations
│   │   ├── coreNumbers.ts
│   │   ├── cycles.ts
│   │   ├── karmicDebt.ts
│   │   ├── pinnacles.ts
│   │   ├── luckyNumbers.ts
│   │   ├── meanings.ts
│   │   ├── storage.ts
│   │   ├── utils.ts
│   │   ├── constants.ts
│   │   └── index.ts
│   │
│   ├── api/
│   │   └── errorResponse.ts      # Standardized errors (134 lines)
│   │
│   ├── insights/
│   │   ├── normalizeInsight.ts
│   │   └── yearContext.ts
│   │
│   ├── location/
│   │   ├── detection.ts
│   │   └── resolveBirthLocation.ts
│   │
│   ├── timezone/
│   │   └── periodKeys.ts         # Cache key generation
│   │
│   ├── url/
│   │   └── base.ts               # URL helpers (52 lines)
│   │
│   └── [other utilities]
│
├── components/                   # React components (~50 files)
│   ├── ui/                       # Base UI (Radix-based)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── tabs.tsx
│   │   ├── sheet.tsx
│   │   └── [others]
│   │
│   ├── layout/
│   │   ├── NavBar.tsx
│   │   ├── Footer.tsx            # Uses translations
│   │   └── SolaraLogo.tsx
│   │
│   ├── home/                     # Landing page
│   ├── sanctuary/                # Sanctuary UI
│   ├── charts/                   # Birth chart visuals
│   ├── auth/                     # Auth UI
│   ├── learn/                    # Educational
│   └── shared/                   # Shared components
│
├── messages/                     # i18n translation files (19)
│   ├── en.json                   # English (source)
│   ├── es.json, fr.json, de.json, pt.json, it.json
│   ├── nl.json, pl.json, ru.json
│   ├── zh-TW.json, ja.json, ko.json
│   ├── vi.json, th.json, id.json, tl.json
│   ├── hi.json, ta.json, ar.json
│
├── types/
│   └── index.ts                  # All types (558 lines)
│
├── providers/
│   └── SettingsProvider.tsx
│
├── contexts/
│
├── hooks/
│
├── __tests__/                    # Test files (13)
│   ├── setup.ts                  # Vitest configuration (223 lines)
│   ├── api/                      # 2 tests
│   ├── auth/                     # 3 tests
│   ├── payments/                 # 3 tests
│   ├── infrastructure/           # 3 tests
│   ├── security/                 # 1 test
│   ├── validation/               # 1 test
│   └── mocks/
│
├── sql/                          # Database migrations (21)
│
├── docs/                         # Documentation
│
└── public/                       # Static assets
```

---

## Critical Infrastructure Files

### P0 - Highest Risk

| File | Lines | Purpose | Risk Factors |
|------|-------|---------|--------------|
| `lib/stripe/client.ts` | 27 | Stripe SDK init | Empty key creates client |
| `app/api/stripe/webhook/route.ts` | 414 | Payment webhooks | Signature verification |
| `lib/supabase/server.ts` | 67 | Admin DB access | Service role key |
| `app/(protected)/layout.tsx` | 118 | Paywall guard | Bypass flags |
| `lib/social/crypto.ts` | 92 | Token encryption | Key management |

### P1 - High Risk

| File | Lines | Purpose | Risk Factors |
|------|-------|---------|--------------|
| `lib/cache/redis.ts` | 349 | Caching + locking | Fail mode behavior |
| `lib/ai/costControl.ts` | 180 | Budget limits | Circuit breaker |
| `app/auth/callback/route.ts` | 269 | OAuth callback | Redirect security |
| `lib/openai/client.ts` | 40 | AI client config | Model names |
| `app/api/insights/route.ts` | 704 | Main AI endpoint | Rate limiting |

---

## Core Systems Detail

### 1. Authentication System

**Entry Points:**
- `app/(auth)/sign-in/page.tsx` - Email/password + OAuth
- `app/(auth)/sign-up/page.tsx` - New user registration
- `app/auth/callback/route.ts:50-268` - OAuth callback handler

**Key Functions:**

`app/auth/callback/route.ts:70-71`:
```typescript
const supabase = await createServerSupabaseClient();
const { data, error } = await supabase.auth.exchangeCodeForSession(code);
```

`app/auth/callback/route.ts:220-238` - Open redirect protection:
```typescript
const ALLOWED_NEXT = new Set([
  "/onboarding", "/set-password", "/settings?refresh=1", "/sanctuary", "/welcome",
]);
```

**Auth Guard:** `app/(protected)/layout.tsx:37-118`
```typescript
export default async function ProtectedLayout({ children }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { redirect("/sign-in"); }
  // ... paywall checks
}
```

### 2. Payment System

**Entry Points:**
- `app/api/stripe/checkout/route.ts:5-81` - Create checkout session
- `app/api/stripe/webhook/route.ts:85-158` - Handle Stripe events
- `app/api/stripe/claim-session/route.ts` - Link payment to user

**Webhook Event Handling:** `app/api/stripe/webhook/route.ts:125-148`
```typescript
switch (event.type) {
  case "checkout.session.completed":
    await handleCheckoutCompleted(event.data.object);
    break;
  case "customer.subscription.updated":
    await handleSubscriptionUpdated(event.data.object);
    break;
  case "customer.subscription.deleted":
    await handleSubscriptionDeleted(event.data.object);
    break;
}
```

**Plan Resolution:** `app/api/stripe/webhook/route.ts:20-79`
```typescript
async function resolvePlanFromSession(session): Promise<{plan, priceId, source} | null> {
  // 1. Check metadata first
  const metadataPlan = session.metadata?.plan;
  // 2. Retrieve session with expanded line_items
  // 3. Compare against configured price IDs
}
```

### 3. AI/Insights System

**Entry Point:** `app/api/insights/route.ts:63-703`

**Rate Limiting Stack:** Lines 276-326
```typescript
// Burst check (20 requests in 10 seconds)
const burstResult = await checkBurstLimit(`insights:${user.id}`, BURST_LIMIT, BURST_WINDOW);

// Cooldown check (5 second cooldown)
const cooldownKey = `insights:cooldown:${user.id}`;

// Sustained rate limit (60 generations per hour)
const rateLimitResult = await checkRateLimit(`insights:rate:${user.id}`, USER_RATE_LIMIT, USER_RATE_WINDOW);
```

**Cost Control:** Lines 408-419
```typescript
const budgetCheck = await checkBudget();
if (!budgetCheck.allowed) {
  return createApiErrorResponse({...status: 503});
}
```

**Distributed Locking:** Lines 422-467
```typescript
const lockResult = await acquireLockFailClosed(lockKey, 60);
if (lockResult.redisDown) {
  return createApiErrorResponse({...status: 503});
}
```

**Model Selection:** `lib/openai/client.ts:20-39`
```typescript
export const OPENAI_MODELS = {
  dailyInsights: process.env.OPENAI_DAILY_INSIGHTS_MODEL || "gpt-4.1-mini",
  yearlyInsights: process.env.OPENAI_YEARLY_INSIGHTS_MODEL || "gpt-5.1",
  birthChart: process.env.OPENAI_BIRTHCHART_MODEL || "gpt-5.1",
  deep: process.env.OPENAI_DEEP_MODEL || "gpt-4o",
  fast: process.env.OPENAI_FAST_MODEL || "gpt-4o-mini",
};
```

### 4. Caching System

**Implementation:** `lib/cache/redis.ts`

**Graceful Degradation:** Lines 26-61
```typescript
function initRedis(): void {
  if (redisInitialized) return;
  const redisUrl = process.env.REDIS_URL || process.env.VALKEY_URL;
  if (!redisUrl) {
    console.warn("[Cache] No REDIS_URL or VALKEY_URL found. Caching is disabled.");
    return;
  }
  // ...
}
```

**Fail-Closed Locking:** Lines 221-240
```typescript
export async function acquireLockFailClosed(lockKey, ttlSeconds = 30) {
  if (!redis || !redisAvailable) {
    return { acquired: false, redisDown: true };  // FAIL CLOSED
  }
  // ...
}
```

**Cache Key Patterns:** Lines 322-348
```typescript
export function getDayKey(timezone, date = new Date()): string {
  return `day:${toLocalDateString(date, timezone)}`;
}
export function getWeekKey(timezone, date = new Date()): string {
  return `week:${toLocalWeekString(date, timezone)}`;
}
```

### 5. Translation System

**Configuration:** `i18n.ts:8-28`
```typescript
export const locales = [
  "en", "es", "fr", "de", "pt", "it", "nl", "pl", "ru",
  "zh-TW", "ja", "ko", "vi", "th", "id", "tl", "hi", "ta", "ar",
] as const;

export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
```

**RTL Support:** `i18n.ts:87-94`
```typescript
export const rtlLocales: Locale[] = ["ar"];
export function isRtlLocale(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}
```

---

## Database Schema (Key Tables)

From `sql/*.sql` migrations:

| Table | Migration | Purpose |
|-------|-----------|---------|
| `profiles` | (base) | User profiles, birth data, settings |
| `soul_paths` | 002 | Stored numerology calculations |
| `birth_chart_cache` | 001 | Cached birth chart data |
| `connections` | 007 | User connections (relationships) |
| `daily_briefs` | 007 | Daily connection briefs |
| `space_between_reports` | 007 | Deep relationship reports |
| `social_accounts` | 013 | OAuth tokens (encrypted) |
| `social_summaries` | 011 | Summarized social posts |
| `journal_entries` | (base) | User journal entries |
| `ai_usage_events` | (base) | AI usage telemetry |
| `global_astrology_events` | 020 | Yearly astrological events |

---

## Environment Variables

### Required in Production

```env
# Supabase (lib/supabase/*.ts)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe (lib/stripe/client.ts)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=

# OpenAI (lib/openai/client.ts)
OPENAI_API_KEY=

# Site URL (lib/url/base.ts)
NEXT_PUBLIC_SITE_URL=
```

### Optional with Graceful Degradation

```env
# Redis (lib/cache/redis.ts:30-35)
REDIS_URL=  # or VALKEY_URL

# AI Budget Control (lib/ai/costControl.ts:21-35)
OPENAI_DAILY_BUDGET_USD=100
OPENAI_BUDGET_FAIL_MODE=closed

# Social OAuth (lib/social/crypto.ts:19-23)
SOCIAL_TOKEN_ENCRYPTION_KEY=  # Required if social features used
META_CLIENT_ID=
META_CLIENT_SECRET=

# Cron (app/api/cron/*/route.ts)
CRON_SECRET=
```

### Development Only

```env
# app/(protected)/layout.tsx:11-30
DEV_PAYWALL_BYPASS=false  # NEVER true in production
```

---

*Architecture documentation for Solara Insights*
