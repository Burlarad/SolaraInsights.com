# Solara Insights — Paywall Architecture & Implementation Plan

**Date:** 2026-02-28
**Auditor:** Claude (Principal Engineer + Product Systems Auditor)
**Stack:** Next.js 15 App Router · Supabase RLS · Stripe · Redis · Render

---

## 1. WHAT'S TRUE TODAY (Evidence from Code)

### 1a. Paywall Enforcement — Single Choke Point

**File:** `app/(protected)/layout.tsx:76-87`

The entire paywall is ONE server-side layout check:

```typescript
const isPaid =
  devBypass ||                                      // dev env only
  typedProfile.role === "admin" ||                  // admin bypass
  typedProfile.is_comped === true ||                // manual comp
  (typedProfile.membership_plan !== "none" &&
    (typedProfile.subscription_status === "trialing" ||
     typedProfile.subscription_status === "active"));

if (!isPaid) redirect("/join");   // ← sole paywall: pays or gets nothing
```

**Consequence:** Free users (plan = "none") are 100% blocked from all protected routes including `/sanctuary` (daily insight). The business rule of "Free gets 1 daily insight + Connections + Tarot taste" does not exist in the code.

### 1b. API Routes — Zero Membership Checks (Critical)

Verified by grepping for `membership_plan`, `subscription_status`, `hasActiveMembership` in `app/api/`:

| Route | Auth Check | Membership Check | Result |
|-------|-----------|-----------------|--------|
| `POST /api/insights` | ✅ getUser() | ❌ None | Any authenticated user gets full insight |
| `POST /api/connection-brief` | ✅ getUser() | ❌ None | Unlimited daily briefs |
| `POST /api/connection-space-between` | ✅ getUser() | ❌ None | Deep report for free users |
| `POST /api/birth-chart-library` | ✅ getUser() | ❌ None | Library generation unlocked |
| `POST /api/numerology-library` | ✅ getUser() | ❌ None | Library generation unlocked |
| `GET /api/connections` | ✅ getUser() | ❌ None | Unlimited connections |
| `POST /api/connections` | ✅ getUser() | ❌ None | No limit enforcement |
| `GET /api/numerology` | ✅ getUser() | ❌ None | Free numerology |

**Any authenticated user who bypasses the UI (e.g., `curl -H "Authorization: Bearer token" POST /api/connection-space-between`) gets full Premium content for free.** This is the P0 security issue.

### 1c. Current Membership Model

```typescript
// types/index.ts — Profile interface
membership_plan: "none" | "individual" | "family"
subscription_status: "active" | "canceled" | "past_due" | "trialing" | null
is_comped: boolean     // manual override
role: "user" | "admin"
```

- **No seat plans** (3-seat/5-seat) in DB schema. `family_members` table is archived.
- **No tarot trial tracking** anywhere.
- **No connection count limit** anywhere.
- **No "official_outputs_retention"** logic (post-cancel read-only access).
- **No free tier daily insight counting.**

### 1d. Existing Cost Infrastructure (Good)

| System | File | What It Does |
|--------|------|-------------|
| Global budget circuit breaker | `lib/ai/costControl.ts` | $100/day Redis cap, fail-closed |
| Per-user rate limiting | `lib/cache/rateLimit.ts` | Redis + memory fallback, sliding window |
| Tarot rate limits | `lib/cache/tarotRateLimit.ts` | Tiered anon/auth, no plan awareness |
| Insight cache | Redis via `buildInsightCacheKey` | 48h TTL (today), 400d (year) |
| Brief cache | DB: `daily_briefs` table | Per (connectionId, localDate, language, promptVersion) |
| Space Between cache | DB: quarterly key | Per (connectionId, quarter, language, promptVersion) |
| Library cache | DB: permanent | Charts/numerology never expire, keyed by deterministic hash |
| Usage tracking | `ai_usage_events` table | Tokens, cost_micros, model, route, user_id |

### 1e. Stripe Integration (Working)

- Checkout: `POST /api/stripe/checkout` — subscription mode, no trial, passes plan+userId in metadata
- Webhook: `checkout.session.completed` → updates profile; `subscription.updated/deleted` → syncs status; `invoice.payment_succeeded` → foundation ledger
- Missing: `invoice.payment_failed` handler, Customer Portal
- Plan names in code: `"individual"` | `"family"` (family is a Stripe price, not yet a seat system)

### 1f. Current Sign-up Flow

Two paths:
1. **Stripe-first** (current): `/join` → Stripe Checkout → `/welcome?status=success&session_id=...` → `/api/auth/complete-signup` → onboarding → `/sanctuary`
2. **OAuth** (TikTok/Facebook): OAuth → callback creates profile → if session_id in state → `claimCheckoutSession` → onboarding

**Registration WITHOUT payment does not exist.** `app/(auth)/join/page.tsx` shows only the Stripe Pricing Table — there is no "create free account" path.

---

## 2. WHAT WE WANT TO BE TRUE (Target Architecture)

### 2a. Plan Tier Definitions

| Plan | DB Value | Stripe | Seats | Access |
|------|----------|--------|-------|--------|
| Free | `none` | No Stripe customer | 1 | Insights (1/day), Connections (5 max, briefs only), Tarot (1 lifetime) |
| Premium Individual | `individual` | Subscription | 1 | Everything |
| Seat Plan 3 | `seat_3` | Subscription | 3 total incl. owner | Everything |
| Seat Plan 5 | `seat_5` | Subscription | 5 total incl. owner | Everything |

### 2b. Feature Entitlement Matrix

| Feature | Free | Premium | Seat Member | Server-enforced? |
|---------|------|---------|-------------|-----------------|
| Daily Insight (today) | 1/day (UTC) | Unlimited | Unlimited | API |
| Year Insight | ❌ Locked | ✅ | ✅ | API |
| Connections CRUD | Up to 5 saved | Unlimited | Unlimited | API |
| Connection Daily Brief | 1/day per person (max 5 people) | Unlimited | Unlimited | API |
| Connection Space Between | ❌ Locked | ✅ | ✅ | API |
| Tarot | 1 lifetime draw | Unlimited (100/day) | Unlimited (100/day) | API |
| Library — view shell/tabs | ✅ View only (no generate) | ✅ Generate | ✅ Generate | UI + API |
| Library — generate official Astrology | ❌ | ✅ | ✅ | API |
| Library — generate official Numerology | ❌ | ✅ | ✅ | API |
| Library — checkout other charts | ❌ | ✅ | ✅ | API |
| Library — read OWN official output (post-cancel) | ✅ Read-only | ✅ | ✅ | API |
| Birth Chart (raw) | ❌ | ✅ | ✅ | API |
| Numerology Profile (raw) | ❌ | ✅ | ✅ | API |
| Social Insights | ❌ | ✅ | ✅ | API |
| Settings | ✅ | ✅ | ✅ | Always |

### 2c. Post-Cancellation Retention Rules

```
Cancel event fires (subscription.deleted or status=canceled):
  → Set: subscription_status = "canceled"
  → Retain: profiles.official_astrology_key (do NOT clear)
  → Retain: profiles.official_numerology_key (do NOT clear)
  → Access model changes to: "canceled_with_retention"
  → canAccessFeature("library_official_read") returns true IFF
      profile has official_astrology_key OR official_numerology_key AND
      mode = "load" with book_key matching their official key
  → canAccessFeature("library_generate") returns false
  → canAccessFeature("library_checkout") returns false
  → canAccessFeature("recent_books") returns false
```

