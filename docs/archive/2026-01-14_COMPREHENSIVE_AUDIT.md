# Solara Comprehensive Audit Report

**Date:** 2026-01-14
**Branch:** `pr5-rls-hardening`
**Auditor:** Claude Code (Exhaustive Scan)

---

## A. Executive Summary

### Current State
- ✅ **Build is green**: `pnpm lint`, `pnpm typecheck`, `pnpm build` all pass
- ✅ **80/80 pages generated** without errors
- ✅ **24 migrations applied cleanly** with `supabase db reset`
- ✅ **AI usage tracking fixed**: Schema mismatch resolved (`cost_micros`, `upsert_ai_usage_rollup_daily`)
- ✅ **RLS hardening complete**: Sensitive tables locked to `service_role`
- ✅ **All 10 OpenAI call sites tracked** with `trackAiUsage()`
- ✅ **Cost control circuit breaker** implemented in all AI routes

### Top Risks
- 🔴 **DEV AUTH BROKEN**: Social login + email login fails on dev.website (see Section C)
- 🟠 **Large file complexity**: birth-chart/route.ts = 1045 lines (maintenance risk)
- 🟠 **console.warn/error density**: 291 occurrences across API routes (needs structured logging)
- 🟡 **9 TODOs remain in production code** (minor but incomplete features)

### What Blocks Launch
1. **Fix dev.website auth** (cannot test without login)
2. **Verify prod Supabase redirect URLs** include all OAuth callbacks
3. **Ensure NEXT_PUBLIC_SITE_URL is correct** on all environments

---

## B. Launch Readiness Scoreboard

| Subsystem | % Ready | Evidence | Risks | Next Actions | Confidence |
|-----------|---------|----------|-------|--------------|------------|
| **1. Build/CI** | 95% | `pnpm build` passes, lint/typecheck clean | No CI workflow visible | Add GitHub Actions | High |
| **2. Route Boundaries** | 92% | Protected layout auth guard, public layout exists | 9 TODOs | Complete or remove TODOs | High |
| **3. Auth + Onboarding** | 85% | OAuth PKCE, email/pass, callback routes | Dev env broken | Fix dev.website config | Med |
| **4. Supabase Schema + RLS** | 98% | 24 migrations, service_role policies | None | Verify prod match | High |
| **5. Sanctuary Core** | 90% | Birth chart, insights, connections work | Large files | Split birth-chart route | High |
| **6. Public Pages + SEO** | 85% | Horoscope, tarot, compatibility exist | Missing meta audit | Add SEO verification | Med |
| **7. OpenAI Integration** | 98% | 10 call sites, all tracked + budgeted | None | Monitor costs | High |
| **8. Cost Controls** | 98% | checkBudget in 13 files, $100/day default | None | Adjust budget if needed | High |
| **9. Caching/Rate Limiting** | 90% | Redis layer, graceful degradation | REDIS_URL required | Verify Valkey on Render | Med |
| **10. Observability** | 70% | console.warn/error used | 291 occurrences | Add structured logging | Med |
| **11. Security** | 95% | RLS, PKCE, webhook sig verification | None critical | Audit prod secrets | High |
| **12. Performance** | 85% | Caching works, large routes exist | 1045-line file | Profile critical paths | Med |
| **13. Dependency Health** | 90% | All deps used | None unused | Run depcheck | High |

---

## C. Dev.website Auth + Pipelines Fix Plan (CRITICAL)

### Problem Statement

On `dev.website`:
- ❌ Social login (Facebook, TikTok) fails
- ❌ Email/password login fails
- ❌ Social media pipelines fail

### Root Cause Analysis

#### 1. **NEXT_PUBLIC_SITE_URL Mismatch** (Most Likely)

