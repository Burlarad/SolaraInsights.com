# Solara Insights — Paywall & Payments Exhaustive Audit

**Date:** 2026-02-17
**Auditor:** Claude (Principal Product + Payments + Security Auditor)
**Stack:** Next.js 15 App Router · Supabase (RLS) · Stripe · Render

---

## A. PAYWALL SYSTEM MAP (End-to-End)

### Current Flow (What Exists Today)

```
User visits solarainsights.com
       │
       ▼
   Middleware (middleware.ts)
   • Sets session cookie (__Host-solara_sid)
   • Sets locale cookie
   • Does NOT check auth or membership
       │
       ▼
   Route group: app/(protected)/layout.tsx   ← ONLY enforcement point
   • 1. Auth check      → no session? redirect /sign-in
   • 2. Profile check    → no profile? redirect /join
   • 3. Hibernation gate → hibernated? redirect /welcome?hibernated=true
   • 4. Payment gate     → not paid? redirect /join
   •    isPaid = devBypass || admin || is_comped || (plan ≠ none && status ∈ {trialing, active})
   • 5. Onboarding gate  → not onboarded? redirect /welcome or /onboarding
       │
       ▼
   All protected pages render (all-or-nothing access)
   • /sanctuary (daily insight)
   • /sanctuary/connections
   • /sanctuary/tarot
   • /sanctuary/birth-chart
   • /sanctuary/numerology
   • /sanctuary/library
   • /settings
```

### Where Paywall Enforcement EXISTS

| Layer | File | What It Does |
|-------|------|-------------|
| Server layout | `app/(protected)/layout.tsx` | Redirects unpaid users to `/join` |
| Client helper | `lib/membership/status.ts` | `hasActiveMembership()` for join-page redirect-away |
| Stripe webhook | `app/api/stripe/webhook/route.ts` | Sets `membership_plan` + `subscription_status` on profiles |
| Checkout | `app/api/stripe/checkout/route.ts` | Creates Stripe checkout session with 7-day trial |
| Claim session | `lib/stripe/claimCheckoutSession.ts` | Links Stripe payment to OAuth user |

### Where Paywall Enforcement is MISSING (Critical Gaps)

| Layer | Gap | Risk |
|-------|-----|------|
| **API routes** | `/api/insights`, `/api/birth-chart-library`, `/api/numerology-library`, `/api/connections`, `/api/connection-brief`, `/api/connection-space-between`, `/api/numerology`, `/api/user/social-insights` — **NONE check membership** | Any authenticated user can call these directly, bypassing the layout gate entirely. A free user who signs in can `curl` any endpoint and get full premium content. **SEVERITY: CRITICAL** |
| **Feature-level gating** | No per-feature entitlements | Free users should get 1 daily insight; instead they get nothing or everything. No partial access. |
| **Stripe Customer Portal** | Not integrated | Users cannot manage their subscription (update card, cancel, view invoices) from within the app. |
| **`invoice.payment_failed`** | Not handled | If payment fails, the app relies entirely on `subscription.updated` setting `past_due`. No proactive user notification. |
| **Free tier daily insight** | Not implemented | Business rule says Free = 1 daily insight. Currently Free = no access at all. |
| **Rate limiting on premium features** | Not linked to plan tier | Rate limits exist globally but don't differentiate Free vs Premium. |

---

## B. ENTITLEMENTS SPEC

### Feature Entitlement Matrix

| Feature | ID | Free | Premium (Individual) | Family (Seat User) | Enforcement |
|---------|-----|------|---------------------|---------------------|-------------|
| Daily Insight | `daily_insight` | 1/calendar day | Unlimited | Unlimited | API route + DB usage row |
| Connections | `connections` | Locked | Full access | Full access | API route check |
| Year Forecast | `year_forecast` | Locked | Full access | Full access | API route check |
| Tarot | `tarot` | Locked | Full access | Full access | API route check |
| Library (Astrology) | `library_astrology` | Locked | Full access | Full access | API route check |
| Library (Numerology) | `library_numerology` | Locked | Full access | Full access | API route check |
| Birth Chart | `birth_chart` | Locked | Full access | Full access | API route check |
| Numerology Profile | `numerology` | Locked | Full access | Full access | API route check |
| Social Insights | `social_insights` | Locked | Full access | Full access | API route check |
| Connection Brief | `connection_brief` | Locked | Full access | Full access | API route check |
| Settings | `settings` | Full access | Full access | Full access | Always allowed |

### Feature Definitions

- **daily_insight**: The main Sanctuary page insight generation. Free users get exactly 1 per UTC calendar day.
- **connections**: View and generate connection compatibility readings between two birth charts.
- **year_forecast**: Annual forecast narrative (if it exists as a separate feature — inferred from "Year" tab mention).
- **tarot**: AI-powered tarot card draws with interpretations.
- **library**: Astrology and Numerology book generation/storage (narrative generation costs ~$0.05-0.15/book in OpenAI).
- **birth_chart**: Full birth chart computation + narrative.
- **numerology**: Full numerology profile computation + narrative.
- **social_insights**: AI-generated insights from connected social accounts.

### Enforcement Rule (Canonical)

