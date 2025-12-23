# ONBOARDING FORENSIC AUDIT

> **Generated:** 2025-12-23
> **Purpose:** Complete forensic documentation of Solara's onboarding state machine, all routes, redirects, DB writes, and failure modes.

---

## 1. STATE MACHINE DIAGRAM (ASCII)

```
                                    ┌─────────────────────────────────────────────────────┐
                                    │                   ENTRY POINTS                       │
                                    └─────────────────────────────────────────────────────┘
                                                           │
                    ┌──────────────────────────────────────┼──────────────────────────────────────┐
                    │                                      │                                      │
                    ▼                                      ▼                                      ▼
            ┌──────────────┐                      ┌──────────────┐                      ┌──────────────┐
            │   /sign-in   │                      │    /join     │                      │  Direct URL  │
            │  (returning) │                      │  (new user)  │                      │  /sanctuary  │
            └──────┬───────┘                      └──────┬───────┘                      └──────┬───────┘
                   │                                     │                                     │
                   │ auth success                        │                                     │
                   ▼                                     │                                     │
           ┌───────────────┐                             │                                     │
           │  Check Profile │                            │                                     │
           │   in layout    │                            │                                     │
           └───────┬───────┘                             │                                     │
                   │                                     │                                     │
    ┌──────────────┴──────────────┐                      │                                     │
    │                             │                      │                                     │
    ▼                             ▼                      │                                     │
isPaid=false               isPaid=true                   │                                     │
    │                             │                      │                                     │
    │                             ▼                      │                                     │
    │                    is_onboarded?                   │                                     │
    │                    ┌─────┴─────┐                   │                                     │
    │                    │           │                   │                                     │
    │                    ▼           ▼                   │                                     │
    │              false=NO     true=YES                 │                                     │
    │                    │           │                   │                                     │
    │                    │           ▼                   │                                     │
    │                    │    ┌────────────┐             │                                     │
    │                    │    │ /sanctuary │◄────────────┼─────────────────────────────────────┘
    │                    │    │  (ACCESS)  │             │               (gate blocks)
    │                    │    └────────────┘             │
    │                    │                               │
    │                    ▼                               │
    │         onboarding_started_at?                     │
    │              ┌─────┴─────┐                         │
    │              │           │                         │
    │              ▼           ▼                         │
    │           NULL       timestamp                     │
    │              │           │                         │
    │              ▼           ▼                         │
    │       ┌──────────┐ ┌────────────┐                  │
    │       │ /welcome │ │ /onboarding│                  │
    │       └────┬─────┘ └─────┬──────┘                  │
    │            │             │                         │
    │            │ set passwd  │ complete form           │
    │            │ + go to     │ is_onboarded=true       │
    │            ▼             │                         │
    │     ┌────────────┐       │                         │
    │     │ /onboarding│◄──────┘                         │
    │     └─────┬──────┘                                 │
    │           │                                        │
    │           │ saveProfile(is_onboarded=true)         │
    │           ▼                                        │
    │    ┌────────────┐                                  │
    │    │ /sanctuary │                                  │
    │    └────────────┘                                  │
    │                                                    │
    └────────────────────────────────────────────────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │    /join     │
                    │  (redirect)  │
                    └──────┬───────┘
                           │
                           ▼
            ┌──────────────────────────────┐
            │      Select Plan             │
            │  (individual / family)       │
            └──────────────┬───────────────┘
                           │
            ┌──────────────┴───────────────┐
            │                              │
            ▼                              ▼
     Social OAuth                     Email Signup
     (Facebook)                       (enter email)
            │                              │
            │                              ▼
            │                    ┌─────────────────────┐
            │                    │ POST /api/stripe/   │
            │                    │     checkout        │
            │                    └──────────┬──────────┘
            │                               │
            │                               ▼
            │                    ┌─────────────────────┐
            │                    │   Stripe Checkout   │
            │                    │   (external page)   │
            │                    └──────────┬──────────┘
            │                               │
            │                               │ payment success
            │                               ▼
            │                    ┌─────────────────────┐
            │                    │ Stripe Webhook      │
            │                    │ checkout.session.   │
            │                    │ completed           │
            │                    └──────────┬──────────┘
            │                               │
            │                               │ creates/updates profile
            │                               │ membership_plan, subscription_status
            │                               ▼
            └──────────────────────────────►┌──────────────┐
                                            │   /welcome   │
                                            │ ?status=     │
                                            │   success    │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                         ┌─────────────────────┐
                                         │  Choose sign-in     │
                                         │  method:            │
                                         │  - Social (FB)      │
                                         │  - Email + Password │
                                         └──────────┬──────────┘
                                                    │
                                                    ▼
                                            ┌────────────┐
                                            │ /onboarding│
                                            └─────┬──────┘
                                                  │
                                                  │ fill profile
                                                  │ is_onboarded=true
                                                  ▼
                                            ┌────────────┐
                                            │ /sanctuary │
                                            └────────────┘
```

