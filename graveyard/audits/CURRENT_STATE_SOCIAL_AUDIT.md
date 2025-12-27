# Current State: Social Sign-In/Sign-Up Audit
> Generated: 2025-12-23
> Mode: AUDIT ONLY - No code changes

---

## 1) Executive Summary

### Can Users Sign Up/Sign In with Social Media Today?

| Provider | Can Create Account? | Can Login? | Can Connect for Insights? |
|----------|---------------------|------------|---------------------------|
| **Facebook** | **YES** (Supabase-native) | **YES** (Supabase-native) | **YES** (Custom OAuth) |
| **TikTok** | **NO** | **NO** | **YES** (Custom OAuth) |
| **Instagram** | **NO** | **NO** | **NO** (disabled) |
| **X/Twitter** | **NO** | **NO** | **NO** (stub) |
| **Reddit** | **NO** | **NO** | **NO** (stub) |

### Key Finding

**Facebook is the ONLY provider that supports true signup/login today.** It uses Supabase's native OAuth which:
- Creates an `auth.users` record
- Creates an `auth.identities` record
- Mints a Supabase session cookie
- Does NOT require pre-existing session

**TikTok, X, Reddit buttons on auth pages are misleading** - they route to the custom OAuth connect flow which:
- REQUIRES an existing session
- Only stores tokens in `social_accounts` for Social Insights
- Does NOT create Supabase sessions
- Results in redirect loop if user has no session

### `social_identities` Table Status

**NOT CREATED YET** - `rg "social_identities"` returns 0 hits in code files (only in audit docs).

---

## 2) Current Onboarding State Machine

### Flow Diagram (Email User)

```
                         ┌─────────────┐
                         │   /join     │
                         │ (plan page) │
                         └──────┬──────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │ Email signup │   │  Facebook    │   │   TikTok     │
    │ → Stripe     │   │  (Supabase)  │   │ (BROKEN)     │
    └──────┬───────┘   └──────┬───────┘   └──────────────┘
           │                  │                   │
           │                  │                   ▼
           │                  │           Redirect loop
           │                  │           (no session)
           ▼                  ▼
    ┌─────────────────────────────────────────────────────┐
    │                    Stripe Checkout                   │
    │  → Success webhook creates profile w/ membership     │
    │  → subscription_status = "trialing" or "active"      │
    └───────────────────────┬─────────────────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │    /welcome     │
                   │ (identity setup)│
                   └────────┬────────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
      ┌───────────┐  ┌───────────┐  ┌───────────┐
      │ Facebook  │  │  Email    │  │  TikTok   │
      │ (Supabase)│  │ password  │  │ (BROKEN)  │
      └─────┬─────┘  └─────┬─────┘  └───────────┘
            │              │
            │              │ router.push("/onboarding")
            │              │
            ▼              ▼
     ┌──────────────────────────────────────────┐
     │             /onboarding                   │
     │  (name, birthdate, location form)         │
     │  sets: is_onboarded = true                │
     │  sets: onboarding_completed_at            │
     └──────────────────┬───────────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │     /sanctuary      │
              │  (protected area)   │
              └─────────────────────┘
```

### Flow Diagram (Facebook User)

```
                         ┌─────────────┐
                         │   /join     │
                         └──────┬──────┘
                                │
                                ▼
                   ┌─────────────────────────────┐
                   │ handleSocialSignup("facebook") │
                   │ supabase.auth.signInWithOAuth()│
                   │ redirectTo: /welcome           │
                   └─────────────┬─────────────────┘
                                 │
                                 ▼
                   ┌─────────────────────────────┐
                   │ Supabase → Facebook OAuth   │
                   │ User approves               │
                   └─────────────┬───────────────┘
                                 │
                                 ▼
                   ┌─────────────────────────────┐
                   │ Supabase callback           │
                   │ - Creates auth.users record │
                   │ - Creates auth.identities   │
                   │ - Sets session cookie       │
                   │ - Redirects to /welcome     │
                   └─────────────┬───────────────┘
                                 │
                                 ▼
     (User has session but no membership yet - /welcome checks)
                                 │
                                 ▼
     /welcome useEffect checks profile.membership_plan
     → If no membership: redirect to /join
     → User must still go through Stripe
                                 │
                                 ▼
            ┌────────────────────────────────────┐
            │ Stripe Checkout (via /join)        │
            │ sessionStorage.setItem("selectedPlan")│
            └────────────────┬───────────────────┘
                             │
                             ▼
               ... continues to /welcome → /onboarding → /sanctuary
```

