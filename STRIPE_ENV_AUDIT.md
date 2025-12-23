# STRIPE FORENSIC AUDIT

> **Generated:** 2025-12-23
> **Purpose:** Complete audit of Stripe configuration, env vars, flow tracing, and failure points.

---

## PART A: ENV TRUTH TABLE

### Stripe Environment Variables

| ENV VAR | REQUIRED | USED IN | .env VALUE | .env.local VALUE | .env.example | ISSUE |
|---------|----------|---------|------------|------------------|--------------|-------|
| `STRIPE_SECRET_KEY` | YES | lib/stripe/client.ts:10 | `sk_live_*` (LIVE) | `sk_live_*` (LIVE) | `sk_test_*` | Using LIVE keys in dev - OK if intentional |
| `STRIPE_PUBLISHABLE_KEY` | YES | lib/stripe/client.ts:19 | `pk_live_*` | `pk_live_*` | `pk_test_*` | OK |
| `STRIPE_WEBHOOK_SECRET` | YES | lib/stripe/client.ts:20 | `whsec_*` | `whsec_*` | `whsec_*` | OK |
| `STRIPE_PRICE_ID` | YES | lib/stripe/client.ts:22 | `prod_TGaXk2sthw3LaT` | `prod_TGaXk2sthw3LaT` | `price_*` | **CRITICAL: Using PRODUCT ID instead of PRICE ID** |
| `STRIPE_FAMILY_PRICE_ID` | YES | lib/stripe/client.ts:23 | `prod_TMAvqEzirpUdMr` | `prod_TMAvqEzirpUdMr` | `price_*` | **CRITICAL: Using PRODUCT ID instead of PRICE ID** |
| `STRIPE_PRICING_TABLE_ID` | NO | lib/stripe/client.ts:25 | `prctbl_*` | `prctbl_*` | `prctbl_*` | OK (not currently used in checkout) |

### URL Environment Variables

| ENV VAR | REQUIRED | USED IN | .env VALUE | .env.local VALUE | ISSUE |
|---------|----------|---------|------------|------------------|-------|
| `NEXT_PUBLIC_SITE_URL` | YES | OAuth callbacks | `https://solarainsights.com` | `https://dev.solarainsights.com` | OK |
| `NEXT_PUBLIC_APP_URL` | YES | Stripe redirects | `https://solarainsights.com` | `https://dev.solarainsights.com` | OK |
| `APP_URL` | LEGACY | Stripe checkout:45 | `https://solarainsights.com` | `https://dev.solarainsights.com` | OK (fallback chain) |

### Localhost Leak Scan

| File | Line | Value | Risk |
|------|------|-------|------|
| app/api/stripe/checkout/route.ts | 47 | `"http://localhost:3000"` | LOW - only used as last fallback |
| app/api/stripe/webhook/route.ts | 262 | `"http://localhost:3000"` | LOW - only used as last fallback |

**No `localhost:10000` found anywhere.**

---

## PART B: FLOW TRACE (END-TO-END)

### Checkout Flow

```
1. User on /join selects plan (individual/family)
   └─ app/(auth)/join/page.tsx

2. User clicks "Continue to payment"
   └─ handleCheckout() → POST /api/stripe/checkout
   └─ app/(auth)/join/page.tsx:45-71

3. Server creates Stripe Checkout Session
   └─ app/api/stripe/checkout/route.ts:50-70
   └─ Uses: STRIPE_CONFIG.priceIds.sanctuary (individual) or .family
   └─ Sets: metadata.plan, metadata.userId
   └─ success_url: ${appUrl}/welcome?status=success&session_id={CHECKOUT_SESSION_ID}
   └─ cancel_url: ${appUrl}/

4. User redirected to Stripe hosted checkout
   └─ Returns session.url → window.location.href = data.url

5. User completes payment on Stripe
   └─ Stripe redirects to success_url

6. Stripe fires webhook (async, may arrive before or after redirect)
   └─ POST /api/stripe/webhook
   └─ app/api/stripe/webhook/route.ts:11-76
```

### Webhook Flow