---

## A. SYSTEM INVENTORY

### Registration & Profile Creation

| File | Role |
|------|------|
| `app/(auth)/join/page.tsx` | Pricing page (Stripe table only — no free signup) |
| `app/(auth)/sign-in/page.tsx` | Sign-in (email/OAuth) |
| `app/api/auth/complete-signup/route.ts` | Creates Supabase user post-Stripe checkout |
| `app/api/auth/login/tiktok/callback/route.ts` | TikTok OAuth callback, creates profile |
| `app/api/auth/login/x/callback/route.ts` | X OAuth callback, creates profile |
| `app/api/stripe/checkout/route.ts` | Creates Stripe session, redirects to Stripe |
| `lib/stripe/claimCheckoutSession.ts` | Links Stripe payment to user after OAuth |
| Supabase trigger (inferred) | Creates `profiles` row on `auth.users` insert |

**Gap:** No `/sign-up` or "create free account" flow exists.

### Onboarding Gates

| File | Role |
|------|------|
| `app/(protected)/layout.tsx` | Server: auth + payment + onboarding gate |
| `app/(auth)/join/page.tsx` | Redirects away if already paid |
| `app/(auth)/welcome/page.tsx` | Post-payment welcome (inferred) |
| `app/(protected)/onboarding/page.tsx` | Collects birth data (inferred) |

### Protected Layout Routing

| File | Role |
|------|------|
| `app/(protected)/layout.tsx` | Single server-side gate for all protected routes |
| `app/(protected)/sanctuary/page.tsx` | Daily insight home |
| `app/(protected)/sanctuary/connections/page.tsx` | Connections |
| `app/(protected)/sanctuary/tarot/page.tsx` | Tarot |
| `app/(protected)/sanctuary/birth-chart/page.tsx` | Birth chart |
| `app/(protected)/sanctuary/numerology/page.tsx` | Numerology |
| `app/(protected)/sanctuary/library/page.tsx` | Library |
| `app/(protected)/settings/page.tsx` | Settings |

### Stripe Integration

| File | Role |
|------|------|
| `lib/stripe/client.ts` | Stripe SDK singleton + STRIPE_CONFIG |
| `app/api/stripe/checkout/route.ts` | POST — creates checkout session |
| `app/api/stripe/webhook/route.ts` | POST — handles webhook events |
| `app/api/stripe/claim-session/route.ts` | POST — client-side session claim |
| `app/api/stripe/session-info/route.ts` | GET — retrieves session email |
| `lib/stripe/claimCheckoutSession.ts` | Links session to user |

### Rate Limiting & Caching

| File | Role |
|------|------|
| `lib/ai/costControl.ts` | Global daily OpenAI budget ($100/day) |
| `lib/cache/rateLimit.ts` | Redis sliding window rate limiter |
| `lib/cache/tarotRateLimit.ts` | Tiered tarot rate limits (anon vs auth) |
| Redis (env: REDIS_URL) | Insight cache, rate limit state, budget counter |
| `daily_briefs` table | Immutable per-day brief cache |
| `space_between_reports` table | Quarterly Space Between cache |
| `birth_chart_library` / `numerology_library` tables | Permanent chart/narrative cache |

### Library & Connections Endpoints

| Route | Role |
|-------|------|
| `GET/POST /api/birth-chart-library` | Shelf, official, checkout, load |
| `GET/POST /api/numerology-library` | Same pattern for numerology |
| `GET/POST/PATCH/DELETE /api/connections` | CRUD for connections |
| `POST /api/connection-brief` | Daily brief (Layer A — cheap) |
| `POST /api/connection-space-between` | Deep report (Layer B — expensive) |
| `GET /api/library-checkouts` | Recent books list |

---

## B. TARGET UX FLOW (FREE-FIRST)

### Flow 1: New User → Sign Up → Onboard → Free Home

```
1. User visits solarainsights.com
2. Clicks "Get Started Free"
3. → /sign-up (new page needed: email/password or OAuth, no Stripe)
4. Account created: membership_plan = "none", is_onboarded = false
5. → /welcome (collect birth info: name, DOB, birth time, birth place)
6. → /onboarding (preferences, language, etc.)
7. is_onboarded = true
8. → /sanctuary (Free zone)
   - TODAY insight (1/day shown, generates on first visit, cached)
   - Connections tab (add up to 5 people, daily briefs)
   - Tarot tab (1 lifetime taste, then locked)
   - Other tabs show lock screens
```

**Pages to create:**
- `/sign-up` — free account creation (email or OAuth)

**Pages to modify:**
- `app/(protected)/layout.tsx` — allow `membership_plan = "none"` through to Free zone
- `/join` — becomes upgrade page (keep Stripe Pricing Table but add "Already have an account? Sign in")

### Flow 2: Free User → Locked Feature → Upgrade → Return

```
1. Free user on /sanctuary, clicks "Connections" tab
   → Sees full Connections UI (allowed for free)
   → Views Space Between button for a mutual connection
   → Clicks "Unlock Space Between" → Lock overlay appears
     Title: "Space Between is a Premium feature"
     Body: "See the deep blueprint of any relationship."
     CTA: "Upgrade to Premium" → /join?return=/sanctuary/connections

2. /join page shows pricing, user selects Individual Premium
3. → Stripe Checkout (no trial)
4. → Checkout completes → webhook fires → membership updated
5. → /welcome?status=success&return=/sanctuary/connections
6. → User redirected to /sanctuary/connections with full access
```

**Implementation note:** Store `return` param through Stripe checkout via `success_url`. On `/welcome` success page, read `return` from URL and redirect there.

### Flow 3: Premium (No Trial)

```
1. User on /join, clicks Individual Premium
2. → Stripe Checkout (subscription mode, no trial_period_days)
3. → checkout.session.completed webhook → profile updated:
     membership_plan = "individual"
     subscription_status = "active"
4. → /welcome?status=success
5. → Full access immediately
```

**Note:** Remove `trial_period_days: 7` from `app/api/stripe/checkout/route.ts:66`.

### Flow 4: Seat Member — Invite → Accept → Access

```
1. Owner on /settings/team, invites friend@example.com
2. System creates seat_members row: status = "invited", token = uuid, expires = 7d
3. Email sent: "You've been invited to join [Owner]'s Solara workspace"
   Link: /accept-seat?token={uuid}
4. Recipient clicks link:
   a. Not registered → /sign-up?return=/accept-seat?token={uuid}
   b. Registered → sign in → /accept-seat?token={uuid}
5. Server validates token (not expired, not used, correct plan capacity)
6. seat_members row: status = "active", accepted_user_id = their ID
7. canAccessFeature() now returns true for seat member (via seat_members lookup)
8. Email: "You now have Premium access to Solara"
```

### Flow 5: Owner Cancels → Seat Members Notified → Takeover

```
1. Owner cancels in Stripe Customer Portal (end of period)
2. Stripe sends customer.subscription.deleted at period end
3. Webhook:
   a. Sets owner: subscription_status = "canceled"
   b. Finds all active seat members
   c. Sends each member an email:
      "Your Solara access via [Owner] ends [date].
       Upgrade to keep your Premium access →"
      CTA: /join?source=seat_takeover&return_seat_data=true
4. Member clicks → Stripe Checkout for Individual plan
5. On success: seat_members row stays (history) but member now has own subscription
6. Member retains own official outputs regardless
```