---

## 2. PROFILE STATE FIELDS (Critical for Gating)

| Field | Type | Default | Set By | Used For |
|-------|------|---------|--------|----------|
| `membership_plan` | `"none" \| "individual" \| "family"` | `"none"` | Stripe webhook | Payment gate |
| `subscription_status` | `"trialing" \| "active" \| "canceled" \| "past_due" \| null` | `null` | Stripe webhook | Payment gate |
| `is_onboarded` | `boolean` | `false` | `/api/user/profile` PATCH | Onboarding gate |
| `onboarding_started_at` | `timestamp \| null` | `null` | `/onboarding` page load | Welcome vs Onboarding redirect |
| `onboarding_completed_at` | `timestamp \| null` | `null` | `/api/user/profile` PATCH | Audit trail |
| `is_comped` | `boolean` | `false` | Manual/Admin | Bypass payment gate |
| `role` | `"user" \| "admin"` | `"user"` | Manual/Admin | Bypass payment gate |

### Payment Gate Logic (Protected Layout)

```typescript
// app/(protected)/layout.tsx:38-43
const isPaid =
  typedProfile.role === "admin" ||
  typedProfile.is_comped === true ||
  (typedProfile.membership_plan !== "none" &&
    (typedProfile.subscription_status === "trialing" ||
     typedProfile.subscription_status === "active"));
```

### Onboarding Gate Logic (Protected Layout)

```typescript
// app/(protected)/layout.tsx:51-60
const isReady = typedProfile.is_onboarded === true;

if (!isReady) {
  if (typedProfile.onboarding_started_at) {
    redirect("/onboarding");
  } else {
    redirect("/welcome");
  }
}
```

---

## 3. ROUTE-BY-ROUTE TRACE

### 3.1 `/join` (New User Entry)

**File:** [app/(auth)/join/page.tsx](app/(auth)/join/page.tsx)

| Line | Action | Details |
|------|--------|---------|
| 26-37 | Check existing membership | Redirect to `/sanctuary` if already paid |
| 45-71 | `handleCheckout()` | POST to `/api/stripe/checkout` with plan + email |
| 73-93 | `handleSocialSignup()` | Store plan in sessionStorage, OAuth to Facebook → redirect to `/welcome` |
| 95-103 | `handleEmailSignup()` | Validate name/email, then call `handleCheckout()` |

**Redirects:**
- Already paid → `/sanctuary`
- Stripe checkout success → `/welcome?status=success&session_id={ID}`
- Social OAuth success → `/welcome`

---

### 3.2 `/welcome` (Post-Payment Setup)

**File:** [app/(auth)/welcome/page.tsx](app/(auth)/welcome/page.tsx)

| Line | Action | Details |
|------|--------|---------|
| 29-40 | Check membership | Redirect to `/join` if no active membership |
| 42-63 | `handleSocialConnect()` | OAuth to Facebook → redirect to `/onboarding` |
| 65-101 | `handleEmailSetup()` | Set password via `supabase.auth.updateUser()` → redirect to `/onboarding` |

**Redirects:**
- No active membership → `/join`
- Social connect → `/onboarding`
- Email password set → `/onboarding`

---

### 3.3 `/onboarding` (Profile Completion)

**File:** [app/(auth)/onboarding/page.tsx](app/(auth)/onboarding/page.tsx)

| Line | Action | Details |
|------|--------|---------|
| 32-64 | Initialize form | Load existing profile data, set `onboarding_started_at` if null |
| 67-84 | Check membership | Redirect to `/join` if no membership, `/sanctuary` if already onboarded |
| 86-136 | `handleSubmit()` | Validate name/date/place, call `saveProfile()` with `is_onboarded: true` |

**DB Writes:**
- Line 61: `saveProfile({ onboarding_started_at: new Date().toISOString() })` (if null)
- Line 110-126: `saveProfile({ first_name, last_name, birth_date, birth_*, is_onboarded: true, onboarding_completed_at })`

**Redirects:**
- No active membership → `/join`
- Already onboarded → `/sanctuary`
- Form submission success → `/sanctuary`

---

### 3.4 `/sign-in` (Returning User)

**File:** [app/(auth)/sign-in/page.tsx](app/(auth)/sign-in/page.tsx)

| Line | Action | Details |
|------|--------|---------|
| 16-25 | `isValidReturnUrl()` | Validate returnUrl for open redirect protection |
| 39-73 | `handleSubmit()` | `supabase.auth.signInWithPassword()` → redirect to returnUrl or `/sanctuary` |
| 75-88 | `handleFacebookSignIn()` | OAuth with returnUrl in redirect |