```
Server-side truth:
  1. Check auth (Supabase session) → 401 if missing
  2. Check profile.membership_plan + profile.subscription_status
  3. Check feature entitlement: canAccessFeature(userId, featureName)
  4. For daily_insight on Free: check daily_insight_usage table for today's count
  5. Return 403 with { code: "FEATURE_LOCKED", upgrade_url: "/join" } if denied
```

---

## C. ONBOARDING FLOW DESIGN

### Flow 1: New User → First Daily Insight → See Locked Features → Upgrade

```
Step 1: User visits solarainsights.com
        → Landing page with public features (horoscope, tarot preview, compatibility)
        → CTA: "Sign Up Free" or "Start Your Free Trial"

Step 2: User creates account (email/OAuth)
        → Profile created with membership_plan = "none"
        → Redirected to /sanctuary (home/daily insight page)

Step 3: Free user on /sanctuary
        → Sees daily insight generation (1/day)
        → All other tabs show lock icon + blurred preview
        → Microcopy on locked tab: "Unlock with Premium"

Step 4: User taps locked feature
        → Lock screen overlay:
          Title: "This feature is part of Premium"
          Body: "Start your 7-day free trial to unlock everything."
          CTA: "Start Free Trial" → /join
          Secondary: "Maybe later"

Step 5: User returns next day
        → Gets another daily insight (1/day reset)
        → Locked features remain locked
```

### Flow 2: Upgrade to Premium (Stripe)

```
Step 1: User clicks upgrade CTA → /join
Step 2: /join page shows Stripe Pricing Table
        → Individual plan: $X/month (7-day free trial)
        → Family plan: $Y/month (7-day free trial, up to 5 people)
Step 3: User selects plan → Stripe Checkout
Step 4: Stripe Checkout completes
        → Webhook fires checkout.session.completed
        → Profile updated: membership_plan = "individual", subscription_status = "trialing"
Step 5: Redirect to /welcome?status=success
        → Welcome email sent
Step 6: User completes onboarding (/onboarding)
Step 7: Full Sanctuary access unlocked
```

### Flow 3: Family Plan Purchase → Invite → Accept → Revoke

```
Purchase:
  1. Owner selects Family plan on /join
  2. Stripe Checkout → subscription created
  3. Owner profile: membership_plan = "family", subscription_status = "trialing"

Invite (future /settings/family page):
  1. Owner enters email address for seat member
  2. System creates family_members row: status = "invited", invite_token = random
  3. System sends invite email with link: /family/accept?token={invite_token}
  4. Max 4 invites (owner is seat 1 of 5)
  5. Microcopy: "Share your Solara membership with up to 4 people"

Accept:
  1. Recipient clicks invite link
  2. If not registered → sign up flow → then auto-accept
  3. If registered → update family_members: status = "active", accepted_user_id = their ID
  4. Recipient profile gets family access (via family_members lookup, NOT profile.membership_plan change)
  5. Microcopy: "You've been added to [Owner]'s Solara Family. Enjoy full access."

Revoke:
  1. Owner visits /settings/family
  2. Clicks "Remove" next to a seat member
  3. family_members row: status = "revoked", revoked_at = now()
  4. Revoked user loses Premium access on next request
  5. Microcopy: "This person will lose Premium access immediately."

Seat Reassignment:
  1. Owner removes one member → revokes seat
  2. Owner invites new member → creates new invite
  3. Net seat count must stay ≤ 4 invited/active (excluding owner)
```

### Flow 4: Referral "1 Month Free"

```
Generate Share Link:
  1. Premium user visits /settings or /sanctuary
  2. Clicks "Share Solara" button
  3. System generates unique referral code: ref_{userId_short}_{random6}
  4. Creates referrals row: referrer_user_id, code, created_at, expires_at = +30d
  5. Share link: https://solarainsights.com/ref/{code}
  6. Microcopy: "Give a friend 1 month of Premium free"

Recipient Opens Link:
  1. /ref/{code} → landing page showing: "You've been invited to try Solara Premium free for 1 month"
  2. CTA: "Claim Your Free Month" → /join?ref={code}

Redemption:
  1. Recipient signs up (or logs in if existing free user)
  2. At Stripe Checkout, code is applied as a Stripe Coupon (100% off for 1 month)
  3. Stripe subscription created with coupon → first month free, then regular price
  4. referrals row updated: redeemed_by, redeemed_at
  5. Referrer notified (optional email)

After Free Month Ends:
  - Stripe automatically charges the card on file
  - If no card / payment fails → subscription moves to past_due → eventually canceled
  - Microcopy at signup: "After your free month, you'll be charged $X/month. Cancel anytime."

Policy Recommendation: New customers only (never had a paid subscription). Rationale below in Section E.
```

### Lock Screen Copy Suggestions

| Context | Title | Body | CTA |
|---------|-------|------|-----|
| Locked tab (Connections) | "Connections is a Premium feature" | "Discover how your chart interacts with the people in your life." | "Start Free Trial" |
| Locked tab (Tarot) | "Tarot Readings are part of Premium" | "Draw cards and receive AI-interpreted readings tailored to your chart." | "Start Free Trial" |
| Locked tab (Library) | "Your Library awaits" | "Generate and collect personalized astrology and numerology books." | "Start Free Trial" |
| Daily insight limit reached | "You've used your daily insight" | "Come back tomorrow for another, or upgrade to Premium for unlimited insights." | "Upgrade to Premium" |
| Expired trial | "Your trial has ended" | "Continue exploring your cosmic profile with Premium." | "Subscribe Now" |