### Flow 6: Canceled User Experience

```
State: subscription_status = "canceled"

/sanctuary:
  → Daily Insight: LOCKED (no generation, no free tier preserved — they had premium)
  → Actually: revert to Free behavior (1/day) if this is your intended post-cancel state
  ← OR → Full lock with upgrade CTA
  [Recommendation: FULL LOCK post-cancel — show "Resubscribe" CTA — simpler logic]

/sanctuary/library:
  → Astrology tab: IF profiles.official_astrology_key is set → show Read-Only banner + their chart
  → Numerology tab: IF profiles.official_numerology_key is set → show Read-Only banner + their profile
  → No "View Astrological Profile" button (no generation)
  → No Recent Books tab (or show empty with "Resubscribe to access")
  → "Checkout" forms: hidden

API enforcement:
  canAccessFeature("library_load") with book_key:
    if book_key == profile.official_astrology_key OR profile.official_numerology_key → ALLOW
    else → DENY
```

---

## C. PAYWALL ARCHITECTURE (Authoritative Enforcement)

### The Canonical `canAccessFeature()` Function

```typescript
// lib/entitlements/canAccessFeature.ts
// This is the SINGLE source of truth for all access decisions.

export type FeatureId =
  | "daily_insight_today"        // Free: 1/day
  | "daily_insight_year"         // Premium only
  | "connections_read"           // Free (up to 5 people)
  | "connections_write"          // Free (up to 5 limit)
  | "connection_brief"           // Free (limited), Premium (unlimited)
  | "connection_space_between"   // Premium only
  | "tarot"                      // Free: 1 lifetime, Premium: unlimited
  | "library_view"               // Free (view shell, no generation)
  | "library_generate_official"  // Premium only
  | "library_checkout"           // Premium only
  | "library_load"               // Premium + post-cancel own official
  | "library_recent"             // Premium only (no post-cancel)
  | "numerology_raw"             // Premium only
  | "birth_chart_raw"            // Premium only
  | "social_insights"            // Premium only

export type AccessResult = {
  allowed: boolean;
  code: "OK" | "AUTH_REQUIRED" | "PLAN_REQUIRED" | "DAILY_LIMIT" | "LIFETIME_LIMIT"
        | "CONNECTIONS_LIMIT" | "SUBSCRIPTION_CANCELED" | "SEAT_EXPIRED";
  reason?: string;
  upgradeUrl?: string;
  meta?: Record<string, unknown>;
};

export async function canAccessFeature(
  userId: string,
  feature: FeatureId,
  context?: { book_key?: string; connection_id?: string }
): Promise<AccessResult>
```

### Access Decision Logic (by feature)

```
canAccessFeature(userId, feature):

1. Fetch profile (admin client, single query):
   SELECT membership_plan, subscription_status, role, is_comped,
          official_astrology_key, official_numerology_key
   FROM profiles WHERE id = userId

2. Determine effective_plan:
   - role=admin OR is_comped → effective_plan = "premium"
   - DEV_PAYWALL_BYPASS=true AND NODE_ENV≠production → effective_plan = "premium"
   - membership_plan ∈ {individual, seat_3, seat_5}
     AND subscription_status ∈ {active} → effective_plan = "premium"
   - is seat member (check seat_members table) → effective_plan = "premium" (if owner active)
   - membership_plan = "none" OR status ∈ {canceled, past_due} → effective_plan = "free"
   - Note: "past_due" gets grace period — still "premium" for 7 days, then demoted
   - Note: "canceled" → effective_plan = "canceled"

3. Feature-specific logic:

   "daily_insight_today":
     free: check daily_insight_usage(user_id, today_utc).count < 1 → OK else DAILY_LIMIT
     premium: OK (no limit)
     canceled: PLAN_REQUIRED (upgrade CTA)

   "daily_insight_year":
     free | canceled: PLAN_REQUIRED
     premium: OK

   "connections_read": always OK (free can read up to 5)

   "connections_write":
     free: count existing connections < 5 → OK else CONNECTIONS_LIMIT
     premium: OK
     canceled: CONNECTIONS_LIMIT (can't add, can still read existing)

   "connection_brief":
     free: check daily_brief_count(user_id, today_utc) < 5 → OK (1/person/day, max 5 people)
     premium: OK
     canceled: PLAN_REQUIRED

   "connection_space_between":
     free | canceled: PLAN_REQUIRED
     premium: OK (then route checks is_space_between_unlocked on connection)

   "tarot":
     free: check tarot_usage(user_id).lifetime_count < 1 → OK else LIFETIME_LIMIT
     premium: OK
     canceled: PLAN_REQUIRED

   "library_view": always OK (free can see tabs, just can't generate)

   "library_generate_official":
     free | canceled: PLAN_REQUIRED
     premium: OK

   "library_checkout":
     free | canceled: PLAN_REQUIRED
     premium: OK

   "library_load":
     premium: OK
     canceled: if context.book_key == profile.official_astrology_key OR
                  context.book_key == profile.official_numerology_key → OK
               else → PLAN_REQUIRED
     free: PLAN_REQUIRED

   "library_recent":
     premium: OK
     free | canceled: PLAN_REQUIRED

   "numerology_raw" | "birth_chart_raw" | "social_insights" | "daily_insight_year":
     premium: OK
     else: PLAN_REQUIRED
```

### Protected Layout (Modified)

```typescript
// app/(protected)/layout.tsx
// NEW: Free users pass through to Free zone

const isFreeAllowed = true;  // All authenticated + onboarded users get in
// (paywall moved to feature level)

// Keep: auth check, profile check, hibernation check, onboarding check
// Remove: the isPaid → redirect("/join") block

// Add: pass plan context to children via server context or header
```

### What Is UI-Only vs Server-Enforced

| Check | Server (API) | UI Only | Notes |
|-------|-------------|---------|-------|
| Free 1/day insight | ✅ API returns 403 | Lock screen | Both layers |
| Free 5 connections limit | ✅ POST returns 403 | Hide "Add" button | Both |
| Free brief limit | ✅ API returns 403 | No button if limit hit | Both |
| Space Between premium | ✅ API returns 403 | Lock overlay | Both |
| Tarot 1 lifetime | ✅ API returns 403 | Lock after first use | Both |
| Library generate | ✅ API returns 403 | Hide checkout button | Both |
| Library view shell | ❌ Server not needed | Show tabs, hide actions | UI only |
| Year insight | ✅ API returns 403 | Lock screen | Both |

**Rule:** If it calls the AI or reads cached AI output another person paid for, it must be server-enforced.

---

## D. IMPLEMENTATION PLAN (PHASED)

---

### PHASE 1: Stop API Leakage (P0 — Ship First)

**Goal:** Close the security gap. No free/unauthed user can get premium content from any API route.