**Redirects:**
- Sign-in success → returnUrl (validated) or `/sanctuary`
- Note: Protected layout will gate `/sanctuary` access and redirect appropriately

---

### 3.5 `/sanctuary` (Protected - Final Destination)

**File:** [app/(protected)/layout.tsx](app/(protected)/layout.tsx)

| Line | Action | Details |
|------|--------|---------|
| 13-21 | Auth check | Redirect to `/sign-in` if no session |
| 24-33 | Profile fetch | Redirect to `/join` if no profile |
| 38-48 | Payment check | Redirect to `/join` if not paid |
| 51-61 | Onboarding check | Redirect to `/welcome` or `/onboarding` if not complete |
| 64-72 | Render content | User is authenticated, paid, and onboarded |

---

## 4. API ROUTE TRACE

### 4.1 `POST /api/stripe/checkout`

**File:** [app/api/stripe/checkout/route.ts](app/api/stripe/checkout/route.ts)

| Line | Action | Details |
|------|--------|---------|
| 11-16 | Validate plan | Must be "individual" or "family" |
| 19-29 | Get email | From request body or authenticated user |
| 50-70 | Create session | Stripe checkout with 7-day trial |
| 68 | Success URL | `{appUrl}/welcome?status=success&session_id={CHECKOUT_SESSION_ID}` |

---

### 4.2 `POST /api/stripe/webhook`

**File:** [app/api/stripe/webhook/route.ts](app/api/stripe/webhook/route.ts)

| Line | Action | Details |
|------|--------|---------|
| 52-54 | Handle `checkout.session.completed` | Main payment success handler |
| 82-174 | `handleCheckoutCompleted()` | Create/update profile with membership |

**DB Writes in `handleCheckoutCompleted()`:**
- Line 149-158: Update profile with `membership_plan`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_start_date`

---

### 4.3 `PATCH /api/user/profile`

**File:** [app/api/user/profile/route.ts](app/api/user/profile/route.ts)

| Line | Action | Details |
|------|--------|---------|
| 32-48 | Onboarding validation | Require first_name + last_name if `is_onboarded: true` |
| 79-84 | Zodiac calculation | Auto-set `zodiac_sign` from `birth_date` |
| 87-200 | Birthplace validation | Require lat/lon from PlacePicker, compute timezone server-side |
| 203-213 | Update profile | Write to `profiles` table |
| 219-241 | Birth chart compute | Recompute and store birth chart if complete data |

---

## 5. DB WRITE LOG

| When | Table | Fields Written | Triggered By |
|------|-------|----------------|--------------|
| First page load with session | `profiles` | All defaults (see SettingsProvider:59-98) | SettingsProvider:100-108 |
| Stripe checkout complete | `profiles` | `membership_plan`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_start_date` | Webhook:149-158 |
| Stripe subscription update | `profiles` | `subscription_status`, `subscription_end_date` | Webhook:208-217 |
| Stripe subscription deleted | `profiles` | `subscription_status: "canceled"`, `subscription_end_date` | Webhook:238-244 |
| Onboarding page load (first) | `profiles` | `onboarding_started_at` | onboarding/page.tsx:61 |
| Onboarding form submit | `profiles` | `first_name`, `middle_name`, `last_name`, `preferred_name`, `birth_date`, `birth_time`, `birth_city`, `birth_region`, `birth_country`, `birth_lat`, `birth_lon`, `timezone`, `is_onboarded: true`, `onboarding_completed_at` | onboarding/page.tsx:110-126 |
| Profile update (general) | `profiles` | Any profile fields | /api/user/profile PATCH |
| Birth chart compute | `birth_charts` | Full chart data | /api/user/profile:228-234 |

---

## 6. FAILURE MODES & EDGE CASES

| Scenario | What Happens | Recovery Path |
|----------|--------------|---------------|
| **Stripe webhook fails** | Profile not updated with membership | User lands on `/welcome` but gate sees `membership_plan: "none"` → redirect to `/join`. User must contact support or retry payment. |
| **User closes browser during onboarding** | `onboarding_started_at` set but `is_onboarded: false` | Next visit: protected layout redirects to `/onboarding` (not `/welcome`) |
| **Profile creation fails in SettingsProvider** | Error state set, no profile | User sees error, must refresh. If Supabase down, all functionality blocked. |
| **PlacePicker geocode fails** | Cannot submit onboarding form | User must select different location or try again |
| **User signs in with different OAuth** | New auth identity, may not match profile | Depends on Supabase identity linking. Could create orphan profile. |
| **Subscription expires while user active** | `subscription_status` updated to `canceled` | Next page load: protected layout redirects to `/join` |
| **Admin/comped user flag removed** | `is_comped: false` or `role: "user"` | Next page load: payment gate applies normally |
| **User deletes account manually** | Profile row deleted | Next session: SettingsProvider creates new profile with defaults |
| **OAuth redirect URL mismatch** | OAuth fails with "redirect_uri mismatch" | User sees error on OAuth page, cannot complete auth |
| **Session expires during onboarding** | 401 on profile save | User must sign in again, form data lost |