### Protected Layout Gates

**File:** [app/(protected)/layout.tsx](app/(protected)/layout.tsx)

| Check | Line | Condition | Redirect |
|-------|------|-----------|----------|
| Auth | 13-21 | `supabase.auth.getUser()` → no user | `/sign-in` |
| Profile exists | 24-33 | No profile row | `/join` |
| Paid access | 38-48 | `membership_plan === "none"` OR `subscription_status` not trialing/active | `/join` |
| Onboarded | 51-61 | `is_onboarded !== true` | `/welcome` or `/onboarding` |

**Paid access condition (lines 38-43):**
```typescript
const isPaid =
  typedProfile.role === "admin" ||
  typedProfile.is_comped === true ||
  (typedProfile.membership_plan !== "none" &&
    (typedProfile.subscription_status === "trialing" ||
     typedProfile.subscription_status === "active"));
```

---

## 3) Provider Matrix: Signup / Login / Connect

### Per-Provider Capability Matrix

| Provider | Create Account | Login | Connect (Insights) | System Used |
|----------|---------------|-------|-------------------|-------------|
| **Facebook** | YES | YES | YES | Supabase-native OAuth |
| **TikTok** | NO | NO | YES | Solara custom OAuth |
| **Instagram** | NO | NO | NO | Disabled (`enabled: false`) |
| **X/Twitter** | NO | NO | NO | Stub (error toast) |
| **Reddit** | NO | NO | NO | Stub (error toast) |

### Evidence by Provider

#### Facebook