**Files to edit:**
1. `lib/entitlements/canAccessFeature.ts` — CREATE (the canonical function above)
2. `app/api/connection-space-between/route.ts` — ADD `canAccessFeature(userId, "connection_space_between")`
3. `app/api/birth-chart-library/route.ts` — ADD checks for `library_generate_official`, `library_checkout`, `library_load`
4. `app/api/numerology-library/route.ts` — same as above
5. `app/api/insights/route.ts` — ADD check for `daily_insight_today` | `daily_insight_year`
6. `app/api/connection-brief/route.ts` — ADD check for `connection_brief`
7. `app/api/connections/route.ts` — ADD check for `connections_write` (POST/PATCH/DELETE)
8. `app/api/numerology/route.ts` — ADD check for `numerology_raw`

**New tables (migration):**
```sql
-- daily_insight_usage: tracks free tier daily insight count
CREATE TABLE daily_insight_usage (
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  count     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

-- tarot_usage: tracks lifetime tarot draws per user
CREATE TABLE tarot_usage (
  user_id        uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  lifetime_count integer NOT NULL DEFAULT 0,
  first_used_at  timestamptz,
  last_used_at   timestamptz
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  official_astrology_key text,
  official_numerology_key text;
-- (These may already exist — verify against prod_schema.sql)
```

**Error response format (standard for all gated routes):**
```json
{
  "error": "Feature requires Premium",
  "code": "PLAN_REQUIRED",
  "upgradeUrl": "/join"
}
```
HTTP 403 for feature locks, 429 for rate limits.

**Tests to add:**
- `canAccessFeature("connection_space_between")` returns PLAN_REQUIRED for free/canceled user
- `canAccessFeature("daily_insight_today")` returns DAILY_LIMIT after 1 use for free user
- `canAccessFeature("tarot")` returns LIFETIME_LIMIT after 1 use for free user
- All premium routes return 403 when called with free-tier user token

**Smoke tests:**
```bash
# With free user JWT:
curl -X POST /api/connection-space-between -H "Authorization: Bearer {free_token}" → 403
curl -X POST /api/birth-chart-library -d '{"mode":"checkout",...}' → 403
curl -X POST /api/insights -d '{"timeframe":"year"}' → 403
```

**What could break:** Nothing — this only adds checks. Existing paid users still get through.

---

### PHASE 2: Free-First Layout (Allow Free Users In)

**Goal:** Let unsubscribed but registered+onboarded users access `/sanctuary` and their Free zone.

**Files to edit:**
1. `app/(protected)/layout.tsx` — Remove the `if (!isPaid) redirect("/join")` block. Keep auth + hibernation + onboarding gates only.
2. `app/(auth)/sign-up/page.tsx` — CREATE: Free account registration page (email/password + OAuth options). On success: create Supabase user, create profile with `membership_plan = "none"`, redirect to `/welcome`.
3. `app/(auth)/join/page.tsx` — Rename semantics to "Upgrade" page. Add "Already have a free account? Sign in" link.
4. `app/api/auth/complete-signup/route.ts` — This is the Stripe-first flow. Keep as-is for upgrade path. Create a separate `app/api/auth/register/route.ts` for free signup.
5. `middleware.ts` — Optionally redirect `/sign-up` to new page.

**New route:**
```
POST /api/auth/register
Body: { email, password, name? }
- Creates Supabase user (email not confirmed until they verify)
- Creates profiles row with membership_plan = "none", is_onboarded = false
- Sends verification email
- Returns { userId, requiresVerification: true }
```

**Tests to add:**
- Free user can access `/sanctuary` (200, no redirect to /join)
- Free user sees daily insight on first load
- Free user gets 403 on 2nd daily insight request same day
- Free user gets redirected to /join when clicking Space Between
- Canceled user can access library read-only for own official charts

**What could break:**
- Existing onboarding redirects still work (is_onboarded gate stays in place)
- Make sure `/join` page still redirects paid users to `/sanctuary`

---

### PHASE 3: Lock Screens + Upgrade CTAs

**Goal:** Free users see tasteful previews and clear upgrade paths.

**Files to create/edit:**
1. `components/paywall/FeatureLock.tsx` — Reusable lock overlay component
2. `components/paywall/UpgradeBanner.tsx` — Inline upgrade CTA
3. `app/(protected)/sanctuary/page.tsx` — Add lock for "Year" insight tab (show blurred preview + upgrade CTA)
4. `app/(protected)/sanctuary/connections/page.tsx` — Add:
   - "Connections limit reached" banner when at 5
   - Lock overlay on "Space Between" button
   - Brief limit counter (x/5 used today)
5. `app/(protected)/sanctuary/tarot/page.tsx` — After 1 draw, show lock state
6. `app/(protected)/sanctuary/library/page.tsx` — Hide "View Astrological Profile" / "View Numerology Profile" buttons for free users. Show read-only banner for canceled users with official outputs.
7. `app/(auth)/join/page.tsx` — Accept `?return=` param, thread through Stripe checkout, redirect back after payment.

**`FeatureLock` component interface:**
```tsx
<FeatureLock
  title="Space Between is Premium"
  body="See the deep blueprint of any relationship."
  upgradeUrl="/join?return=/sanctuary/connections&feature=space_between"
  blurContent={false}
/>
```

**Return-to flow:**
```typescript
// In checkout route:
const returnUrl = searchParams.get("return") || "/sanctuary";
const session = await stripe.checkout.sessions.create({
  ...
  success_url: `${appUrl}/welcome?status=success&return=${encodeURIComponent(returnUrl)}`,
});

// In welcome page after success:
const returnPath = searchParams.get("return") || "/sanctuary";
router.push(returnPath);
```

**Tests:**
- Free user sees lock overlay on Space Between, not an error page
- Lock overlay "Upgrade" button uses correct return URL
- After upgrade, user lands back at the intended feature
- Canceled user sees read-only banner in Library (not lock overlay)

---

### PHASE 4: Stripe Customer Portal + Missing Webhooks

**Files to create/edit:**
1. `app/api/stripe/portal/route.ts` — CREATE:
```typescript
POST /api/stripe/portal
- Auth required + must have stripe_customer_id
- stripe.billingPortal.sessions.create({ customer: profile.stripe_customer_id, return_url: appUrl + "/settings" })
- Returns { url }
```

2. `app/(protected)/settings/page.tsx` — Add "Manage Subscription" button that POSTs to `/api/stripe/portal` and redirects to returned URL.

3. `app/api/stripe/webhook/route.ts` — ADD handlers:
```typescript
case "invoice.payment_failed":
  // Update subscription_status = "past_due"
  // Send "Payment failed — update your card" email
  // Log to ai_usage_events-style table for visibility
  break;

case "charge.dispute.created":
  // Set profiles.has_dispute = true (new column)
  // Block access until manual review
  // Alert via Resend/internal email
  break;
```