```
1. Stripe POST to /api/stripe/webhook
   └─ Body: raw text (req.text())
   └─ Header: stripe-signature

2. Signature verification
   └─ app/api/stripe/webhook/route.ts:34-46
   └─ Uses: STRIPE_CONFIG.webhookSecret

3. Event handling (checkout.session.completed)
   └─ app/api/stripe/webhook/route.ts:52-54 → handleCheckoutCompleted()

4. handleCheckoutCompleted():
   └─ app/api/stripe/webhook/route.ts:82-174
   └─ Extracts: email, plan (from metadata), userId, customerId, subscriptionId
   └─ If no userId: finds or creates user by email
   └─ Fetches subscription status (trialing/active)
   └─ Updates profile:
      - membership_plan: "individual" | "family"
      - stripe_customer_id
      - stripe_subscription_id
      - subscription_status: "trialing" | "active"
      - subscription_start_date
   └─ Sends welcome email

5. Subscription lifecycle events:
   └─ customer.subscription.updated → handleSubscriptionUpdated() :180-225
   └─ customer.subscription.deleted → handleSubscriptionDeleted() :231-252
```

### Protected Layout Gate

```
app/(protected)/layout.tsx:37-48

isPaid =
  role === "admin" OR
  is_comped === true OR
  (membership_plan !== "none" AND
   (subscription_status === "trialing" OR subscription_status === "active"))

If !isPaid → redirect("/join")
If isPaid && !is_onboarded → redirect("/welcome" or "/onboarding")
If isPaid && is_onboarded → ACCESS GRANTED
```

### State Machine

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   UNPAID    │ ──── │    PAID     │ ──── │  ONBOARDED  │ ──── │  SANCTUARY  │
│             │      │             │      │             │      │             │
│ membership_ │      │ membership_ │      │ is_onboarded│      │   ACCESS    │
│ plan="none" │      │ plan=*      │      │ = true      │      │   GRANTED   │
│ sub_status  │      │ sub_status  │      │             │      │             │
│ = null      │      │ = trialing/ │      │             │      │             │
│             │      │   active    │      │             │      │             │
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
       │                    │                    │
       │                    │                    │
    /join            /welcome + /onboarding   /sanctuary
```

### DB Columns for State

| Column | Table | Set By | Values |
|--------|-------|--------|--------|
| `membership_plan` | profiles | webhook | "none", "individual", "family" |
| `subscription_status` | profiles | webhook | null, "trialing", "active", "canceled", "past_due" |
| `stripe_customer_id` | profiles | webhook | cus_* |
| `stripe_subscription_id` | profiles | webhook | sub_* |
| `subscription_start_date` | profiles | webhook | ISO timestamp |
| `subscription_end_date` | profiles | webhook | ISO timestamp (on cancel) |
| `is_onboarded` | profiles | /api/user/profile | boolean |
| `onboarding_started_at` | profiles | /onboarding page | ISO timestamp |

---

## PART C: COMMON STRIPE FAILURE POINTS AUDIT

### 1. Wrong Price ID (CRITICAL - FOUND!)

**Status:** **BUG CONFIRMED**

```
.env:
STRIPE_PRICE_ID=prod_TGaXk2sthw3LaT      ← WRONG (Product ID)
STRIPE_FAMILY_PRICE_ID=prod_TMAvqEzirpUdMr ← WRONG (Product ID)

Should be:
STRIPE_PRICE_ID=price_XXXXX              ← Correct (Price ID)
STRIPE_FAMILY_PRICE_ID=price_XXXXX       ← Correct (Price ID)
```

**Impact:** Stripe checkout will fail with "No such price: prod_XXX"

**Fix:** Get the actual price IDs from Stripe Dashboard → Products → [Product] → Pricing → Copy price ID

### 2. Success URL Format

**Status:** OK

```typescript
// app/api/stripe/checkout/route.ts:68
success_url: `${appUrl}/welcome?status=success&session_id={CHECKOUT_SESSION_ID}`,
```

Uses proper template variable `{CHECKOUT_SESSION_ID}`.

### 3. Webhook Raw Body

**Status:** OK

```typescript
// app/api/stripe/webhook/route.ts:14
const body = await req.text();
```

Correctly uses `req.text()` not `req.json()`.

### 4. Webhook Secret Mismatch

**Status:** NEEDS VERIFICATION

Same webhook secret in `.env` and `.env.local`. Need to verify:
- Is this the LIVE webhook secret from Stripe Dashboard?
- Is the webhook endpoint configured in Stripe Dashboard pointing to correct URL?

### 5. Webhook Not Deployed/Reachable

**Status:** NEEDS VERIFICATION

Stripe Dashboard must have webhook configured:
- Endpoint: `https://solarainsights.com/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### 6. Idempotency Handling