---

## D. STRIPE IMPLEMENTATION AUDIT

### Products & Prices to Create in Stripe

| Product | Price | Type | Trial |
|---------|-------|------|-------|
| Solara Premium (Individual) | $X/month | Recurring subscription | 7 days |
| Solara Premium (Family) | $Y/month | Recurring subscription | 7 days |

**Current state:** Price IDs are configured via env vars (`STRIPE_PRICE_ID`, `STRIPE_FAMILY_PRICE_ID`). Both exist in Stripe already.

### Coupon/Promo for Referrals

Create in Stripe:
- **Coupon:** "referral_1mo_free" — 100% off, duration = once (1 month), max_redemptions = null (managed app-side)
- **Promotion Code:** Generated per-referral via `stripe.promotionCodes.create()` with the above coupon, `max_redemptions: 1`, `restrictions.first_time_transaction: true`

### Customer Portal

**Status: Not integrated. Must add.**

Setup:
1. Configure Customer Portal in Stripe Dashboard (allowed actions: cancel, update payment method, view invoices)
2. Create API route: `POST /api/stripe/portal` → creates portal session → returns URL
3. Add "Manage Subscription" button in Settings page
4. Portal session URL: `stripe.billingPortal.sessions.create({ customer: stripe_customer_id, return_url: appUrl + "/settings" })`

### Webhooks Required (Exact Events)

| Event | Status | Handler |
|-------|--------|---------|
| `checkout.session.completed` | Implemented | Sets membership_plan, stripe_customer_id, subscription_status |
| `customer.subscription.updated` | Implemented | Updates subscription_status (active/canceled/past_due/trialing) |
| `customer.subscription.deleted` | Implemented | Sets subscription_status = canceled |
| `invoice.payment_succeeded` | Implemented | Records foundation_ledger entry |
| `invoice.payment_failed` | **MISSING** | Should: update subscription_status to past_due, send email warning |
| `customer.subscription.trial_will_end` | **MISSING** | Should: send "trial ending in 3 days" email |
| `charge.dispute.created` | **MISSING** | Should: flag account, log for review |

### Stripe ↔ App DB Sync Rules

**Source of truth:** Stripe is authoritative for subscription state. App DB is a cache.

```
Stripe event fires → Webhook handler → Update profiles table
                                     → App reads profiles table for access decisions
```

**Critical rule:** Never grant access based solely on client-side state. Always read from `profiles` table server-side.

**Sync failure recovery:**
- If webhook fails, Stripe retries for up to 72 hours
- Fallback: periodic cron job (`/api/cron/sync-subscriptions`) that calls `stripe.subscriptions.list()` and reconciles

### Handling Edge Cases

| Scenario | Behavior |
|----------|----------|
| **Cancellation** | `subscription.updated` with status=canceled → profiles.subscription_status = "canceled" → access denied on next request |
| **Failed payment** | `invoice.payment_failed` → profiles.subscription_status = "past_due" → access still granted for grace period (Stripe retry window) → after final retry fails, `subscription.deleted` → access revoked |
| **Chargeback** | `charge.dispute.created` → flag account in profiles (new column: `has_dispute = true`) → block access → manual review |
| **Upgrade individual→family** | User purchases family plan → `checkout.session.completed` updates `membership_plan = "family"` → old individual subscription should be canceled (handle in checkout or via Stripe proration) |
| **Downgrade family→individual** | Via Customer Portal or manual → `subscription.updated` → update `membership_plan` accordingly → revoke family seats |
| **Proration** | Use Stripe's default proration behavior. For mid-cycle upgrades, charge the difference. For downgrades, apply credit. |

### Free Plan in Stripe?

**Recommendation: Do NOT represent Free in Stripe.**

Rationale:
- Free is the default state (no payment required)
- Creating Stripe customers for free users adds API calls and customer count
- Free entitlements are enforced app-side (daily insight limit)
- When a free user upgrades, Stripe customer is created at that point
- Simpler data model: no Stripe = free, has Stripe + active = premium

### Data Stored Where

| Data | Where | Why |
|------|-------|-----|
| `stripe_customer_id` | profiles table | Link app user to Stripe customer |
| `stripe_subscription_id` | profiles table | Quick lookup for portal session creation |
| `subscription_status` | profiles table | Fast access checks without Stripe API call |
| `membership_plan` | profiles table | Which plan tier (individual/family) |
| `subscription_start_date` | profiles table | For analytics and trial end calculation |
| `subscription_end_date` | profiles table | When canceled, shows end of access period |
| Full subscription object | Stripe (source of truth) | Webhooks sync relevant fields to DB |
| Payment history | Stripe only | Never store card details; use Customer Portal |
| Foundation ledger | `foundation_ledger` table | Charity accrual tracking |

---

## E. REFERRAL "ONE MONTH FREE" — ABUSE ANALYSIS