**New DB column:**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_dispute boolean NOT NULL DEFAULT false;
```

**Grace period for past_due:**
- `canAccessFeature()` grants "premium" access for `past_due` status for 7 days after `subscription_end_date`
- After 7 days, demote to "free" (not canceled — they still have the sub, just not paid)
- This prevents good-faith users from losing access during card failure retry window (Stripe retries 4× over ~14 days by default)

**Cancellation behavior:**
- Recommend: **end of period cancellation** (not immediate)
- User cancels in portal → Stripe schedules end → `subscription.updated` fires with `cancel_at_period_end=true` → Store `subscription_end_date`
- At period end: `subscription.deleted` → mark canceled → trigger seat member notifications

**Tests:**
- `POST /api/stripe/portal` with stripe_customer_id → returns valid portal URL
- `invoice.payment_failed` webhook → profile.subscription_status = "past_due"
- 7-day grace period: past_due user with 6-day-old status still gets premium
- 8-day-old past_due user gets free tier access

---

### PHASE 5: Seat System Build-Out

*(Full spec in Section E below)*

**Files to create:**
- `supabase/migrations/{date}_seat_system.sql`
- `app/api/seat/invite/route.ts`
- `app/api/seat/accept/route.ts`
- `app/api/seat/revoke/route.ts`
- `app/api/seat/members/route.ts`
- `app/(auth)/accept-seat/page.tsx`
- `app/(protected)/settings/team/page.tsx`

**Files to edit:**
- `lib/entitlements/canAccessFeature.ts` — add seat_members lookup
- `app/api/stripe/checkout/route.ts` — add `seat_3` and `seat_5` plan support
- `app/api/stripe/webhook/route.ts` — set `seat_plan` on owner profile

---

### PHASE 6: Family Cancellation Notifications + Seat Takeover

**Files to create/edit:**
1. `app/api/stripe/webhook/route.ts` — In `handleSubscriptionDeleted`: find all active seat members → send "Your access is ending" email with Stripe Checkout link for Individual plan
2. `lib/email/templates/seat-ending.ts` — Email template
3. `app/api/stripe/checkout/route.ts` — Add `?source=seat_takeover` param support (no behavior change, just tracking in metadata)

**Seat member data retention:**
```typescript
// When seat member's access ends:
// - Their official_astrology_key and official_numerology_key REMAIN set
// - They get post-cancel read-only access to those outputs
// - Same logic as individual cancellation
```

---

### PHASE 7: Testing + Observability Hardening

**Files to create:**
- `__tests__/entitlements/canAccessFeature.test.ts` — Unit tests for all feature gates
- `__tests__/payments/stripe-webhook.test.ts` — Fill in all `test.todo()` stubs
- `__tests__/seats/seat-system.test.ts` — Seat flow tests

**Observability additions:**
```typescript
// Add to canAccessFeature():
console.log(JSON.stringify({
  event: "feature_access_check",
  userId,
  feature,
  result: result.code,
  plan: profile.membership_plan,
  status: profile.subscription_status,
  ts: Date.now()
}));
```

**Metrics to track (structured logs → Render log drain):**
- `feature_access_denied` — by feature + reason
- `upgrade_cta_shown` — by feature (which lock screen converts)
- `daily_insight_generated` vs `daily_insight_cached` — cache hit rate
- `connection_brief_generated` vs `cached`
- `space_between_generated` (expensive — track carefully)
- `library_generate_triggered` (expensive)

---

## E. SEAT SYSTEM SPEC (3-Seat and 5-Seat)

### Schema

```sql
-- Migration: {date}_seat_system.sql

-- Add seat plan values to profiles
-- profiles.membership_plan: "none" | "individual" | "seat_3" | "seat_5"
-- The "family" value is kept for backward compat but deprecated in favor of seat_3/seat_5

-- Seat capacity lookup (owner_plan → max_seats including owner)
-- seat_3 → 3 total seats (owner + 2 members)
-- seat_5 → 5 total seats (owner + 4 members)

CREATE TABLE seat_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The subscription owner (their plan defines seat capacity)
  owner_user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Invite state
  invite_email     text NOT NULL,
  invite_token     text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status           text NOT NULL DEFAULT 'invited',
  -- status: 'invited' | 'active' | 'revoked' | 'expired'

  -- Acceptance
  accepted_user_id uuid REFERENCES profiles(id),
  accepted_at      timestamptz,

  -- Revocation
  revoked_at       timestamptz,
  revoked_by       uuid REFERENCES profiles(id), -- owner or accepted_user (self-leave)

  -- Expiry (invites auto-expire if not accepted)
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '7 days'),

  -- Metadata
  meta             jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- Enforce unique active/invited per email per owner
  CONSTRAINT unique_active_invite UNIQUE (owner_user_id, invite_email, status)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_seat_members_owner ON seat_members(owner_user_id);
CREATE INDEX idx_seat_members_accepted ON seat_members(accepted_user_id) WHERE accepted_user_id IS NOT NULL;
CREATE INDEX idx_seat_members_token ON seat_members(invite_token);
CREATE INDEX idx_seat_members_status ON seat_members(status) WHERE status IN ('invited', 'active');

-- RLS
ALTER TABLE seat_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seat_members_owner_read" ON seat_members
  FOR SELECT USING (auth.uid() = owner_user_id OR auth.uid() = accepted_user_id);

CREATE POLICY "seat_members_service_all" ON seat_members
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
```

### Seat Capacity Function

```typescript
// lib/entitlements/seatCapacity.ts

const SEAT_CAPACITY: Record<string, number> = {
  seat_3: 3,  // owner + 2 members
  seat_5: 5,  // owner + 4 members
};

export function getMaxSeats(plan: string): number {
  return SEAT_CAPACITY[plan] ?? 0;
}

export async function getSeatCount(ownerUserId: string): Promise<number> {
  // Count owner (1) + active/invited seats
  const { count } = await supabase
    .from("seat_members")
    .select("id", { count: "exact" })
    .eq("owner_user_id", ownerUserId)
    .in("status", ["invited", "active"]);
  return 1 + (count ?? 0); // +1 for owner
}
```

### Invite API

```typescript
// POST /api/seat/invite
// Auth: owner with seat_3 or seat_5 plan + active subscription
// Body: { email: string }

1. Validate: caller has seat plan + active subscription
2. Validate: email not already invited/active by this owner
3. Check capacity: getSeatCount(owner) < getMaxSeats(owner.plan)
4. Create seat_members row (status = "invited", expires_at = now() + 7d)
5. Send invite email via Resend
6. Return: { invite_id, invite_email, expires_at }
```

### Accept API

```typescript
// POST /api/seat/accept
// Auth: any authenticated user
// Body: { token: string }

1. Validate token (seat_members where invite_token = token AND status = "invited")
2. Check not expired (expires_at > now())
3. Check: caller not already in another active seat (seat_members where accepted_user_id = caller AND status = "active")
4. Check: owner still has active subscription
5. Update: status = "active", accepted_user_id = caller.id, accepted_at = now()
6. Send confirmation emails (to member + owner)
7. Return: { success: true, owner_name: ..., plan_type: ... }
```

### Revoke API

```typescript
// POST /api/seat/revoke
// Auth: owner OR the seat member themselves (self-leave)
// Body: { seat_member_id: string }