---

## 7. MANUAL TEST CHECKLIST

### New User Flow (Email + Stripe)
- [ ] Visit `/join`
- [ ] Select "Individual" plan
- [ ] Enter name and email
- [ ] Click "Continue to payment"
- [ ] Complete Stripe checkout (use test card `4242 4242 4242 4242`)
- [ ] Verify redirect to `/welcome?status=success`
- [ ] Choose "Set email + password"
- [ ] Set password and confirm
- [ ] Verify redirect to `/onboarding`
- [ ] Complete profile form (name, birth date, birth place via PlacePicker)
- [ ] Click "Complete setup"
- [ ] Verify redirect to `/sanctuary`
- [ ] Verify profile shows `is_onboarded: true` in DB

### New User Flow (Facebook OAuth)
- [ ] Visit `/join`
- [ ] Click Facebook button
- [ ] Complete Facebook OAuth
- [ ] Verify redirect to `/welcome`
- [ ] Click Facebook button to connect
- [ ] Verify redirect to `/onboarding`
- [ ] Complete profile form
- [ ] Verify redirect to `/sanctuary`

### Returning User Flow (Paid + Onboarded)
- [ ] Sign in at `/sign-in`
- [ ] Verify redirect to `/sanctuary` (no gates)

### Returning User Flow (Paid + Not Onboarded)
- [ ] Create user with `membership_plan: "individual"`, `subscription_status: "trialing"`, `is_onboarded: false`
- [ ] Visit `/sanctuary`
- [ ] Verify redirect to `/welcome` (if `onboarding_started_at` is null)
- [ ] OR redirect to `/onboarding` (if `onboarding_started_at` is set)

### Returning User Flow (Not Paid)
- [ ] Create user with `membership_plan: "none"`
- [ ] Visit `/sanctuary`
- [ ] Verify redirect to `/join`

### Admin/Comped Bypass
- [ ] Set `role: "admin"` or `is_comped: true` on profile
- [ ] Verify access to `/sanctuary` even without payment

### Subscription Lifecycle
- [ ] Complete payment (trialing)
- [ ] Trigger `customer.subscription.updated` webhook with `status: "active"`
- [ ] Verify profile `subscription_status` updated
- [ ] Trigger `customer.subscription.deleted` webhook
- [ ] Verify profile `subscription_status: "canceled"`
- [ ] Verify redirect to `/join` on next `/sanctuary` visit

---

## 8. ENVIRONMENT VARIABLE DEPENDENCIES

| Variable | Required For | Default |
|----------|--------------|---------|
| `NEXT_PUBLIC_SITE_URL` | OAuth callback construction | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Auth redirects, Stripe URLs | `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | Stripe API calls | - |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | - |
| `STRIPE_PRICE_ID` | Individual plan checkout | - |
| `STRIPE_FAMILY_PRICE_ID` | Family plan checkout | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin operations in webhook | - |

---

## 9. ARCHITECTURE NOTES

### Why Two Post-Payment Pages?

1. **`/welcome`** - Identity selection (Facebook vs Email+Password)
   - Exists because Stripe checkout doesn't require authentication
   - User may have paid with just an email (no Supabase session yet)
   - Webhook creates user with random password
   - `/welcome` lets user set real password or link Facebook

2. **`/onboarding`** - Profile completion
   - Collects birth data for astrology features
   - Sets `is_onboarded: true` to unlock sanctuary

### Why `onboarding_started_at`?

Distinguishes between:
- User just paid → show `/welcome` first
- User started onboarding but didn't finish → skip welcome, go to `/onboarding`

### Server vs Client Gates

- **Server gate:** `app/(protected)/layout.tsx` - runs on every page load, cannot be bypassed
- **Client checks:** Individual pages check profile for UX (show loading, redirect)
- **Double-checking:** Some pages check membership client-side too for smoother UX

---

## 10. QUICK REFERENCE: HAPPY PATH

```
1. /join → select plan → enter email
2. POST /api/stripe/checkout → Stripe page
3. Payment success → webhook updates profile
4. Redirect to /welcome?status=success
5. /welcome → set password (or Facebook)
6. Redirect to /onboarding
7. /onboarding → fill form → saveProfile(is_onboarded: true)
8. Redirect to /sanctuary
9. Protected layout gate passes → ACCESS GRANTED
```
