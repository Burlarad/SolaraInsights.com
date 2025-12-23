# Social Sign-In Buttons Audit
> Generated: 2025-12-23
> Mode: AUDIT ONLY - No code changes

---

## 1) Executive Summary

### Current State

The Solara codebase has **two completely separate OAuth systems** running in parallel:

| System | Purpose | Creates Supabase Session? | Writes to |
|--------|---------|---------------------------|-----------|
| **Supabase-native OAuth** | True social login (Facebook only) | YES | `auth.users`, `auth.identities` |
| **Solara custom OAuth** | Social Insights connect | NO | `public.social_accounts` |

### Key Finding

**Facebook is the only provider that can do TRUE login** today via `supabase.auth.signInWithOAuth()`. TikTok, X, and Reddit use Solara's custom OAuth flow which:
- Requires an **existing authenticated session**
- Stores tokens in `social_accounts` for Social Insights
- Does NOT create/link a Supabase identity
- Cannot be used for sign-in without an existing account

### The Problem

When a user clicks "Sign in with TikTok" on `/sign-in`:
1. They are redirected to `/api/social/oauth/tiktok/connect`
2. The connect route checks for a session via `supabase.auth.getUser()`
3. **No session exists** → redirects to `/sign-in?returnUrl=...`
4. User is stuck in a loop - they can't "sign in with TikTok" without already being signed in!

---

## 2) UI Click-Path Table

### /sign-in ([sign-in/page.tsx](app/(auth)/sign-in/page.tsx))

| Provider | Enabled? | Handler (Lines) | Target URL / Action | Creates Session? |
|----------|----------|-----------------|---------------------|------------------|
| **Facebook** | YES | `handleFacebookSignIn()` (75-88) | `supabase.auth.signInWithOAuth({ provider: "facebook" })` | **YES** |
| **TikTok** | YES | inline onClick (122-124) | `window.location.href = "/api/social/oauth/tiktok/connect?return_to=/sign-in"` | NO - requires session |
| **X** | STUB | inline onClick (134) | `setError("X sign-in coming soon")` | N/A |
| **Reddit** | STUB | inline onClick (144) | `setError("Reddit sign-in coming soon")` | N/A |

### /join ([join/page.tsx](app/(auth)/join/page.tsx))

| Provider | Enabled? | Handler (Lines) | Target URL / Action | Creates Session? |
|----------|----------|-----------------|---------------------|------------------|
| **Facebook** | YES | `handleSocialSignup()` (73-93) | `supabase.auth.signInWithOAuth({ provider: "facebook" })` → `/welcome` | **YES** |
| **TikTok** | YES | inline onClick (231-233) | `window.location.href = "/api/social/oauth/tiktok/connect?return_to=/join"` | NO - requires session |
| **X** | STUB | inline onClick (243) | `setError("X sign-up coming soon")` | N/A |
| **Reddit** | STUB | inline onClick (253) | `setError("Reddit sign-up coming soon")` | N/A |

### /welcome ([welcome/page.tsx](app/(auth)/welcome/page.tsx))

| Provider | Enabled? | Handler (Lines) | Target URL / Action | Creates Session? |
|----------|----------|-----------------|---------------------|------------------|
| **Facebook** | YES | `handleSocialConnect()` (42-63) | `supabase.auth.signInWithOAuth({ provider: "facebook" })` → `/onboarding` | **YES** (link identity) |
| **TikTok** | YES | inline onClick (149-151) | `window.location.href = "/api/social/oauth/tiktok/connect?return_to=/welcome"` | NO - requires session |
| **X** | STUB | inline onClick (160) | `setError("X coming soon")` | N/A |
| **Reddit** | STUB | inline onClick (169) | `setError("Reddit coming soon")` | N/A |

### /settings ([settings/page.tsx](app/(protected)/settings/page.tsx))

| Provider | Enabled? | Handler (Lines) | Target URL / Action | Notes |
|----------|----------|-----------------|---------------------|-------|
| **Facebook** | YES | `handleSocialConnect()` (155-157) | `window.location.href = /api/social/oauth/facebook/connect?return_to=/settings` | Connect for insights (has session) |
| **TikTok** | YES | Same handler | Same pattern | Connect for insights |
| **Instagram** | DISABLED | N/A | Shows "Coming soon" | `enabled: false` in config (line 29) |
| **X** | DISABLED | N/A | Shows "Coming soon" | `enabled: false` in config (line 31) |
| **Reddit** | DISABLED | N/A | Shows "Coming soon" | `enabled: false` in config (line 32) |

