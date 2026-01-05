# Solara Architecture Map

**Version:** 1.0
**Date:** 2026-01-01

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15 (App Router) | React framework with SSR |
| UI | Tailwind CSS, Radix UI | Styling and components |
| Auth | Supabase Auth | User authentication |
| Database | Supabase PostgreSQL | Primary data store |
| Cache | Redis/Valkey (ioredis) | Caching and rate limiting |
| AI | OpenAI API | Content generation |
| Payments | Stripe | Subscription billing |
| Email | Resend | Transactional email |
| i18n | next-intl v4.6.1 | Internationalization (19 locales) |
| Testing | Vitest + Testing Library | Unit/integration tests |

---

## Directory Structure

```
solara/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth pages (sign-in, sign-up, etc.)
│   │   ├── sign-in/page.tsx
│   │   ├── sign-up/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── set-password/page.tsx
│   │   ├── welcome/page.tsx
│   │   ├── onboarding/page.tsx
│   │   └── join/page.tsx
│   ├── (protected)/              # Auth-gated pages
│   │   ├── layout.tsx            # Auth + paywall guard
│   │   ├── sanctuary/            # Main product area
│   │   │   ├── page.tsx          # Insights tab
│   │   │   ├── connections/      # Connections tab
│   │   │   ├── birth-chart/      # Birth chart tab
│   │   │   └── numerology/       # Numerology tab
│   │   └── settings/page.tsx     # User settings
│   ├── (public)/                 # Public pages
│   │   ├── page.tsx              # Home/landing
│   │   ├── privacy/              # Privacy policy
│   │   ├── terms/                # Terms of service
│   │   ├── about/                # About page
│   │   ├── learn/                # Educational content
│   │   └── data-deletion/        # GDPR data deletion
│   ├── auth/                     # Auth callback handlers
│   │   ├── callback/route.ts     # OAuth callback
│   │   └── post-callback/page.tsx
│   ├── api/                      # API routes (47 endpoints)
│   │   ├── auth/                 # Auth-related APIs
│   │   ├── stripe/               # Payment APIs
│   │   ├── insights/             # AI insight generation
│   │   ├── birth-chart/          # Birth chart API
│   │   ├── numerology/           # Numerology API
│   │   ├── journal/              # Journal CRUD
│   │   ├── connections/          # Connections CRUD
│   │   ├── social/               # Social OAuth + sync
│   │   ├── user/                 # User profile APIs
│   │   ├── account/              # Account management
│   │   ├── cron/                 # Scheduled jobs
│   │   └── meta/                 # Facebook compliance
│   └── layout.tsx                # Root layout
│
├── lib/                          # Shared utilities (80 files)
│   ├── supabase/                 # Database clients
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client + admin
│   │   └── service.ts            # Service role client
│   ├── cache/                    # Caching layer
│   │   ├── redis.ts              # Redis client + locking
│   │   ├── rateLimit.ts          # Rate limiting
│   │   └── tarotRateLimit.ts     # Tarot-specific limits
│   ├── openai/                   # AI client
│   │   └── client.ts             # OpenAI setup + models
│   ├── stripe/                   # Payment utilities
│   │   ├── client.ts             # Stripe client
│   │   └── claimCheckoutSession.ts
│   ├── auth/                     # Auth helpers
│   │   ├── helpers.ts            # Common auth functions
│   │   ├── oauthSession.ts       # OAuth state management
│   │   ├── reauth.ts             # Reauthentication flow
│   │   └── socialConsent.ts      # Social consent modal
│   ├── oauth/                    # OAuth providers
│   │   ├── providers/            # Provider adapters
│   │   │   ├── meta.ts           # Facebook/Instagram
│   │   │   ├── x.ts              # X/Twitter (disabled)
│   │   │   ├── tiktok.ts         # TikTok
│   │   │   └── reddit.ts         # Reddit
│   │   └── pkce.ts               # PKCE utilities
│   ├── ai/                       # AI utilities
│   │   ├── costControl.ts        # Budget circuit breaker
│   │   ├── trackUsage.ts         # Usage telemetry
│   │   ├── tokenAudit.ts         # Token logging
│   │   ├── pricing.ts            # Cost estimation
│   │   └── voice.ts              # AI personality prompts
│   ├── numerology/               # Numerology calculations
│   │   ├── coreNumbers.ts        # Life path, etc.
│   │   ├── cycles.ts             # Personal year/month/day
│   │   ├── karmicDebt.ts         # Karmic debt numbers
│   │   ├── pinnacles.ts          # Pinnacle calculations
│   │   └── luckyNumbers.ts       # Lucky number generation
│   ├── social/                   # Social sync
│   │   ├── oauth.ts              # Token management
│   │   ├── crypto.ts             # Token encryption
│   │   ├── staleness.ts          # Stale data detection
│   │   └── summarize.ts          # Post summarization
│   ├── api/                      # API utilities
│   │   └── errorResponse.ts      # Standardized errors
│   ├── insights/                 # Insight utilities
│   │   ├── normalizeInsight.ts   # Response normalization
│   │   └── yearContext.ts        # Yearly context builder
│   ├── location/                 # Geolocation
│   │   ├── detection.ts          # Timezone detection
│   │   └── resolveBirthLocation.ts
│   └── timezone/                 # Timezone utilities
│       └── periodKeys.ts         # Cache key generation
│
├── components/                   # React components (~50 files)
│   ├── ui/                       # Base UI components
│   │   ├── button.tsx            # Button variants
│   │   ├── card.tsx              # Card component
│   │   ├── dialog.tsx            # Modal dialogs
│   │   ├── input.tsx             # Form inputs
│   │   ├── tabs.tsx              # Tab component
│   │   └── sheet.tsx             # Slide-out panels
│   ├── layout/                   # Layout components
│   │   ├── NavBar.tsx            # Navigation bar
│   │   ├── Footer.tsx            # Page footer
│   │   └── SolaraLogo.tsx        # Brand logo
│   ├── home/                     # Landing page components
│   ├── sanctuary/                # Sanctuary components
│   ├── charts/                   # Birth chart visuals
│   ├── auth/                     # Auth UI components
│   ├── learn/                    # Educational components
│   └── shared/                   # Shared components
│
├── messages/                     # i18n translation files
│   ├── en.json                   # English (source)
│   ├── es.json                   # Spanish
│   ├── fr.json                   # French
│   └── ... (19 locales total)
│
├── types/                        # TypeScript definitions
│   └── index.ts                  # All types (558 lines)
│
├── providers/                    # React context providers
│   └── SettingsProvider.tsx      # User settings context
│
├── contexts/                     # Additional contexts
│
├── hooks/                        # Custom React hooks
│
├── __tests__/                    # Test files
│   ├── setup.ts                  # Vitest configuration
│   ├── api/                      # API route tests
│   ├── auth/                     # Auth flow tests
│   ├── payments/                 # Stripe tests
│   ├── infrastructure/           # Infra tests
│   └── security/                 # Security tests
│
├── sql/                          # Database migrations (21 files)
│   ├── 001_add_birth_chart_cache.sql
│   ├── 007_connections_v2.sql
│   ├── 011_social_insights_pipeline.sql
│   ├── 017_hibernate_account.sql
│   └── ...
│
├── docs/                         # Documentation
│
└── public/                       # Static assets
```