**Evidence:**
- Used in **35+ locations** for OAuth callback URLs
- [lib/url/base.ts:19](lib/url/base.ts#L19): `getClientBaseUrl()` returns `NEXT_PUBLIC_SITE_URL`
- [app/auth/callback/route.ts:15](app/auth/callback/route.ts#L15): Callback uses this for redirects

**Diagnosis:**
If `dev.website` has:
```
NEXT_PUBLIC_SITE_URL=https://solarainsights.com  # Wrong!
```
Then OAuth will redirect to production instead of dev.

**Fix:**
```env
# For dev.website environment
NEXT_PUBLIC_SITE_URL=https://dev.solarainsights.com
```

#### 2. **Supabase Auth Redirect URLs Not Configured**

**Evidence:**
- Supabase requires allowlisted redirect URLs
- If `https://dev.solarainsights.com/auth/callback` is not in the list, auth fails silently

**Fix Steps:**
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add to **Redirect URLs**:
   ```
   https://dev.solarainsights.com/auth/callback
   https://dev.solarainsights.com/api/auth/login/tiktok/callback
   https://dev.solarainsights.com/api/social/oauth/facebook/callback
   https://dev.solarainsights.com/api/social/oauth/tiktok/callback
   ```
3. Set **Site URL**:
   ```
   https://dev.solarainsights.com
   ```

#### 3. **OAuth Provider Console Configuration**

**For Facebook (Meta):**
1. Go to Meta Developer Console → Your App → Facebook Login → Settings
2. Add **Valid OAuth Redirect URIs**:
   ```
   https://dev.solarainsights.com/auth/callback
   https://dev.solarainsights.com/api/social/oauth/facebook/callback
   ```

**For TikTok:**
1. Go to TikTok Developer Portal → Your App → Login Kit → Settings
2. Add **Redirect URIs**:
   ```
   https://dev.solarainsights.com/api/auth/login/tiktok/callback
   https://dev.solarainsights.com/api/social/oauth/tiktok/callback
   ```

#### 4. **Dev vs Prod Supabase Project**

**Critical Question:** Does `dev.website` use the same Supabase project as production?

**If SAME project:**
- ✅ Users are shared (prod accounts work on dev)
- ⚠️ Risk: Dev testing affects prod data
- Fix: Just configure redirect URLs

**If DIFFERENT project (recommended):**
- ✅ Isolated data
- ❌ Users are NOT shared (must create separate test accounts)
- Fix: Configure separate Supabase project for dev

**Recommendation:** Use **separate Supabase project** for dev to avoid prod data corruption.

### Exact Files to Inspect

| Purpose | File |
|---------|------|
| Browser Supabase client | [lib/supabase/client.ts](lib/supabase/client.ts) |
| Server Supabase client | [lib/supabase/server.ts](lib/supabase/server.ts) |
| OAuth callback URL builder | [lib/url/base.ts](lib/url/base.ts) |
| Supabase auth callback | [app/auth/callback/route.ts](app/auth/callback/route.ts) |
| TikTok login callback | [app/api/auth/login/tiktok/callback/route.ts](app/api/auth/login/tiktok/callback/route.ts) |
| Facebook OAuth (via Supabase) | [app/(auth)/sign-in/page.tsx:125](app/(auth)/sign-in/page.tsx#L125) |
| Social OAuth connect | [app/api/social/oauth/[provider]/connect/route.ts](app/api/social/oauth/%5Bprovider%5D/connect/route.ts) |
| Social OAuth callback | [app/api/social/oauth/[provider]/callback/route.ts](app/api/social/oauth/%5Bprovider%5D/callback/route.ts) |

### Step-by-Step Fix Plan

#### Step 1: Verify Dev Environment Variables

On `dev.website` hosting platform, ensure:

```env
# MUST be dev domain, NOT production
NEXT_PUBLIC_SITE_URL=https://dev.solarainsights.com

# Supabase - can be same as prod OR separate dev project
NEXT_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-key

# OAuth credentials (same as prod is fine)
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
```

#### Step 2: Configure Supabase Dashboard

1. **Site URL**: `https://dev.solarainsights.com`
2. **Redirect URLs** (add all):
   - `https://dev.solarainsights.com/auth/callback`
   - `https://dev.solarainsights.com/api/auth/login/tiktok/callback`
   - `https://dev.solarainsights.com/api/social/oauth/facebook/callback`
   - `https://dev.solarainsights.com/api/social/oauth/tiktok/callback`
   - `https://dev.solarainsights.com/api/auth/login/x/callback`
   - `https://dev.solarainsights.com/api/social/oauth/x/callback`

#### Step 3: Configure OAuth Providers

**Meta (Facebook):**
1. Add dev callback URLs to Facebook Login settings
2. Ensure app is in "Live" mode or dev user is added as tester

**TikTok:**
1. Add dev callback URLs to TikTok Developer Portal
2. Ensure app is approved or in sandbox mode

#### Step 4: Verification Test Matrix

| Test | Action | Expected |
|------|--------|----------|
| Email sign-up | Create account → Check email → Click link | Lands on `/welcome` |
| Email sign-in | Sign in with existing account | Lands on `/sanctuary` or `/join` |
| Facebook login | Click Facebook button | Redirects to FB → Back to `/auth/post-callback` |
| TikTok login | Click TikTok button | Redirects to TikTok → Back to `/auth/post-callback` |
| Social connect | In settings, connect FB | Redirects → Returns with success |

#### Step 5: Debug Commands

If still failing, enable debug logs:

```env
OAUTH_DEBUG_LOGS=true
DEBUG_MIDDLEWARE=true
```

Then check server logs for:
- `[AuthCallback] NEXT_PUBLIC_SITE_URL: ...`
- `[TikTok Login] ... baseUrl: ...`
- `[OAuth Debug] ... redirectUri: ...`

---

## D. Refactor Radar

### 🔴 High ROI (Small effort, big payoff)

| Item | File | Lines | Why |
|------|------|-------|-----|
| **Extract birth chart sections** | [birth-chart/route.ts](app/api/birth-chart/route.ts) | 1045 | Largest file, multiple concerns |
| **Add structured logging** | All API routes | 291 console calls | Improves observability |
| **Remove Reddit stub** | [sign-in/page.tsx:202](app/(auth)/sign-in/page.tsx#L202) | 8 | Dead code |

### 🟡 Medium ROI

| Item | File | Why |
|------|------|-----|
| **Extract prompt templates** | AI routes | 500+ lines of prompts inline |
| **Consolidate OAuth callbacks** | 3 separate callback patterns | Maintenance burden |
| **Add error boundaries** | Protected pages | Better UX on failures |

### 🟢 Avoid For Now

| Item | Why |
|------|-----|
| Split insights/route.ts | 714 lines but single concern |
| Migrate to Bun | No benefit, adds risk |
| Add more locales | 19 already supported |

---

## E. Dead Code + Bloat Removal

### Unused Exports

| Export | File | Risk |
|--------|------|------|
| `getDailyUsageSummary` | [trackUsage.ts:190](lib/ai/trackUsage.ts#L190) | Low - keep for future dashboard |
| `estimateCostMicros` (indirect) | [pricing.ts:104](lib/ai/pricing.ts#L104) | Low - used by `estimateCostCents` |

### Unused Routes

**None found** - all routes are reachable.

### Deletable Files

| File | Reason | Risk |
|------|--------|------|
| `supabase/migrations/verification_*.sql` | Should be in `verification/` folder | ✅ Already moved |

### Repeated Utilities

| Pattern | Locations | Action |
|---------|-----------|--------|
| `baseUrl = process.env.NEXT_PUBLIC_SITE_URL \|\| "http://localhost:3000"` | 20+ files | Use `getServerBaseUrl()` |
| `const supabase = await createServerSupabaseClient()` | 40+ files | Fine - standard pattern |

---

## F. Top 25 Next Actions

### Priority 1: Dev Auth (BLOCKING)

| # | Action | File(s) | Effort |
|---|--------|---------|--------|
| 1 | Set correct `NEXT_PUBLIC_SITE_URL` on dev.website | Hosting env vars | 5 min |
| 2 | Add dev redirect URLs to Supabase dashboard | Supabase UI | 10 min |
| 3 | Add dev callback URLs to Meta Developer Console | Meta UI | 10 min |
| 4 | Add dev callback URLs to TikTok Developer Portal | TikTok UI | 10 min |
| 5 | Test email sign-in on dev.website | Manual test | 5 min |
| 6 | Test Facebook login on dev.website | Manual test | 5 min |
| 7 | Test TikTok login on dev.website | Manual test | 5 min |

### Priority 2: Security/Correctness

| # | Action | File(s) | Effort |
|---|--------|---------|--------|
| 8 | Verify prod Supabase redirect URLs match all callbacks | Supabase UI | 10 min |
| 9 | Audit prod env vars match .env.example | Hosting config | 15 min |
| 10 | Verify foundation_ledger idempotency works | Test duplicate webhook | 15 min |

### Priority 3: Build Stability

| # | Action | File(s) | Effort |
|---|--------|---------|--------|
| 11 | Add GitHub Actions CI workflow | `.github/workflows/ci.yml` | 30 min |
| 12 | Add lint + typecheck to CI | CI config | 10 min |
| 13 | Add build verification to CI | CI config | 10 min |

### Priority 4: Performance/Cost

| # | Action | File(s) | Effort |
|---|--------|---------|--------|
| 14 | Monitor AI costs in first week | Dashboard | Ongoing |
| 15 | Verify Redis/Valkey connected on Render | Logs | 10 min |
| 16 | Profile `/api/birth-chart` response time | Observability | 30 min |

### Priority 5: Refactors/Maintainability

| # | Action | File(s) | Effort |
|---|--------|---------|--------|
| 17 | Remove Reddit stub button | sign-in/page.tsx | 5 min |
| 18 | Extract `getServerBaseUrl()` usage | 20+ files | 1 hour |
| 19 | Add structured logging library | lib/logging/ | 2 hours |
| 20 | Split birth-chart/route.ts | app/api/birth-chart/ | 3 hours |
| 21 | Complete TikTok portal approval TODO | lib/oauth/providers/tiktok.ts | External |
| 22 | Complete numerology AI interpretation TODO | sanctuary/numerology/page.tsx | 2 hours |
| 23 | Add error boundaries to protected pages | components/ | 1 hour |
| 24 | Document "stone tablet" English-only decision | README/docs | 30 min |
| 25 | Add SEO metadata verification | public pages | 1 hour |

---

## Appendix: Route Inventory

### API Routes (48 total)

| Group | Routes | Auth |
|-------|--------|------|
| AI Content | `/api/insights`, `/api/birth-chart`, `/api/connection-*`, `/api/public-*` | Mixed |
| Auth | `/api/auth/*`, `/auth/callback` | Public |
| Social | `/api/social/*` | Authenticated |
| Stripe | `/api/stripe/*` | Mixed |
| Account | `/api/account/*` | Authenticated |
| Cron | `/api/cron/*` | CRON_SECRET |
| Other | `/api/health`, `/api/locale`, `/api/location/*` | Public |

### Pages (22 total)

| Group | Pages | Auth |
|-------|-------|------|
| Public | `/`, `/about`, `/privacy`, `/terms`, `/learn/*`, etc. | None |
| Auth | `/sign-in`, `/sign-up`, `/join`, `/welcome`, `/onboarding`, etc. | Pre-login |
| Protected | `/sanctuary/*`, `/settings` | Required |

---

## Appendix: OpenAI Integration Matrix

| Route | Model | Tracked | Budget Check |
|-------|-------|---------|--------------|
| `/api/insights` | gpt-4.1-mini / gpt-5.1 | ✅ | ✅ |
| `/api/birth-chart` | gpt-5.1 | ✅ | ✅ |
| `/api/connection-brief` | gpt-4.1-mini | ✅ | ✅ |
| `/api/connection-insight` | gpt-4.1-mini | ✅ | ✅ |
| `/api/connection-space-between` | gpt-4o | ✅ | ✅ |
| `/api/public-horoscope` | gpt-4.1-mini | ✅ | ✅ |
| `/api/public-tarot` | gpt-4.1-mini | ✅ | ✅ |
| `/api/public-compatibility` | gpt-4.1-mini | ✅ | ✅ |
| `/api/cron/prewarm-insights` | various | ✅ | ✅ |
| `lib/social/summarize.ts` | gpt-4o-mini | ✅ | ✅ |

**All 10 OpenAI call sites properly tracked and budgeted.**

---

**End of Audit Report**