**Status:** PARTIAL

No explicit idempotency check. If Stripe retries webhook:
- `handleCheckoutCompleted`: Would update profile again (mostly OK, overwrites same values)
- Could send duplicate welcome emails

**Recommended:** Add event ID tracking to prevent duplicate processing.

### 7. Session ID vs Subscription ID

**Status:** OK

Code correctly extracts subscription ID from session:
```typescript
const subscriptionId = session.subscription as string | null;
```

### 8. Event Handling Order

**Status:** OK

Handles `checkout.session.completed` first (initial purchase), then lifecycle events.

### 9. Race Condition (User Redirected Before Webhook)

**Status:** POTENTIAL ISSUE

If user arrives at `/welcome` before webhook fires:
- Profile still has `membership_plan: "none"`
- Protected layout would redirect to `/join`
- User sees confusing loop

**Recommended:** Add polling or "pending" state on `/welcome` page.

---

## PART D: DEV-ONLY PAYWALL BYPASS (To Implement)

### Design

```typescript
function isDevPaywallBypassed(): boolean {
  const bypass = process.env.DEV_PAYWALL_BYPASS === "true";

  if (!bypass) return false;

  // HARD SAFETY: Never in production
  if (process.env.NODE_ENV === "production") {
    console.warn("[PAYWALL] DEV_PAYWALL_BYPASS ignored in production");
    return false;
  }

  // HARD SAFETY: Never on production domain
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (siteUrl === "https://solarainsights.com") {
    console.warn("[PAYWALL] DEV_PAYWALL_BYPASS ignored on production domain");
    return false;
  }

  return true;
}
```

### Implementation Location

Single check in `app/(protected)/layout.tsx`, nowhere else.

---

## PART E: ISSUES SUMMARY

### CRITICAL

1. **STRIPE_PRICE_ID uses Product ID format** - Checkout will fail

### HIGH

2. **Potential race condition** - User may see redirect loop if webhook is slow

### MEDIUM

3. **No idempotency handling** - Duplicate webhooks could cause issues
4. **DEV_PAYWALL_BYPASS not implemented** - Requested feature

### LOW

5. **localhost:3000 fallbacks in code** - OK, but could log warning

---

## PART F: FIXES NEEDED

### Fix 1: Update Price IDs in .env and .env.local

**User Action Required:**
1. Go to Stripe Dashboard → Products
2. Find "Sanctuary" product → Copy price ID (starts with `price_`)
3. Find "Family" product → Copy price ID (starts with `price_`)
4. Update `.env` and `.env.local`:

```bash
STRIPE_PRICE_ID=price_XXXXX
STRIPE_FAMILY_PRICE_ID=price_XXXXX
```

### Fix 2: Implement DEV_PAYWALL_BYPASS

Will be implemented in protected layout with hard safety checks.

---

## VERIFICATION CHECKLIST

### Manual Test (Dev)

- [ ] Set `DEV_PAYWALL_BYPASS=true` in `.env.local`
- [ ] Access `/sanctuary` without payment
- [ ] See orange "DEV MODE" banner
- [ ] Confirm bypass works

### Manual Test (Payment Flow)

- [ ] Fix price IDs to use `price_*` format
- [ ] Go to `/join`
- [ ] Select "Individual" plan
- [ ] Enter email, click checkout
- [ ] Complete Stripe checkout (test card: 4242 4242 4242 4242)
- [ ] Verify redirect to `/welcome`
- [ ] Check profile in Supabase: `membership_plan`, `subscription_status` updated

### Stripe CLI Commands

```bash
# Listen to webhooks locally
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

### SQL Verification Queries

```sql
-- Check profile after payment
SELECT id, email, membership_plan, subscription_status,
       stripe_customer_id, stripe_subscription_id,
       subscription_start_date, is_onboarded
FROM profiles
WHERE email = 'test@example.com';

-- Check for users stuck in payment limbo
SELECT id, email, membership_plan, subscription_status
FROM profiles
WHERE membership_plan != 'none'
  AND subscription_status IS NULL;
```

### Expected Webhook Logs

```
[Webhook] Received event: checkout.session.completed
[Webhook] Processing checkout.session.completed
[Webhook] Updated profile for user abc123 with individual plan
[Webhook] Welcome email sent to user@example.com
```