---

## Core Systems

### 1. Authentication System

**Entry Points:**
- `app/(auth)/sign-in/page.tsx` - Email/password + OAuth
- `app/(auth)/sign-up/page.tsx` - New user registration
- `app/auth/callback/route.ts` - OAuth callback handler

**Key Components:**
- `lib/supabase/server.ts` - Server-side Supabase client
- `lib/auth/oauthSession.ts` - OAuth state management
- `app/(protected)/layout.tsx` - Auth guard + paywall

**Auth Providers:**
- Supabase Email/Password
- Facebook OAuth (via Meta)
- TikTok OAuth
- X/Twitter OAuth (disabled)
- Reddit OAuth

### 2. Payment System

**Entry Points:**
- `app/api/stripe/checkout/route.ts` - Create checkout session
- `app/api/stripe/webhook/route.ts` - Handle Stripe events
- `app/api/stripe/claim-session/route.ts` - Link payment to user

**Key Components:**
- `lib/stripe/client.ts` - Stripe SDK initialization
- `lib/stripe/claimCheckoutSession.ts` - Session claiming logic

**Subscription Plans:**
- `individual` - Single user plan
- `family` - Multi-user plan (price in STRIPE_FAMILY_PRICE_ID)

### 3. AI/Insights System

**Entry Points:**
- `app/api/insights/route.ts` - Daily/yearly insights
- `app/api/birth-chart/route.ts` - Birth chart generation
- `app/api/public-horoscope/route.ts` - Public horoscopes
- `app/api/public-tarot/route.ts` - Public tarot readings