1. Validate: caller is owner_user_id OR accepted_user_id of the seat
2. Update: status = "revoked", revoked_at = now(), revoked_by = caller.id
3. Send notification email to the removed member
4. Return: { success: true }
```

### canAccessFeature — Seat Member Check

```typescript
// In canAccessFeature(), after checking direct subscription:
if (effective_plan === "free") {
  const { data: seat } = await supabase
    .from("seat_members")
    .select("id, owner_user_id")
    .eq("accepted_user_id", userId)
    .eq("status", "active")
    .single();

  if (seat) {
    // Verify owner's subscription is still active
    const { data: owner } = await supabase
      .from("profiles")
      .select("subscription_status, membership_plan")
      .eq("id", seat.owner_user_id)
      .single();

    const ownerActive =
      owner?.subscription_status === "active" &&
      (owner.membership_plan === "seat_3" || owner.membership_plan === "seat_5");

    if (ownerActive) effective_plan = "premium";
  }
}
```

### Edge Cases

| Case | Behavior |
|------|----------|
| Invited email not yet registered | Invite stays "invited". User registers, visits `/accept-seat?token=...`, flow works. Expires after 7 days. |
| Member already has Individual Premium | They can accept seat. Their own subscription remains. If owner cancels, they still have own sub. Win-win. |
| Member already in another seat | Reject at accept time: "You're already a member of another workspace. Leave it first." `POST /api/seat/revoke` from that seat (self-leave), then accept new invite. |
| Owner cancels | All seat members: access ends at period end. Notification emails sent. Each member offered Individual takeover. |
| Owner downgrades seat_5 → seat_3 | If current seats (active+invited) > 3, reject downgrade at Stripe level with message. Or: block downgrade in portal, require manual revocation first. |
| Seat member upgrades to Individual | They get own subscription. If they stay in seat too, they have redundant access — fine, no conflict. |
| Owner revokes member's seat | Member gets email, loses access immediately. Their official_astrology_key / official_numerology_key retained for read-only. |

---

## F. STRIPE DETAILS (No Trial)

### Products & Prices

| Product | Plan DB Value | Seats | Price |
|---------|--------------|-------|-------|
| Premium Individual | `individual` | 1 | $X/mo |
| Seat Plan 3 | `seat_3` | 3 | $Y/mo |
| Seat Plan 5 | `seat_5` | 5 | $Z/mo |

### Checkout — Remove Trial

```typescript
// app/api/stripe/checkout/route.ts — REMOVE:
subscription_data: {
  trial_period_days: 7,  // ← DELETE THIS
},
```

### Plan Resolution in Webhook

```typescript
// app/api/stripe/webhook/route.ts — resolvePlanFromSession():
// Add to STRIPE_CONFIG:
priceIds: {
  sanctuary: process.env.STRIPE_PRICE_ID || "",
  family: process.env.STRIPE_FAMILY_PRICE_ID || "",    // deprecated
  seat3: process.env.STRIPE_SEAT3_PRICE_ID || "",
  seat5: process.env.STRIPE_SEAT5_PRICE_ID || "",
}

// Plan resolution:
if (priceId === STRIPE_CONFIG.priceIds.sanctuary) return "individual";
if (priceId === STRIPE_CONFIG.priceIds.seat3)     return "seat_3";
if (priceId === STRIPE_CONFIG.priceIds.seat5)     return "seat_5";
if (priceId === STRIPE_CONFIG.priceIds.family)    return "individual"; // legacy fallback
```

### Required Webhook Events

| Event | Handler | Priority |
|-------|---------|---------|
| `checkout.session.completed` | Set plan + status + customer ID | P0 — exists |
| `customer.subscription.updated` | Sync status changes | P0 — exists |
| `customer.subscription.deleted` | Mark canceled + notify seats | P0 — exists (add seat notification) |
| `invoice.payment_succeeded` | Foundation ledger | P1 — exists |
| `invoice.payment_failed` | Set past_due + email user | P0 — MISSING |
| `charge.dispute.created` | Flag account + alert | P1 — MISSING |

### Idempotency Strategy

```typescript
// For checkout.session.completed:
// Check if already processed before updating:
const { data: existing } = await supabase
  .from("stripe_events_processed")
  .select("id")
  .eq("event_id", event.id)
  .single();
if (existing) return { received: true }; // idempotent skip