### Sanctuary Modal ([SocialConnectModal.tsx](components/sanctuary/SocialConnectModal.tsx))

| Provider | Enabled? | Handler (Lines) | Target URL / Action | Notes |
|----------|----------|-----------------|---------------------|-------|
| All configured | Dynamic | `handleConnect()` (76-79) | `window.location.href = /api/social/oauth/${provider}/connect?return_to=/sanctuary` | Only shows `isConfigured` providers |

---

## 3) Backend Flow Diagrams

### A) Facebook - TRUE LOGIN (Supabase-native)

```
User clicks "F" on /sign-in
         │
         ▼
supabase.auth.signInWithOAuth({ provider: "facebook" })
         │
         ▼
Supabase redirects to Facebook OAuth
         │
         ▼
User approves on Facebook
         │
         ▼
Facebook redirects to Supabase callback (/auth/v1/callback)
         │
         ▼
Supabase:
  - Creates/finds user in auth.users
  - Creates identity in auth.identities
  - Issues session JWT
  - Redirects to ${redirectTo} (e.g., /sanctuary)
         │
         ▼
User lands in /sanctuary AUTHENTICATED
```

**Supabase handles everything** - no Solara backend code involved.

### B) TikTok - CONNECT ONLY (Solara custom OAuth)

```
User clicks "T" on /sign-in (or /settings)
         │
         ▼
window.location.href = "/api/social/oauth/tiktok/connect?return_to=/sign-in"
         │
         ▼
GET /api/social/oauth/tiktok/connect (connect/route.ts)
         │
         ├─► supabase.auth.getUser() → NO SESSION?
         │         │
         │         ▼
         │   Redirect to /sign-in?returnUrl=/api/social/oauth/tiktok/connect...
         │   (LOOP - user can't sign in without session!)
         │
         ├─► supabase.auth.getUser() → HAS SESSION
                   │
                   ▼
         Generate PKCE (verifier + challenge)
         Generate state, store in cookie
         Store userId in state cookie
                   │
                   ▼
         Redirect to https://www.tiktok.com/v2/auth/authorize?...
                   │
                   ▼
         User approves on TikTok
                   │
                   ▼
         TikTok redirects to /api/social/oauth/tiktok/callback
                   │
                   ▼
GET /api/social/oauth/tiktok/callback (callback/route.ts)
         │
         ▼
Validate state cookie, retrieve PKCE verifier
         │
         ▼
Exchange code for tokens (with PKCE)
         │
         ▼
Encrypt tokens, upsert to social_accounts
         │
         ▼
Set social_insights_enabled = true (if first connection)
         │
         ▼
Fire-and-forget sync request
         │
         ▼
Redirect to /settings?social=connected&provider=tiktok
```

**Key difference**: TikTok flow requires `userId` from existing session before OAuth starts.

### C) X / Reddit - STUBS

```
User clicks "X" or "R" on /sign-in
         │
         ▼
setError("X sign-in coming soon") / setError("Reddit sign-in coming soon")
         │
         ▼
Error toast displayed, no navigation
```

---

## 4) Storage/Identity Matrix

| Provider | Creates Supabase Session? | Writes `auth.identities`? | Writes `social_accounts`? | `external_user_id` source |
|----------|---------------------------|---------------------------|---------------------------|---------------------------|
| **Facebook (via Supabase)** | YES | YES | NO | Supabase identity |
| **Facebook (via connect)** | NO | NO | YES | Graph API `/me` → `id` |
| **TikTok** | NO | NO | YES | Token response `open_id` |
| **Instagram** | NO | NO | YES | Graph API `/me` → `id` |
| **X** | NO | NO | YES (if enabled) | Token response |
| **Reddit** | NO | NO | YES (if enabled) | Token response |

### Current Database State

```sql
-- Supabase Auth (managed by Supabase)
auth.users         -- Has user records for all auth methods
auth.identities    -- Has Facebook identity IF user signed in with Facebook via Supabase

-- Solara Custom (managed by app)
public.social_accounts   -- Has tokens for any provider connected via /api/social/oauth/.../connect
public.social_summaries  -- Has AI summaries generated from social content
```