**Key Components:**
- `lib/openai/client.ts` - OpenAI SDK + model config
- `lib/ai/costControl.ts` - Budget circuit breaker
- `lib/ai/voice.ts` - AI personality (Ayren)
- `lib/cache/redis.ts` - Response caching

**Model Routing:**
| Use Case | Model | Notes |
|----------|-------|-------|
| Daily insights | gpt-4o-mini | Fast, cheap |
| Yearly insights | gpt-4o | Premium, cached |
| Birth chart | gpt-4o | Premium, permanent |
| Deep analysis | gpt-4o | For Space Between |

### 4. Caching System

**Implementation:** Redis via ioredis

**Key Features:**
- Graceful degradation (works without Redis)
- Distributed locking (prevent duplicate AI calls)
- Timezone-aware cache keys
- Fail-closed for expensive operations

**Cache Key Patterns:**
```
insights:{userId}:{timeframe}:{periodKey}:{lang}:v{version}
lock:insights:{userId}:{timeframe}:{periodKey}:v{version}
openai:budget:{YYYY-MM-DD}
```

### 5. Translation System

**Implementation:** next-intl v4.6.1

**Locales (19):**
English, Spanish, French, German, Portuguese, Italian, Dutch, Polish, Russian, Traditional Chinese, Japanese, Korean, Vietnamese, Thai, Indonesian, Filipino, Hindi, Tamil, Arabic

**Key Files:**
- `i18n.ts` - Locale configuration
- `messages/*.json` - Translation files
- Components use `useTranslations()` hook

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (birth data, settings) |
| `soul_paths` | Stored numerology calculations |
| `birth_chart_cache` | Cached birth chart data |
| `connections` | User connections (relationships) |
| `daily_briefs` | Daily connection briefs |
| `space_between_reports` | Deep relationship reports |
| `social_accounts` | OAuth tokens (encrypted) |
| `social_summaries` | Summarized social posts |
| `journal_entries` | User journal entries |
| `ai_usage_events` | AI usage telemetry |
| `global_astrology_events` | Yearly astrological events |

---

## Critical Infrastructure Files

| File | Purpose | Risk |
|------|---------|------|
| `lib/supabase/server.ts` | Database access | HIGH |
| `lib/stripe/client.ts` | Payment processing | HIGH |
| `lib/openai/client.ts` | AI gateway | HIGH |
| `lib/cache/redis.ts` | Caching/locking | MEDIUM |
| `lib/ai/costControl.ts` | Budget protection | MEDIUM |
| `app/(protected)/layout.tsx` | Auth/paywall guard | HIGH |
| `app/api/stripe/webhook/route.ts` | Payment events | HIGH |
| `lib/social/crypto.ts` | Token encryption | HIGH |

---

## Environment Variables

### Required (Production)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=

# OpenAI
OPENAI_API_KEY=

# Site
NEXT_PUBLIC_SITE_URL=
```

### Optional

```env
# Redis (graceful degradation if missing)
REDIS_URL=

# AI Budget Control
OPENAI_DAILY_BUDGET_USD=100
OPENAI_BUDGET_FAIL_MODE=closed

# Social OAuth (per provider)
META_CLIENT_ID=
META_CLIENT_SECRET=
SOCIAL_TOKEN_ENCRYPTION_KEY=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Cron
CRON_SECRET=

# Development
DEV_PAYWALL_BYPASS=false
```

---

## API Routes Summary

### Public (No Auth)
- `GET/POST /api/public-horoscope` - Daily horoscopes
- `POST /api/public-tarot` - Tarot readings
- `POST /api/public-compatibility` - Zodiac compatibility
- `GET /api/health` - Health check

### Auth Required
- `POST /api/insights` - Personal insights
- `GET/POST /api/birth-chart` - Birth chart
- `GET/POST /api/connections` - Manage connections
- `GET /api/journal` - Journal entries
- `POST /api/user/profile` - Update profile

### Admin/Cron
- `POST /api/cron/social-sync` - Sync social data
- `POST /api/cron/prewarm-insights` - Cache warming
- `POST /api/cron/generate-global-events` - Astro events

### Webhooks
- `POST /api/stripe/webhook` - Stripe events
- `POST /api/meta/facebook/data-deletion` - GDPR compliance

---

*Architecture documentation for Solara Insights*