// After processing:
await supabase.from("stripe_events_processed").insert({ event_id: event.id, processed_at: now() });
```

Better: Create a `stripe_events_processed` table:
```sql
CREATE TABLE stripe_events_processed (
  event_id     text PRIMARY KEY,
  event_type   text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
```

### Source of Truth Rules

```
Stripe → authoritative for: subscription status, payment state, billing details
App DB → cache of: membership_plan, subscription_status, stripe_customer_id
          authoritative for: entitlements, feature usage, official outputs

Update rule: Stripe webhook fires → app DB updated → canAccessFeature() reads from DB
Never: trust client-side state for access decisions
Never: allow client to set membership_plan or subscription_status
Always: use admin Supabase client for webhook writes (not user-scoped RLS)
```

### Customer Portal Setup

```typescript
// Stripe Dashboard → Customer Portal → Enable:
// ✅ Cancel subscriptions (at period end, not immediately)
// ✅ Update payment methods
// ✅ View invoice history
// ❌ Upgrade/downgrade plans (manage in-app instead, to control seat logic)

// app/api/stripe/portal/route.ts:
const session = await stripe.billingPortal.sessions.create({
  customer: profile.stripe_customer_id,
  return_url: `${appUrl}/settings?portal_return=true`,
});
return NextResponse.json({ url: session.url });
```

### Referral Architecture (Future-Proof Stub)

```typescript
// Nothing to build now, but keep these rules in mind:
// 1. referrals table should be separate from subscriptions
// 2. Redemption = Stripe promotion code with max_redemptions: 1
// 3. canAccessFeature() doesn't need to change (Stripe handles the billing)
// 4. Add referrer_code column to profiles for attribution
// 5. Don't use subscription_data.trial_period_days for referrals — use coupons
```

---

## G. COST CONTROLS

### G1. Top Cost Drivers (Ranked by Risk)

| Feature | Trigger | Estimated Cost/Call | Cache? | Risk |
|---------|---------|---------------------|--------|------|
| Space Between | Premium users, quarterly | $0.10–0.30 (gpt-4.5 deep) | DB quarterly | MEDIUM — 10/day cap helps |
| Library Chart Narrative | Per new chart (official + checkout) | $0.05–0.15 | DB permanent | HIGH — checkout enables many charts |
| Library Numerology Narrative | Per new numerology book | $0.03–0.10 | DB permanent | MEDIUM |
| Year Insight | 1× per user per year | $0.05–0.15 | Redis 400d | LOW — rarely regenerated |
| Daily Insight | 1× per user per day on miss | $0.02–0.08 | Redis 48h | MEDIUM — many users, daily |
| Social Insights | Per sync event, free-form | $0.01–0.05 | DB per sync | LOW — fire-and-forget |
| Connection Brief | Per person per day on miss | $0.01–0.03 | DB per day | LOW — tiny model |
| Tarot | Per draw (public + auth) | $0.005–0.02 | None | LOW — rate limited |

**Highest risk:** Library checkout (`birth-chart-library` + `numerology-library`) allows a Premium user to generate charts for arbitrary people. Each chart = new AI call. Currently: 20/hr rate limit. Needs global cap + user lifetime cap.

### G2. Hard Cost Controls Per Feature

#### Daily Insight (Free: 1/day, Premium: 10/day soft cap)

```typescript
// Free enforcement (server):
canAccessFeature("daily_insight_today") → check daily_insight_usage table

// Premium soft cap (abuse prevention, not a hard business limit):
// Add to insights route: if premium user has > 10 calls today → 429 with "Please wait"
// This is not a hard business rule, just abuse protection

// Caching (exists, keep):
// Redis key: insight:{userId}:{timeframe}:{periodKey}:{language}:{promptVersion}
// TTL: today=48h, year=400d
// Cache hit: NEVER charges OpenAI, NEVER counts against limit

// Free insight recording:
// After successful generation (not cache hit):
await supabase.from("daily_insight_usage").upsert(
  { user_id: userId, usage_date: today_utc, count: 1 },
  { onConflict: "user_id,usage_date", count: "exact" }
);
// If this is an update (count was already 1 for today), it's a cache miss — investigate
```

#### Connection Briefs (Free: 5/day total across 5 connections, Premium: 100/day)

```typescript
// Free tier: 1 brief per connection per day (DB cached), up to 5 connections total
// The existing DB cache (daily_briefs table) already handles 1/connection/day
// Just need to enforce: free users can't have > 5 connections

// Premium safety limit: 100 connection briefs per user per day
// Add Redis counter: `brief:daily:{userId}:{date}` → increment on each miss
// At 100 → return 429 "Daily brief limit reached, resets tomorrow"

// Rationale: Each brief = ~$0.01-0.03. 100 briefs/day = $1-3/user/day max
// Even aggressive users have < 50 connections

// Caching: DB-backed (already exists). No change needed.
```

#### Space Between (Premium only, hard global limit)

```typescript
// Existing: 10/day per user rate limit, 20s cooldown, quarterly cache
// Add: Global daily budget for Space Between calls:
// Redis: `space_between:budget:{date}` → cap at $50/day
// (10 calls * 300 users = 3000 calls/day * $0.15 = $450 max — adjust limit)

// Better: 5/day per user (not 10) — quarterly cache means repeat clicks are free
// User generates once per quarter per connection → subsequent opens = cache hit = $0

// Cache: quarterly (connection_id + quarter + language + promptVersion)
// Invalidation: NEVER (user changes relationship data → force regen next Q)
```

#### Library Generation

```typescript
// This is the highest risk feature. Enforce:
// 1. Per user per day: max 5 new chart/numerology generations (checkout mode)
// Redis: `library:daily:{userId}:{date}` → max 5

// 2. Per user lifetime: max 50 checkout books total (prevent library farm)
// Check: SELECT COUNT(*) FROM library_checkouts WHERE user_id = userId AND book_type = 'astrology'
// At 50 → soft block with "Contact support to expand your library"

// 3. Seat plan multiplier: seat_3 and seat_5 owners get same limits as individual
// NO multiplied limits for seat plans — prevent farming

// Cache: permanent (chart_key hash → narrative never expires)
// Reuse: same person's chart on same day = cache hit = $0
```

#### Tarot

```typescript
// Free: 1 lifetime draw (enforced via tarot_usage table)
// Premium: existing auth limits (20/hr, 100/day) are reasonable
// No changes needed for premium tarot cost control

// Free tarot recording:
await supabase.from("tarot_usage").upsert(
  { user_id: userId, lifetime_count: 1, first_used_at: now(), last_used_at: now() },
  { onConflict: "user_id", ignoreDuplicates: false }
);
// Or better: do an atomic increment on conflict:
// ON CONFLICT (user_id) DO UPDATE SET lifetime_count = tarot_usage.lifetime_count + 1
```

### G3. Cache Strategy Per Feature

| Feature | Cache Key | TTL | Backend | Reuse Rule |
|---------|-----------|-----|---------|------------|
| Daily Insight (today) | `insight:{userId}:today:{periodKey}:{lang}:{promptV}` | 48h | Redis | Same period = same key = free |
| Year Insight | `insight:{userId}:year:{periodKey}:{lang}:{promptV}` | 400d | Redis | Same year = same key = free |
| Connection Brief | `(connectionId, localDate, lang, promptV)` | Immutable | DB | Never regenerates same day |
| Space Between | `(connectionId, quarter, lang, promptV)` | Quarterly | DB | 90-day window = cheap |
| Library Chart | `chart_key (deterministic hash)` | Permanent | DB | Same birth data = same key = free |
| Library Numerology | `numerology_key (deterministic hash)` | Permanent | DB | Same name+DOB = same key = free |
| Tarot | None (stateless) | N/A | N/A | No caching (fast model) |

**Deterministic keys prevent double-generation.** If a user checks out the same chart twice, the second call is free.

### G4. Rate Limiting Strategy

```typescript
// Hierarchy: most specific wins

// Tier 1: Global budget (existing costControl.ts — keep)
checkBudget() → if over daily limit → 503 all AI routes

// Tier 2: Per-feature daily limits (new, per user):
// Redis key: `limit:{feature}:{userId}:{date_utc}`
// Limits:
//   daily_insight: free=1, premium=10 (soft, for abuse only)
//   connection_brief: free=5/day, premium=100/day
//   space_between: free=blocked, premium=5/day
//   library_generate: free=blocked, premium=5/day
//   tarot: free=1 lifetime, premium=20/hr via existing

// Tier 3: Per-endpoint burst (existing rateLimit.ts — keep)
// Burst protects against API hammering

// Tier 4: Per-IP (existing via getClientIP — keep for anonymous)
// Add: IP-based limits for sign-up endpoint (prevent bulk account creation)
// Redis: `signup:ip:{ip}:{date}` → max 5 accounts per IP per day

// Plan-aware limits in canAccessFeature():
// Free users: lower limits enforced in the function
// Premium users: higher limits enforced in the function
// Seat users: same as premium
```

### G5. AI Usage Ledger (Metering)

The existing `ai_usage_events` table is good. Add cost capture:

```sql
-- Verify these columns exist (from migration 20260114170000_ai_usage_cost_micros.sql):
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS cost_micros bigint; -- 1 microdollar = $0.000001

-- Add plan-tier tracking:
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS plan_tier text;
-- Values: 'free', 'individual', 'seat_3', 'seat_5', 'comped', 'admin'
```

**Usage tracking in each AI route:**
```typescript
// After OpenAI call + before caching:
await trackUsage({
  feature_label: "daily_insight_today",
  route: "/api/insights",
  model: OPENAI_MODELS.dailyInsights,
  cache_status: fromCache ? "hit" : "miss",
  input_tokens: usage.prompt_tokens,
  output_tokens: usage.completion_tokens,
  cost_micros: estimateCostMicros(model, input_tokens, output_tokens),
  user_id: userId,
  plan_tier: profile.membership_plan,  // ← ADD THIS
  period_key: periodKey,
});
```

**Budget guards:**
```typescript
// Daily: $100 global (existing — keep)
// Weekly: Add $500/week Redis counter (for cost planning)
// Monthly: Add $1500/month Redis counter
// Per-user: $5/month max (detect runaway accounts)

// Redis keys:
// `budget:global:daily:{YYYY-MM-DD}` → $100 cap (existing)
// `budget:global:weekly:{YYYY-Www}` → $500 cap (new)
// `budget:user:{userId}:monthly:{YYYY-MM}` → $5 cap (new)
```

**Graceful degradation:**
```typescript
// If user hits their monthly $5 budget:
// 1. Return 503 with { code: "BUDGET_EXCEEDED", message: "Daily limit reached, resets tomorrow" }
// 2. Don't reveal the internal budget reasoning (just say "limit reached")
// 3. Log internally with user_id for review

// If Redis is down (fail closed for free users, fail open for premium):
// Premium users: continue (losing them due to Redis downtime = bad)
// Free users: deny (they don't expect guaranteed access)
```

### G6. Degrade Gracefully

| Scenario | Behavior |
|----------|----------|
| Redis down for rate limiting | Premium: fail open (allow); Free: fail closed (deny AI generation) |
| Redis down for budget tracking | Fail open for premium, fail closed for free (existing behavior, correct) |
| OpenAI slow / timeout | Return 503 with `Retry-After: 30`. If insight is cached → serve cache. If not → can't degrade, return error. |
| OpenAI errors (4xx/5xx) | Log + return 503. Do NOT increment usage counter on failure. |
| DB down for brief cache | Can't serve cached brief → attempt generation anyway (accept cost) or return cached insight instead |
| Stripe webhook missed | Stripe retries 72h. Add reconciliation cron: `/api/cron/sync-subscriptions` runs every 6h, checks `stripe.subscriptions.list(status: "active")` vs DB |

### G7. Abuse Pattern Detection

```typescript
// Red flags to log (not block, just alert):
const RED_FLAGS = {
  // Unusual regeneration: same user generates same chart multiple times per day
  // Symptom: cache hit rate for user < 50% over 24h
  HIGH_GENERATION_RATE: "user generated >3 unique AI requests in <5 minutes",

  // Account farm: many new accounts from same IP in 24h
  IP_SIGNUP_BURST: "more than 3 account creations from same IP in 24h",

  // Seat farming: seat_5 owner with 4 seats all generating library books same day
  SEAT_FARM: "all seat members of same owner generated library books same day",

  // Tarot bypass attempt: free user getting 429 on tarot, switches IP, tries again
  // (already mitigated by user_id-based lifetime check, not IP-based)

  // Library bomb: user generates 10+ new checkout books in 1 day
  LIBRARY_SPAM: "user generated >5 library checkouts in 24h",
};

// Detection: cron job runs every hour, queries ai_usage_events for patterns
// Alert: send to internal Slack/email if red flag hit
// Action: manual review, not auto-ban (avoid false positives)
```

### G8. Cost Controls Checklist (Prioritized)

**P0 (Ship with Phase 1):**
- [ ] Free tier 1/day insight enforced in API (not just UI)
- [ ] Space Between locked to Premium in API (currently unguarded — most expensive endpoint)
- [ ] Library generation locked to Premium in API
- [ ] Global $100/day budget circuit breaker (exists — verify it's working)

**P1 (Ship with Phase 2–3):**
- [ ] Free tier 5 connections max enforced in API
- [ ] Free tier connection brief limit (5/day total) enforced in API
- [ ] Tarot 1-lifetime draw enforced for free users in API
- [ ] `daily_insight_usage` table created + populated
- [ ] `tarot_usage` table created + populated
- [ ] Per-user monthly budget cap ($5/user/month) added to `canAccessFeature()`
- [ ] Library generation: 5/day per user hard cap (Premium)
- [ ] Library checkout: 50/lifetime per user soft cap (Premium)

**P2 (Ship with Phase 4–5):**
- [ ] `plan_tier` column added to `ai_usage_events`
- [ ] Seat abuse prevention: same seat plan limits as individual (no multiplication)
- [ ] Weekly + monthly global budget counters
- [ ] IP-based signup rate limit (5/IP/day)
- [ ] Admin dashboard: per-user cost by day/month query
- [ ] Alerting on red flags (abuse detection cron)

**P3 (Future hardening):**
- [ ] Space Between: global $50/day budget cap separate from main budget
- [ ] Library: global $30/day budget cap for all generation
- [ ] Connection brief: downgrade to smaller/cheaper model for free tier (if model exists)
- [ ] Prompt optimization pass (reduce token count by 20% = 20% cost reduction)
- [ ] Stream responses to detect partial failures without full cost

---

## Summary: Gaps & Risks (Ranked)

| # | Gap | Risk | Phase |
|---|-----|------|-------|
| 1 | API routes have zero membership checks | CRITICAL — free users can curl premium content | Phase 1 |
| 2 | No free account registration path | HIGH — blocks Free-first business model | Phase 2 |
| 3 | Protected layout blocks all non-paying users | HIGH — contradicts business rules | Phase 2 |
| 4 | No `invoice.payment_failed` webhook | HIGH — users lose access without warning | Phase 4 |
| 5 | No Stripe Customer Portal | HIGH — users can't manage subscriptions | Phase 4 |
| 6 | `trial_period_days: 7` contradicts "no trials" rule | MEDIUM — shipping incorrect billing | Phase 4 |
| 7 | Space Between is unguarded (most expensive endpoint) | MEDIUM — free cost leak | Phase 1 |
| 8 | No tarot lifetime tracking | MEDIUM — free users get unlimited tarot | Phase 1 |
| 9 | No connection count limit | MEDIUM — free users add unlimited connections | Phase 1 |
| 10 | No seat system | MEDIUM — seat plans exist in Stripe but not enforced | Phase 5 |
| 11 | No post-cancel read-only retention | LOW — good business practice | Phase 2–3 |
| 12 | Zero payment test implementations | LOW — regression risk | Phase 7 |
| 13 | Library checkout has no per-user daily cap | LOW — $0.15/chart × many checkouts = cost risk | Phase 1 |
| 14 | No stripe_events_processed idempotency table | LOW — duplicate webhook processing possible | Phase 4 |
| 15 | `membership_plan: "family"` is deprecated by seat system | LOW — legacy value in DB | Phase 5 |

---

## Acceptance Checklist (Overall)

**Registration:**
- [ ] User can create free account without entering payment
- [ ] Free user can complete onboarding
- [ ] Free user lands on /sanctuary with daily insight

**Free Tier Enforcement:**
- [ ] Free user gets exactly 1 daily insight per UTC day (API enforced)
- [ ] Free user gets 403 on 2nd insight request same day
- [ ] Free user can save up to 5 connections
- [ ] Free user gets 403 on 6th connection creation
- [ ] Free user gets 1 tarot draw lifetime
- [ ] Free user gets 403 on 2nd tarot attempt
- [ ] Free user can view Library tab (see shell)
- [ ] Free user gets 403 on any library generation
- [ ] Free user gets 403 on Space Between
- [ ] Free user gets 403 on Year insight
- [ ] Curl attacks on premium endpoints with free JWT → 403

**Premium Tier:**
- [ ] Upgrade flow completes with no trial
- [ ] User immediately has full access after payment
- [ ] User can open Stripe Customer Portal from Settings
- [ ] Cancellation at period end → access maintained until end date
- [ ] After cancellation, user can read own official outputs only

**Seat System:**
- [ ] Owner can invite up to 2 (seat_3) or 4 (seat_5) members
- [ ] Invite token expires after 7 days
- [ ] Member can accept invite (creates active seat)
- [ ] Member gets Premium access while owner active
- [ ] Revoking seat → member loses access immediately
- [ ] Owner cancels → all seat members notified + offered Individual plan
- [ ] Seat member retains own official outputs post-cancellation

**Cost Controls:**
- [ ] Global $100/day budget blocks all AI routes when exceeded
- [ ] Space Between: 5/user/day max
- [ ] Library checkout: 5/user/day max, 50/user/lifetime max
- [ ] Connection briefs: 100/user/day max (premium)
- [ ] ai_usage_events captures plan_tier on every call
- [ ] No abuse detected in production after 1 week post-launch