**Signup:** `supabase.auth.signInWithOAuth({ provider: "facebook" })`
- [join/page.tsx:82](app/(auth)/join/page.tsx#L82)
- [sign-up/page.tsx:68](app/(auth)/sign-up/page.tsx#L68)

**Login:** `supabase.auth.signInWithOAuth({ provider: "facebook" })`
- [sign-in/page.tsx:77](app/(auth)/sign-in/page.tsx#L77)

**Connect:** Custom OAuth + Supabase OAuth both available
- [settings/page.tsx:156](app/(protected)/settings/page.tsx#L156) - Custom OAuth
- [welcome/page.tsx:52](app/(auth)/welcome/page.tsx#L52) - Supabase OAuth

#### TikTok

**Signup:** NO - routes to custom OAuth which requires session
- [join/page.tsx:232](app/(auth)/join/page.tsx#L232): `window.location.href = "/api/social/oauth/tiktok/connect?return_to=/join"`
- Connect route requires `supabase.auth.getUser()` at [connect/route.ts:74-78](app/api/social/oauth/[provider]/connect/route.ts#L74)

**Login:** NO - same issue
- [sign-in/page.tsx:123](app/(auth)/sign-in/page.tsx#L123): `window.location.href = "/api/social/oauth/tiktok/connect?return_to=/sign-in"`

**Connect:** YES (when user has session)
- [settings/page.tsx:156](app/(protected)/settings/page.tsx#L156)
- [SocialConnectModal.tsx:78](components/sanctuary/SocialConnectModal.tsx#L78)

#### Instagram

**All:** NO - Disabled in config
- [settings/page.tsx:29](app/(protected)/settings/page.tsx#L29): `{ id: "instagram", ..., enabled: false }`

#### X/Twitter

**All:** NO - Stub with error toast
- [sign-in/page.tsx:134](app/(auth)/sign-in/page.tsx#L134): `setError("X sign-in coming soon")`
- [join/page.tsx:243](app/(auth)/join/page.tsx#L243): `setError("X sign-up coming soon")`
- [settings/page.tsx:31](app/(protected)/settings/page.tsx#L31): `{ id: "x", ..., enabled: false }`

#### Reddit

**All:** NO - Stub with error toast
- [sign-in/page.tsx:144](app/(auth)/sign-in/page.tsx#L144): `setError("Reddit sign-in coming soon")`
- [join/page.tsx:253](app/(auth)/join/page.tsx#L253): `setError("Reddit sign-up coming soon")`
- [settings/page.tsx:32](app/(protected)/settings/page.tsx#L32): `{ id: "reddit", ..., enabled: false }`

---

## 4) UI Entry Points Inventory

### All Social Buttons by Page

| Page | Provider | Handler Location | Target URL/Action | Requires Session? | Success Destination |
|------|----------|-----------------|-------------------|-------------------|---------------------|
| `/sign-in` | Facebook | line 75-88 | `supabase.auth.signInWithOAuth()` | NO | returnUrl (default `/sanctuary`) |
| `/sign-in` | TikTok | line 122-124 | `/api/social/oauth/tiktok/connect?return_to=/sign-in` | **YES** (BROKEN) | `/sign-in` (loops) |
| `/sign-in` | X | line 134 | `setError("X sign-in coming soon")` | N/A | N/A |
| `/sign-in` | Reddit | line 144 | `setError("Reddit sign-in coming soon")` | N/A | N/A |
| `/sign-up` | Facebook | line 66-78 | `supabase.auth.signInWithOAuth()` | NO | `/join` |
| `/join` | Facebook | line 73-93 | `supabase.auth.signInWithOAuth()` | NO | `/welcome` |
| `/join` | TikTok | line 231-233 | `/api/social/oauth/tiktok/connect?return_to=/join` | **YES** (BROKEN) | `/join` (loops) |
| `/join` | X | line 243 | `setError("X sign-up coming soon")` | N/A | N/A |
| `/join` | Reddit | line 253 | `setError("Reddit sign-up coming soon")` | N/A | N/A |
| `/welcome` | Facebook | line 42-63 | `supabase.auth.signInWithOAuth()` | NO | `/onboarding` |
| `/welcome` | TikTok | line 149-151 | `/api/social/oauth/tiktok/connect?return_to=/welcome` | **YES** (BROKEN) | `/welcome` (loops) |
| `/welcome` | X | line 160 | `setError("X coming soon")` | N/A | N/A |
| `/welcome` | Reddit | line 169 | `setError("Reddit coming soon")` | N/A | N/A |
| `/settings` | All enabled | line 155-157 | `/api/social/oauth/${provider}/connect?return_to=/settings` | YES | `/settings?social=connected&provider=X` |
| Sanctuary modal | All configured | line 76-79 | `/api/social/oauth/${provider}/connect?return_to=/sanctuary` | YES | `/sanctuary?social=connected&provider=X` |

### return_to Parameter Usage

| Route | Has return_to? | Validation |
|-------|---------------|------------|
| `/api/social/oauth/[provider]/connect` | YES | Stored in cookie |
| `/api/social/oauth/[provider]/callback` | YES (from cookie) | `isValidReturnTo()` at lines 28-42 |
| Supabase OAuth | Uses `redirectTo` option | Supabase handles |

---

## 5) Backend Route Map

### Custom OAuth Routes (Solara)

| Route | Method | File | Session Required? | Creates Session? | Writes To |
|-------|--------|------|-------------------|------------------|-----------|
| `/api/social/oauth/[provider]/connect` | GET | [connect/route.ts](app/api/social/oauth/[provider]/connect/route.ts) | **YES** (line 74-78) | NO | Cookie (state) |
| `/api/social/oauth/[provider]/callback` | GET | [callback/route.ts](app/api/social/oauth/[provider]/callback/route.ts) | NO (validates from cookie) | NO | `social_accounts` |

### Social Sync Routes

| Route | Method | File | Auth | Purpose |
|-------|--------|------|------|---------|
| `/api/social/sync` | POST | [sync/route.ts](app/api/social/sync/route.ts) | Bearer token | Sync single user/provider |
| `/api/social/sync-user` | POST | [sync-user/route.ts](app/api/social/sync-user/route.ts) | Session OR Bearer | User-initiated sync |
| `/api/cron/social-sync` | GET | [social-sync/route.ts](app/api/cron/social-sync/route.ts) | Bearer token | Batch sync all users |

### Auth Routes (True Login)

| Route | Method | File | Purpose |
|-------|--------|------|---------|
| `/auth/callback` | GET | [callback/route.ts](app/auth/callback/route.ts) | Supabase OAuth callback (code → session) |
| `/api/auth/reset-password` | POST | [reset-password/route.ts](app/api/auth/reset-password/route.ts) | Password reset email |

### What Does `/api/social/oauth/[provider]/callback` Do?

**File:** [app/api/social/oauth/[provider]/callback/route.ts](app/api/social/oauth/[provider]/callback/route.ts)

1. **Validates state** from cookie (lines 170-212)
2. **Retrieves PKCE verifier** (line 225)
3. **Exchanges code for tokens** (line 246)
4. **Encrypts tokens** (lines 263-266)
5. **Upserts to `social_accounts`** (lines 280-294)
6. **Sets `social_insights_enabled = true`** on profile (lines 309-324)
7. **Triggers sync** (fire-and-forget) (lines 327-340)
8. **Redirects** with `?social=connected&provider=X` (line 347)

**Does NOT:**
- Mint a Supabase session
- Write to `auth.identities`
- Write to `social_identities` (table doesn't exist)

---

## 6) Database Tables Usage

### Table Usage Matrix

| Table | Purpose | Read By | Write By |
|-------|---------|---------|----------|
| `auth.users` | Supabase user records | Supabase SDK | Supabase SDK (OAuth, signup) |
| `auth.identities` | Supabase OAuth identities | Not directly referenced in code | Supabase SDK (Facebook OAuth) |
| `public.profiles` | Solara user profiles | Many files | Many files |
| `public.social_accounts` | OAuth tokens (encrypted) | 7 files (see below) | callback/route.ts |
| `public.social_summaries` | AI summaries | 8 files (see below) | sync routes |
| `public.social_identities` | **DOES NOT EXIST** | N/A | N/A |

### `social_accounts` Usage (7 files)

```
app/api/social/oauth/[provider]/callback/route.ts  - upsert tokens
app/api/social/revoke/route.ts                      - delete on disconnect
app/api/insights/route.ts                           - read for personalization
app/api/social/status/route.ts                      - read for UI status
app/api/social/sync/route.ts                        - read tokens for API calls
app/api/cron/social-sync/route.ts                   - batch read tokens
app/api/social/sync-user/route.ts                   - read tokens for sync
```

### `social_summaries` Usage (8 files)

```
app/api/social/revoke/route.ts                      - delete on disconnect
app/api/insights/route.ts                           - read for personalization
app/api/social/status/route.ts                      - check hasSummary
app/api/social/sync/route.ts                        - upsert summaries
app/api/cron/prewarm-insights/route.ts              - read for prewarm
app/api/cron/social-sync/route.ts                   - batch upsert
app/api/connection-space-between/route.ts           - read for connections
app/api/connection-brief/route.ts                   - read for connections
```

### Repo-Wide Search Results

```bash
rg "social_identities"      → 0 hits in code (only in audit docs)
rg "auth\.identities"       → 0 hits in code (only in audit docs)
rg "signInWithOAuth"        → 4 hits in auth pages (all Facebook)
rg "/api/social/oauth"      → Multiple hits (connect/callback routes)
rg "/api/auth/social"       → 0 hits (does not exist)
```

---

## 7) Gaps List: What's Missing for True Social Signup

### Gap 1: TikTok/X/Reddit Cannot Create Accounts

**Current state:** Buttons exist but route to connect flow that requires session
**Missing:**
- Login initiation route that doesn't require session
- Identity mapping table (`social_identities`)
- Session minting after custom OAuth
- Account creation from external_user_id

### Gap 2: No `social_identities` Table

**Current state:** Table proposed in audits but not created
**Missing:**
- SQL migration to create table
- Code to insert/lookup identities
- Separation of "login identity" from "API access tokens"

### Gap 3: Custom OAuth Cannot Mint Sessions

**Current state:** Callback only writes to `social_accounts`
**Missing:**
- Supabase Admin API usage to generate magic links
- Or: Custom session minting logic
- User creation from external_user_id + synthetic email

### Gap 4: No Unified Login/Connect Mode Detection

**Current state:** Only connect mode exists
**Missing:**
- Mode parameter in state cookie (`mode: "login"` vs `mode: "connect"`)
- Conditional logic in callback based on mode
- Separate entry points for login vs connect

### Gap 5: Paywall Enforcement for Social Signup

**Current state:** Facebook OAuth goes directly to `/welcome` which checks membership
**Consideration:** True social login must still enforce paywall
**Approach:** After social signup, redirect to `/join` for Stripe checkout before granting Sanctuary access

---

## 8) Minimal PR Plan (Audit Only - No Implementation)

### PR 1: Create `social_identities` Table

**Goal:** Establish identity mapping table
**Files:**
- NEW: `sql/016_social_identities.sql`

**Schema:**
```sql
CREATE TABLE public.social_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_identities_provider_external_unique UNIQUE (provider, external_user_id),
  CONSTRAINT social_identities_user_provider_unique UNIQUE (user_id, provider)
);
```

---

### PR 2: Create Login Routes (No Session Required)

**Goal:** Separate login flow from connect flow
**Files:**
- NEW: `app/api/auth/social/[provider]/login/route.ts`
- MODIFY: `app/api/social/oauth/[provider]/callback/route.ts` (add mode handling)
- NEW: `lib/auth/social.ts` (user creation, session minting utilities)

**Key changes:**
- Login route stores `mode: "login"` in state cookie (no userId)
- Callback detects mode and branches:
  - `mode: "connect"` → existing flow
  - `mode: "login"` → lookup/create user, mint session

---

### PR 3: Wire UI to Login Routes

**Goal:** Update auth page buttons to use login flow
**Files:**
- MODIFY: `app/(auth)/sign-in/page.tsx`
- MODIFY: `app/(auth)/join/page.tsx`
- MODIFY: `app/(auth)/welcome/page.tsx`

**Key changes:**
- TikTok/X/Reddit buttons → `/api/auth/social/[provider]/login`
- Keep Facebook as Supabase-native OR migrate to unified system
- Ensure paywall is respected (new users → `/join` for Stripe)

---

### PR 4: (Optional) Migrate Facebook to Unified System

**Goal:** Consistency - all providers use Solara custom OAuth
**Files:**
- MODIFY: Auth pages to use `/api/auth/social/facebook/login`
- Potentially phase out Supabase-native Facebook OAuth

**Consideration:** Facebook via Supabase already works. Migration adds risk for consistency.

---

## Verification Checklist (Post-Implementation)

- [ ] `npm run build` passes
- [ ] New user can click "Sign in with TikTok" on `/sign-in`
- [ ] New TikTok user → creates account → goes to `/join` (Stripe) → `/welcome` → `/onboarding` → `/sanctuary`
- [ ] Existing TikTok user → logs in → goes to `/sanctuary`
- [ ] TikTok user cannot access `/sanctuary` without paying (paywall respected)
- [ ] "Connect" in Settings still works (existing behavior)
- [ ] "Disconnect" does NOT break login (separate tables)
- [ ] `social_identities` populated for social logins
- [ ] `social_accounts` populated for connects
- [ ] Facebook signup/login still works

---

## Summary

### Current Reality

| Feature | Facebook | TikTok | Instagram | X | Reddit |
|---------|----------|--------|-----------|---|--------|
| True Signup | YES | NO | NO | NO | NO |
| True Login | YES | NO | NO | NO | NO |
| Connect (w/ session) | YES | YES | NO | NO | NO |
| Button exists on auth pages | YES | YES (broken) | NO | YES (stub) | YES (stub) |

### Cleanest Path to Social Signup

1. **Keep paywall**: Social signup users must still go through Stripe
2. **Create `social_identities`**: Separate login identity from API tokens
3. **Create login routes**: `/api/auth/social/[provider]/login` without session requirement
4. **Mint sessions via Admin API**: Use `generateLink` after custom OAuth
5. **Redirect new users to `/join`**: Enforce payment before Sanctuary access

### Files That Would Change

| File | Change Type | Purpose |
|------|-------------|---------|
| `sql/016_social_identities.sql` | NEW | Create identity table |
| `app/api/auth/social/[provider]/login/route.ts` | NEW | Login initiation |
| `app/api/social/oauth/[provider]/callback/route.ts` | MODIFY | Add mode handling |
| `lib/auth/social.ts` | NEW | Session minting utilities |
| `app/(auth)/sign-in/page.tsx` | MODIFY | Update TikTok/X/Reddit buttons |
| `app/(auth)/join/page.tsx` | MODIFY | Update TikTok/X/Reddit buttons |
| `app/(auth)/welcome/page.tsx` | MODIFY | Update TikTok/X/Reddit buttons |