### Abuse Vectors & Mitigations

| # | Vector | Severity | Mitigation |
|---|--------|----------|------------|
| 1 | **Unlimited code generation** — user generates thousands of referral codes | High | Limit: 5 active (unredeemed) referral codes per user at any time |
| 2 | **Self-referral** — user refers their own email | High | Block: referrer_user_id cannot match redeemer_user_id; compare emails |
| 3 | **Multiple redemptions per recipient** — same person claims multiple codes | High | Stripe: `first_time_transaction: true` on promotion code. App: check referrals table for prior redemption by user_id |
| 4 | **Disposable emails** — create throwaway accounts to farm free months | Medium | Stripe `first_time_transaction` catches this at payment method level (same card can't get two "first time" promos). Consider: require payment method upfront even for free month |
| 5 | **Existing customers re-redeeming** — current/past Premium user uses referral | Medium | Policy: referral only for users who have NEVER had subscription_status = "active" or "trialing". Check at redemption time |
| 6 | **Family seat farming** — family owner invites, person redeems referral, leaves family, uses referral again | Low | Referral redemption checks both referral history AND family_members history |
| 7 | **Code sharing on forums** — referral code posted publicly, mass redemption | Medium | Max redemptions per code = 1 (one code, one recipient). Codes expire after 30 days. Referrer must be active Premium subscriber |
| 8 | **Referral → cancel → refer again loop** — get free month, cancel, get referred again | Medium | Lifetime: each user_id can redeem at most 1 referral ever. Store in referrals table |

### Recommended Policy

1. **New customers only** (never had subscription_status in {active, trialing})
2. **1 code = 1 redemption** (Stripe promotion code with max_redemptions = 1)
3. **Max 5 active codes per referrer** at any time
4. **Codes expire after 30 days** unused
5. **Payment method required** at checkout (card collected, not charged for 30 days)
6. **First-time transaction restriction** on Stripe promotion code
7. **Lifetime limit**: each user can be a referral recipient exactly once
8. **Referrer must have active subscription** to generate codes

### Data Model for Referral Tracking

```sql
CREATE TABLE referrals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES profiles(id),
  code            text UNIQUE NOT NULL,        -- ref_abc123_xyz789
  stripe_promo_id text,                        -- Stripe promotion code ID
  status          text NOT NULL DEFAULT 'active', -- active | redeemed | expired | revoked
  redeemed_by     uuid REFERENCES profiles(id),
  redeemed_at     timestamptz,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_redeemer UNIQUE (redeemed_by) -- each user can only redeem once
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX idx_referrals_code ON referrals(code);
CREATE INDEX idx_referrals_status ON referrals(status) WHERE status = 'active';
```

---

## F. FAMILY PLAN SEAT MANAGEMENT SPEC

### Seat Model

- Owner = 1 seat (the subscriber)
- Additional seats = up to 4 invites
- Total = 5 people with Premium access

### Table Structure

The existing `family_members` schema (currently archived) is well-designed. Unarchive and use:

```sql
-- Already exists (in archive schema). Move back to public:
CREATE TABLE family_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   uuid NOT NULL REFERENCES profiles(id),
  owner_email     text NOT NULL,
  invite_email    text NOT NULL,
  status          text NOT NULL DEFAULT 'invited',  -- invited | active | revoked
  invite_token    text UNIQUE NOT NULL,
  provider        text,                              -- how they were invited
  invited_at      timestamptz NOT NULL DEFAULT now(),
  accepted_user_id uuid REFERENCES profiles(id),
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  expires_at      timestamptz,                       -- invite expiry (7 days)
  meta            jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

### Flows

**Invite:**
1. Owner calls `POST /api/family/invite` with `{ email: "friend@example.com" }`
2. Server checks: owner has `membership_plan = "family"` AND `subscription_status ∈ {active, trialing}`
3. Server checks: count of `family_members WHERE owner_user_id = owner AND status IN ('invited', 'active')` < 4
4. Server creates `family_members` row with `invite_token = crypto.randomUUID()`, `expires_at = now() + 7 days`
5. Server sends invite email with link

**Accept:**
1. Recipient visits `/family/accept?token={token}`
2. Server validates: token exists, status = "invited", not expired
3. If recipient not logged in → redirect to sign-in/sign-up with `?return_to=/family/accept?token={token}`
4. Server updates: `status = "active"`, `accepted_user_id = user.id`, `accepted_at = now()`
5. Recipient now passes `canAccessFeature()` checks via family membership lookup

**Revoke:**
1. Owner calls `POST /api/family/revoke` with `{ member_id: uuid }`
2. Server validates: caller is the `owner_user_id`
3. Server updates: `status = "revoked"`, `revoked_at = now()`
4. Revoked user loses access on next request

**Subscription Lapses:**
1. Owner's subscription goes to `canceled`
2. All `family_members` with `status = 'active'` should lose access
3. Enforcement: `canAccessFeature()` checks owner's subscription status when evaluating family seat access
4. No need to individually revoke — the ownership link handles it

### Edge Cases

| Case | Behavior |
|------|----------|
| Invited email not yet registered | Invite stays `status = 'invited'`. When they register and visit the accept link, it works. Invite expires after 7 days if unclaimed. |
| User already has Individual Premium | They can accept family invite. Their own subscription remains. If they cancel their individual sub, they still have family access. No conflict. |
| User already in another family | Reject: "You're already a member of another Solara Family. Please leave that family first." |
| Owner tries to invite themselves | Reject: compare owner_email vs invite_email (and owner_user_id check on accept) |
| Owner cancels subscription | All family seats lose access immediately (checked via owner's subscription_status) |
| Owner resubscribes | Family seats automatically regain access (owner's subscription_status becomes active again) |

---

## G. DATA MODEL & RLS CHECKLIST

### Schema Updates Needed

**profiles table** (existing — add columns):
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_dispute boolean NOT NULL DEFAULT false;
-- All other needed columns already exist
```

**daily_insight_usage** (new):
```sql
CREATE TABLE daily_insight_usage (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id),
  usage_date date NOT NULL DEFAULT CURRENT_DATE,  -- UTC date
  count      integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_user_date UNIQUE (user_id, usage_date)
);

CREATE INDEX idx_daily_insight_user_date ON daily_insight_usage(user_id, usage_date);
```

**referrals** (new — see Section E above)

**family_members** (existing — unarchive from `archive` schema back to `public`)

### RLS Policies

**profiles:**
```
- SELECT own:   auth.uid() = id                     ← exists
- INSERT own:   auth.uid() = id                     ← exists
- UPDATE own:   auth.uid() = id                     ← exists
- Service role: full access (for webhooks)           ← exists
```

**daily_insight_usage:**
```
- SELECT own:   auth.uid() = user_id
- INSERT own:   auth.uid() = user_id
- UPDATE own:   auth.uid() = user_id   (for incrementing count)
- Service role: full access
```

**referrals:**
```
- SELECT own:   auth.uid() = referrer_user_id OR auth.uid() = redeemed_by
- INSERT own:   auth.uid() = referrer_user_id
- UPDATE:       service_role only (redemption happens server-side)
- Service role: full access
```

**family_members:**
```
- SELECT:       auth.uid() = owner_user_id OR auth.uid() = accepted_user_id  ← exists
- INSERT:       service_role only (invites created server-side)
- UPDATE:       service_role only (accept/revoke handled server-side)
- Service role: full access                                                    ← exists
```

**foundation_ledger:**
```
- All operations: service_role only  ← exists
```

### Service Role vs User-Scoped Usage

| Operation | Client (user-scoped) | Server (service_role) |
|-----------|---------------------|-----------------------|
| Read own profile | ✓ | ✓ |
| Update membership fields | ✗ | ✓ (webhooks only) |
| Read daily_insight_usage | ✓ (own only) | ✓ |
| Write daily_insight_usage | ✓ (own only) | ✓ |
| Create referral codes | Route handler checks auth, then uses service_role | ✓ |
| Redeem referral | Service_role only | ✓ |
| Family invite/accept/revoke | Service_role only | ✓ |
| Foundation ledger | Service_role only | ✓ |

**Conflict to watch:** The `profiles` table uses user-scoped RLS for reads, but webhook handlers use `createAdminSupabaseClient()` (service_role) for writes. This is correct and should be maintained. Never allow client-side writes to `membership_plan` or `subscription_status`.

---

## H. API GATING & RATE LIMITING

### Canonical `canAccessFeature()` Function

```typescript
// lib/entitlements/canAccessFeature.ts

import { createAdminSupabaseClient } from "@/lib/supabase/server";

type FeatureName =
  | "daily_insight"
  | "connections"
  | "year_forecast"
  | "tarot"
  | "library"
  | "birth_chart"
  | "numerology"
  | "social_insights"
  | "connection_brief";

type AccessResult = {
  allowed: boolean;
  reason?: string;
  code?: "OK" | "AUTH_REQUIRED" | "FEATURE_LOCKED" | "DAILY_LIMIT_REACHED" | "SUBSCRIPTION_EXPIRED";
  upgradeUrl?: string;
};

// Features available to Free tier
const FREE_FEATURES: FeatureName[] = ["daily_insight"];
// Features that require Premium
const PREMIUM_FEATURES: FeatureName[] = [
  "connections", "year_forecast", "tarot", "library",
  "birth_chart", "numerology", "social_insights", "connection_brief",
];

export async function canAccessFeature(
  userId: string,
  feature: FeatureName
): Promise<AccessResult> {
  const supabase = createAdminSupabaseClient();

  // 1. Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("membership_plan, subscription_status, role, is_comped, has_dispute")
    .eq("id", userId)
    .single();

  if (!profile) {
    return { allowed: false, reason: "Profile not found", code: "AUTH_REQUIRED" };
  }

  // 2. Admin and comped users always have access
  if (profile.role === "admin" || profile.is_comped === true) {
    return { allowed: true, code: "OK" };
  }

  // 3. Dispute block
  if (profile.has_dispute) {
    return { allowed: false, reason: "Account under review", code: "FEATURE_LOCKED" };
  }

  // 4. Check if user has active Premium
  const hasPremium =
    profile.membership_plan !== "none" &&
    (profile.subscription_status === "active" || profile.subscription_status === "trialing");

  // 5. Check family seat access (if not directly premium)
  let hasFamilyAccess = false;
  if (!hasPremium) {
    const { data: familySeat } = await supabase
      .from("family_members")
      .select("id, owner_user_id")
      .eq("accepted_user_id", userId)
      .eq("status", "active")
      .single();

    if (familySeat) {
      // Verify owner's subscription is still active
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("subscription_status")
        .eq("id", familySeat.owner_user_id)
        .single();

      hasFamilyAccess =
        ownerProfile?.subscription_status === "active" ||
        ownerProfile?.subscription_status === "trialing";
    }
  }

  const hasFullAccess = hasPremium || hasFamilyAccess;

  // 6. Premium-only features
  if (PREMIUM_FEATURES.includes(feature)) {
    if (!hasFullAccess) {
      return {
        allowed: false,
        reason: "This feature requires Premium",
        code: "FEATURE_LOCKED",
        upgradeUrl: "/join",
      };
    }
    return { allowed: true, code: "OK" };
  }

  // 7. Daily insight (free with limit)
  if (feature === "daily_insight") {
    if (hasFullAccess) {
      return { allowed: true, code: "OK" };
    }

    // Free user: check daily limit
    const today = new Date().toISOString().split("T")[0]; // UTC date
    const { data: usage } = await supabase
      .from("daily_insight_usage")
      .select("count")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .single();

    if (usage && usage.count >= 1) {
      return {
        allowed: false,
        reason: "You've used your daily insight. Come back tomorrow or upgrade to Premium.",
        code: "DAILY_LIMIT_REACHED",
        upgradeUrl: "/join",
      };
    }

    return { allowed: true, code: "OK" };
  }

  return { allowed: false, reason: "Unknown feature", code: "FEATURE_LOCKED" };
}
```

### Usage in API Routes

```typescript
// Example: app/api/insights/route.ts (add at top of POST handler)
import { canAccessFeature } from "@/lib/entitlements/canAccessFeature";

// After auth check:
const access = await canAccessFeature(user.id, "daily_insight");
if (!access.allowed) {
  return NextResponse.json(
    { error: access.reason, code: access.code, upgradeUrl: access.upgradeUrl },
    { status: 403 }
  );
}

// After successful generation, record usage:
await supabase.from("daily_insight_usage").upsert(
  { user_id: user.id, usage_date: today, count: 1 },
  { onConflict: "user_id,usage_date" }
);
```

### Response Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `AUTH_REQUIRED` | 401 | Not authenticated |
| `FEATURE_LOCKED` | 403 | Feature requires Premium subscription |
| `DAILY_LIMIT_REACHED` | 429 | Free tier daily limit exceeded |
| `SUBSCRIPTION_EXPIRED` | 403 | Subscription canceled or past_due (after grace) |

### Response Payload Format

```json
{
  "error": "This feature requires Premium",
  "code": "FEATURE_LOCKED",
  "upgradeUrl": "/join"
}
```

### Daily Insight Caching

- After generating an insight, cache the result in Redis: `insight:{userId}:{date}` with TTL = 24 hours
- On page refresh, serve from cache → no OpenAI cost
- Cache key includes the date to auto-expire daily
- Free users: cache ensures they see their 1 insight on refresh without re-counting usage

### Timezone Consideration

- Use UTC for daily insight counting (simplest, most consistent)
- The usage_date column stores UTC date
- Edge case: a user near midnight UTC might feel like they "lost" an insight
- Acceptable tradeoff for simplicity. Alternative: store user's timezone in profile and calculate per-user local date (more complex, higher query cost)

---

## I. TEST PLAN + RELEASE PLAN

### Unit Tests Needed

| Test | File | Priority |
|------|------|----------|
| `canAccessFeature` returns OK for admin | `__tests__/entitlements/can-access.test.ts` | P0 |
| `canAccessFeature` returns OK for comped user | same | P0 |
| `canAccessFeature` returns LOCKED for free user on premium feature | same | P0 |
| `canAccessFeature` returns OK for free user's first daily insight | same | P0 |
| `canAccessFeature` returns DAILY_LIMIT for free user's second insight | same | P0 |
| `canAccessFeature` returns OK for family seat with active owner | same | P1 |
| `canAccessFeature` returns LOCKED for family seat with canceled owner | same | P1 |
| `hasActiveMembership` all scenarios | `__tests__/payments/membership-status.test.ts` | P0 |
| Referral code generation respects max 5 limit | `__tests__/referrals/referral.test.ts` | P1 |
| Referral blocks self-referral | same | P1 |
| Referral blocks repeat redemption | same | P1 |
| Family seat count enforcement (max 4 invites) | `__tests__/family/seats.test.ts` | P1 |
| Family invite acceptance flow | same | P1 |
| Family revocation flow | same | P1 |

### Integration Tests

| Test | Priority |
|------|----------|
| Stripe webhook `checkout.session.completed` → profile updated correctly | P0 |
| Stripe webhook `subscription.updated` → status synced correctly | P0 |
| Stripe webhook `subscription.deleted` → access revoked | P0 |
| Stripe webhook duplicate event → idempotent (no error) | P1 |
| Stripe webhook invalid signature → rejected | P1 |
| End-to-end: Free user → upgrade → access granted → cancel → access revoked | P0 |

### Smoke Tests for Production

1. Free user can sign up and see /sanctuary with 1 daily insight
2. Free user sees lock screens on premium features
3. Free user can upgrade via /join → Stripe Checkout → access granted
4. Premium user can access all features
5. Premium user can access Stripe Customer Portal from Settings
6. Webhook sync: cancel subscription in Stripe → access revoked in app within 60 seconds
7. Referral: generate code → share → recipient signs up → gets 1 free month
8. Family: invite → accept → member has access → revoke → member loses access
9. API routes return 403 for unauthenticated/free users on premium endpoints

### Rollback Plan

| Phase | Rollback |
|-------|----------|
| DB migrations | Each migration has a corresponding down migration (DROP TABLE IF EXISTS, ALTER TABLE DROP COLUMN) |
| `canAccessFeature` deployment | Feature flag: `ENABLE_FEATURE_GATING=true`. If false, all authenticated users get access (current behavior). Deploy code first, enable flag after verification. |
| Stripe Customer Portal | Purely additive — remove the Settings button to roll back |
| Referral system | Feature flag: `ENABLE_REFERRALS=true`. If false, referral endpoints return 404 |
| Family seats | Feature flag: `ENABLE_FAMILY_SEATS=true`. If false, family plan = individual access for owner only (current behavior) |

### Observability

| Metric/Log | Purpose |
|------------|---------|
| `entitlement.check` — log feature, userId, result, latency | Track access patterns, detect anomalies |
| `entitlement.denied` — counter by feature + reason | Alert on spike in denials (possible bug) |
| `stripe.webhook.processed` — counter by event type | Ensure webhooks are flowing |
| `stripe.webhook.failed` — counter + alert | Catch sync failures immediately |
| `referral.created` — counter | Track referral adoption |
| `referral.redeemed` — counter | Track conversion |
| `referral.abuse_blocked` — counter by reason | Catch abuse attempts |
| `daily_insight.limit_hit` — counter | Understand free-to-paid conversion pressure |
| `family.seat_count` — gauge by owner | Monitor seat utilization |

---

## J. FINAL OUTPUT

### 1. What's True Today

- **Stripe integration is production-ready** with checkout, webhook handling for 4 events, claim session, and welcome email.
- **Paywall is all-or-nothing**: either you have `membership_plan ≠ "none"` + `subscription_status ∈ {active, trialing}`, or you get redirected to `/join`. No partial access.
- **Enforcement is layout-only**: the protected layout gate (`app/(protected)/layout.tsx`) is the sole enforcement point. **API routes have zero membership checks.**
- **Free tier does not exist functionally**: there is no "Free gets 1 daily insight" — Free users are fully blocked.
- **Family plan schema exists but is archived**: the `family_members` table is in the `archive` schema. No application code references it. Family plan holders get individual access only.
- **Referral system does not exist**: no code, no tables, no UI.
- **Rate limiting exists** but is global (OpenAI budget) and per-route (burst/sustained), not per-plan-tier.
- **Test stubs exist** but all are `test.todo()` — zero actual test implementations.
- **No Stripe Customer Portal** integration exists.

### 2. What Should Be True (Target Architecture)

- **Free tier**: Authenticated users with `membership_plan = "none"` can access `/sanctuary` and get 1 daily insight per UTC day. All other features show lock screens with upgrade CTAs.
- **Premium tier**: Full access to all features. Subscription managed via Stripe Customer Portal.
- **Family tier**: Owner gets Premium + can invite up to 4 seats. Seat members get Premium access tied to owner's subscription.
- **Referral system**: Premium users can generate 1-use codes. New customers get 1 month free via Stripe coupon.
- **API-level enforcement**: Every premium API route checks `canAccessFeature()` server-side. No feature is accessible to free users via direct API calls.
- **Webhook coverage**: Handle `invoice.payment_failed` and `customer.subscription.trial_will_end` events.
- **Testing**: All entitlement logic, webhook handling, and referral/family flows have passing tests.

### 3. Gaps & Risks

| # | Gap | Risk Level | Impact |
|---|-----|-----------|--------|
| 1 | **API routes don't check membership** | CRITICAL | Free/unauthenticated users can call premium endpoints directly |
| 2 | **No Free tier partial access** | HIGH | Violates business requirement of 1 daily insight for free users |
| 3 | **No Stripe Customer Portal** | HIGH | Users cannot cancel or manage subscriptions → support burden, potential chargebacks |
| 4 | **No `invoice.payment_failed` handler** | MEDIUM | Users with failed payments may not know; app relies on eventual `subscription.deleted` |
| 5 | **Family seats not enforced** | MEDIUM | Family plan exists in Stripe pricing but provides no additional value over individual |
| 6 | **No referral system** | MEDIUM | Missing growth channel, but no security risk |
| 7 | **Zero test coverage on payments** | MEDIUM | Regression risk on any change to payment/entitlement logic |
| 8 | **`family_members` RLS in prod is overly broad** | LOW | `GRANT ALL ON family_members TO anon` allows unauthenticated reads. Currently mitigated by table being archived. |
| 9 | **No trial-ending notification** | LOW | Users may be surprised by first charge → chargeback risk |

### 4. Step-by-Step Implementation Plan (Ordered, Minimal-Risk)

#### Phase 1: API Gating (CRITICAL — do first)
**Goal:** Prevent free/unauthed users from accessing premium API endpoints.

1. Create `lib/entitlements/canAccessFeature.ts` with the canonical function
2. Add `canAccessFeature()` call to each premium API route:
   - `app/api/insights/route.ts` (daily_insight with Free limit)
   - `app/api/birth-chart-library/route.ts`
   - `app/api/numerology-library/route.ts`
   - `app/api/numerology/route.ts`
   - `app/api/connections/route.ts`
   - `app/api/connection-brief/route.ts`
   - `app/api/connection-space-between/route.ts`
   - `app/api/user/social-insights/route.ts`
3. Create `daily_insight_usage` table migration
4. Update `/sanctuary` page UI to handle 403 responses gracefully
5. **Test:** Verify free user gets 1 daily insight, denied on 2nd attempt, denied on premium endpoints

#### Phase 2: Free Tier UX
**Goal:** Make free users feel welcome, show value, drive upgrades.

1. Update protected layout to allow free users into `/sanctuary` (remove the all-or-nothing redirect)
2. Create `<FeatureLock>` component for locked tabs
3. Add lock overlays on Connections, Tarot, Library, Birth Chart, Numerology tabs
4. Add "Daily Limit Reached" state on Sanctuary home page
5. Add upgrade CTAs with clear copy
6. **Test:** Full free-user journey in browser

#### Phase 3: Stripe Customer Portal
**Goal:** Let users self-manage subscriptions.

1. Create `POST /api/stripe/portal` route
2. Add "Manage Subscription" button in Settings page
3. Configure Customer Portal in Stripe Dashboard
4. **Test:** Premium user can open portal, cancel, and access is revoked

#### Phase 4: Missing Webhooks
**Goal:** Handle payment failures and trial warnings.

1. Add `invoice.payment_failed` handler → set `subscription_status = "past_due"`, send warning email
2. Add `customer.subscription.trial_will_end` handler → send trial-ending email
3. Add `charge.dispute.created` handler → flag account
4. **Test:** Simulate events via Stripe CLI, verify DB updates and emails

#### Phase 5: Family Seats
**Goal:** Make family plan valuable.

1. Unarchive `family_members` table (migration to move from archive back to public)
2. Create API routes: `POST /api/family/invite`, `POST /api/family/accept`, `POST /api/family/revoke`, `GET /api/family/seats`
3. Update `canAccessFeature()` to check family seat access (already in spec above)
4. Create `/settings/family` UI page
5. Send invite emails
6. **Test:** Full invite → accept → access → revoke → no access flow

#### Phase 6: Referral System
**Goal:** Growth channel.

1. Create `referrals` table migration
2. Create API routes: `POST /api/referral/create`, `GET /api/referral/validate`
3. Integrate Stripe coupon/promotion code creation
4. Create `/ref/{code}` landing page
5. Update `/join` page to accept `?ref=` query param and apply promo
6. Add "Share Solara" button in Settings/Sanctuary
7. **Test:** Full referral → redeem → 1 month free → auto-charge flow

#### Phase 7: Testing & Hardening
**Goal:** Confidence for production.

1. Implement all `test.todo()` stubs in `__tests__/payments/`
2. Write `canAccessFeature` unit tests
3. Write referral abuse tests
4. Write family seat tests
5. Integration test: end-to-end Stripe webhook simulation
6. Add observability logging/metrics

### 5. Checklist to Verify Correctness

- [ ] Free user can sign up without payment
- [ ] Free user sees /sanctuary with daily insight
- [ ] Free user's 2nd daily insight returns 403 with upgrade CTA
- [ ] Free user gets 403 on `POST /api/birth-chart-library`
- [ ] Free user gets 403 on `POST /api/numerology-library`
- [ ] Free user gets 403 on `POST /api/connections`
- [ ] Free user sees lock screen on Connections tab
- [ ] Free user sees lock screen on Tarot tab
- [ ] Free user sees lock screen on Library tab
- [ ] Premium user can access all features
- [ ] Premium user can open Stripe Customer Portal
- [ ] Canceling in Stripe → user loses access within 60 seconds
- [ ] Failed payment → user gets email warning, access continues during retry window
- [ ] Trial ending → user gets email 3 days before
- [ ] Family owner can invite up to 4 seats
- [ ] Family seat member can access all features
- [ ] Revoking family seat → member loses access immediately
- [ ] Owner cancels family sub → all seat members lose access
- [ ] Referral code generated by premium user
- [ ] Referral code redeemed by new user → 1 month free
- [ ] Same user cannot redeem two referral codes
- [ ] Self-referral blocked
- [ ] Admin user always has access regardless of plan
- [ ] Comped user (`is_comped = true`) always has access
- [ ] `DEV_PAYWALL_BYPASS` works in dev, blocked in production
- [ ] API routes return proper error codes (401, 403, 429)
- [ ] Webhook signature verification rejects invalid signatures
- [ ] Duplicate webhook events are handled idempotently