---

## 5) Gap Analysis: Why "Sign in with X" is Not Real Login

### Facebook: Works as TRUE Login
- Uses `supabase.auth.signInWithOAuth()`
- Supabase handles the entire flow
- Creates session automatically
- Can be used on `/sign-in` without existing account

### TikTok: Connect-Only (NOT Login)
**Why it fails as login:**
1. Uses Solara's custom OAuth via `/api/social/oauth/tiktok/connect`
2. Connect route calls `supabase.auth.getUser()` on line 74-78
3. No session → redirect to `/sign-in` (line 88-90)
4. **Chicken-and-egg problem**: Can't sign in without session, can't get session without signing in

**What would need to change:**
1. Remove session requirement from connect route (allow unauthenticated)
2. After token exchange, look up `social_accounts` by `external_user_id` (TikTok `open_id`)
3. If found → retrieve linked `user_id`, mint Supabase session
4. If not found → show "no account linked" message with signup CTA
5. Redirect to `/sanctuary` with valid session

### X / Reddit: Not Implemented
- Buttons exist but show error toasts
- `isProviderEnabled()` returns `false` for X (gated behind `X_OAUTH_ENABLED`)
- Reddit adapter exists but Settings shows `enabled: false`

---

## 6) Recommended Architecture

### Option A: Supabase-Native OAuth (Preferred for Supported Providers)

**Pros:**
- Zero custom code for auth flow
- Supabase handles session, identity linking
- Automatic token refresh
- Works out of the box

**Cons:**
- Limited to Supabase-supported providers (Facebook, Google, Twitter, etc.)
- TikTok is NOT supported by Supabase natively
- Less control over token storage

**Recommended for:** Facebook (already done), X/Twitter (Supabase supports it)

### Option B: Solara Custom OAuth → Lookup → Mint Session

**Pros:**
- Works for any OAuth provider (including TikTok)
- Full control over token storage
- Can support unsupported providers

**Cons:**
- More complex - need to mint sessions manually
- Requires admin API (`supabase.auth.admin.generateLink()` or similar)
- Need to handle account linking manually

**Recommended for:** TikTok, Reddit (not Supabase-supported)

### Per-Provider Recommendation

| Provider | Recommendation | Reason |
|----------|---------------|--------|
| **Facebook** | Keep Supabase-native | Already working |
| **TikTok** | Custom OAuth + session mint | Not Supabase-supported |
| **X/Twitter** | Switch to Supabase-native | Supabase supports Twitter OAuth |
| **Reddit** | Custom OAuth + session mint | Not Supabase-supported |

---

## 7) Safety & Edge Cases Checklist

### User tries "Sign in with TikTok" but no linked account exists

**Current behavior:** Infinite redirect loop (session required but no session)

**Proposed behavior:**
1. Allow unauthenticated connect flow
2. After token exchange, lookup `social_accounts.external_user_id`
3. If not found → redirect to `/sign-in?error=not_linked&provider=tiktok`
4. Show message: "No Solara account is linked to this TikTok. Please sign in with email or Facebook first."

### return_to open redirect protection

**Current status:** ✅ IMPLEMENTED

Both connect and callback routes validate `return_to`:
- Must start with `/`
- Must not be protocol-relative (`//`)
- Must not contain `://`, `\\`, or encoded slashes
- See `isValidReturnTo()` in [callback/route.ts](app/api/social/oauth/[provider]/callback/route.ts):28-42

### Rate limiting

**Current status:** ⚠️ NOT IMPLEMENTED for OAuth routes

- Public endpoints (`/api/public-*`) have rate limiting
- OAuth connect/callback routes do NOT have rate limiting
- Low risk since OAuth providers have their own rate limits

### Debug logs gating via OAUTH_DEBUG_LOGS

**Current status:** ✅ IMPLEMENTED

- Set `OAUTH_DEBUG_LOGS=true` to enable verbose logging
- See [callback/route.ts](app/api/social/oauth/[provider]/callback/route.ts):22

### Multi-tab OAuth state collisions

**Current status:** ⚠️ PARTIAL

- State is stored in a single cookie `social_oauth_state`
- PKCE verifier is scoped by `provider + state` in separate cookie
- If user opens two tabs and starts OAuth in both, second will overwrite first
- Mitigation: State includes timestamp, expires after 10 minutes

---

## 8) PR Plan

### PR 1: Fix TikTok Button on Auth Pages (Quick Win)

**Goal:** Remove misleading TikTok buttons from auth pages since they can't work without session

**Files:**
- `app/(auth)/sign-in/page.tsx` - Remove TikTok button or show "Connect after sign-in"
- `app/(auth)/join/page.tsx` - Same
- `app/(auth)/welcome/page.tsx` - Same

**Verification:**
- [ ] No TikTok button on `/sign-in`
- [ ] No redirect loop when clicking social buttons

---

### PR 2: Migrate X to Supabase-Native OAuth

**Goal:** Use Supabase's built-in Twitter/X OAuth for true login

**Prerequisite:** Configure Twitter OAuth in Supabase dashboard

**Files:**
- `app/(auth)/sign-in/page.tsx` - Change X button to use `supabase.auth.signInWithOAuth({ provider: "twitter" })`
- `app/(auth)/join/page.tsx` - Same
- `lib/oauth/providers/x.ts` - Keep for Social Insights connect (separate flow)

**Verification:**
- [ ] Can sign in with X on `/sign-in`
- [ ] Lands in `/sanctuary` authenticated
- [ ] `auth.identities` has Twitter record

---

### PR 3: Implement True TikTok Login (Complex)

**Goal:** Allow sign-in with TikTok for users who have linked their account

**Architecture:**
1. Create `/api/auth/social/tiktok/login` route (separate from connect)
2. No session required
3. After token exchange:
   - Lookup `social_accounts` by `external_user_id` (TikTok `open_id`)
   - If found: Use `supabase.auth.admin.getUserById(user_id)` + generate magic link
   - Redirect to magic link which establishes session
4. If not found: Redirect with `error=not_linked`

**Files:**
- New: `app/api/auth/social/tiktok/login/route.ts`
- New: `app/api/auth/social/tiktok/callback/route.ts` (login-specific callback)
- `app/(auth)/sign-in/page.tsx` - Update TikTok button to use login route

**Verification:**
- [ ] Can sign in with TikTok IF account was previously linked
- [ ] Shows "not linked" error if no linked account
- [ ] Lands in `/sanctuary` authenticated

---

### PR 4: Implement True Reddit Login (Complex)

**Goal:** Same as PR 3 but for Reddit

**Files:**
- New: `app/api/auth/social/reddit/login/route.ts`
- New: `app/api/auth/social/reddit/callback/route.ts`
- `app/(auth)/sign-in/page.tsx` - Update Reddit button

---

## Verification Checklist (Final)

After all PRs merged:

- [ ] Facebook sign-in works on `/sign-in` → lands in `/sanctuary`
- [ ] TikTok sign-in works IF previously linked → lands in `/sanctuary`
- [ ] TikTok sign-in shows error if not linked → stays on `/sign-in`
- [ ] X sign-in works via Supabase → lands in `/sanctuary`
- [ ] Reddit sign-in works IF previously linked → lands in `/sanctuary`
- [ ] Social connect from `/settings` still works for all providers
- [ ] Social connect from Sanctuary modal still works
- [ ] `auth.identities` populated for Supabase-native providers
- [ ] `social_accounts` populated for connect flows
- [ ] No open redirect vulnerabilities
- [ ] Debug logs only appear when `OAUTH_DEBUG_LOGS=true`

---

## Summary

| Provider | Current State | Target State | Effort |
|----------|--------------|--------------|--------|
| **Facebook** | TRUE LOGIN (Supabase) | Keep as-is | None |
| **TikTok** | Connect-only (broken on auth pages) | TRUE LOGIN (custom) | High |
| **X** | Stub (error toast) | TRUE LOGIN (Supabase-native) | Medium |
| **Reddit** | Stub (error toast) | TRUE LOGIN (custom) | High |

**Biggest wins:**
1. Remove broken TikTok buttons from auth pages (quick fix)
2. Enable X login via Supabase-native OAuth (medium effort)
3. Implement true TikTok login with account linking (high effort)

**Risk level:** MEDIUM - Supabase admin API usage requires careful testing
