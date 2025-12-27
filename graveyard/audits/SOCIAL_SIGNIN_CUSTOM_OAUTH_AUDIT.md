# Social Sign-In via Solara Custom OAuth - Architecture Audit
> Generated: 2025-12-23
> Mode: AUDIT ONLY - No code changes

---

## A) Executive Summary (1 page)

### Goal
Unify ALL social authentication under Solara's custom OAuth system. Every "Sign in with {provider}" button should:
1. Authenticate the user (or create account if first time)
2. Mint a Supabase session cookie (so RLS/Sanctuary works)
3. Redirect to `/sanctuary`

Every "Connect {provider}" button (Settings/Sanctuary) should:
1. Require existing session
2. Store tokens in `social_accounts` for Social Insights
3. Redirect back to `/settings` or `/sanctuary`

### Current Problem
The custom OAuth flow in `/api/social/oauth/[provider]/connect` requires an **existing Supabase session** before it can start. This creates a chicken-and-egg problem for login:
- User clicks "Sign in with TikTok"
- Connect route calls `supabase.auth.getUser()` → NO SESSION
- Redirects to `/sign-in` → user is stuck in a loop

### Solution Overview
1. **Create separate login route** (`/api/auth/social/[provider]/login`) that does NOT require a session
2. **Introduce identity mapping table** (`social_identities`) to link `(provider, external_user_id) → user_id`
3. **Mint Supabase session** after successful OAuth using Admin API
4. **Share OAuth callback logic** between login and connect modes via `mode` parameter

### Key Architectural Decision
**Keep Solara custom OAuth for ALL providers** - this gives us:
- Full control over token storage and encryption
- Consistent behavior across all providers (including TikTok which Supabase doesn't support)
- Ability to use tokens for Social Insights pipeline
- No dependency on Supabase's provider support matrix

---

## 1) Why "Sign in with TikTok" Cannot Work Today

### The Dead End - Step by Step

```
1. User on /sign-in, clicks TikTok button
         │
         ▼
2. window.location.href = "/api/social/oauth/tiktok/connect?return_to=/sign-in"
         │
         ▼
3. GET /api/social/oauth/tiktok/connect (connect/route.ts:74-78)
         │
         ├─► const supabase = await createServerSupabaseClient();
         ├─► const { data: { user } } = await supabase.auth.getUser();
         │
         ▼
4. user === null (NO SESSION EXISTS)
         │
         ▼
5. Redirect to /sign-in?returnUrl=/api/social/oauth/tiktok/connect... (lines 88-90)
         │
         ▼
6. User back on /sign-in with no way to proceed
         │
         ▼
   INFINITE LOOP - Cannot sign in without session, cannot get session without signing in
```

### Root Cause Analysis

| Component | Current Behavior | Required for Login |
|-----------|-----------------|-------------------|
| `connect/route.ts:74-78` | Requires `user` from `getUser()` | Must work without session |
| `connect/route.ts:101-107` | Stores `userId` in state cookie | Must handle "no user yet" case |
| `callback/route.ts:284` | Uses `storedState.userId` for DB upsert | Must create/lookup user |
| Protected layout | Checks `supabase.auth.getUser()` | Must have session cookie set |

### What Sanctuary Expects

The protected layout ([layout.tsx](app/(protected)/layout.tsx):13-21) performs:
```typescript
const supabase = await createServerSupabaseClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  redirect("/sign-in");
}
```

**This means**: A valid Supabase session cookie must be present, which only happens when:
1. User signs in with email/password via `supabase.auth.signInWithPassword()`
2. User signs in with Supabase-native OAuth (Facebook) via `supabase.auth.signInWithOAuth()`
3. User exchanges a PKCE code via `supabase.auth.exchangeCodeForSession()` (auth callback route)

Custom OAuth does NONE of these - it only stores tokens in `social_accounts`.

---

## 2) Supabase Session Minting Approaches

### Approach A: Admin API `createUser` + `generateLink` (RECOMMENDED)

**How it works:**
1. After custom OAuth succeeds, lookup `social_identities` by `(provider, external_user_id)`
2. If user exists: use `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })`
3. Redirect user to magic link URL → Supabase sets session cookie → redirects to `/sanctuary`
4. If user doesn't exist: create user with `supabase.auth.admin.createUser()`, then generate link

**Permissions required:**
- `SUPABASE_SERVICE_ROLE_KEY` (already have)
- Admin API access (enabled by default with service role)

**Security concerns:**
- Magic link URLs are single-use and short-lived (5 minutes default)
- Must validate `external_user_id` ownership via OAuth before generating link
- Link generation should ONLY happen in callback route, never client-initiated

**Pros:**
- Supabase handles session cookie securely
- Works with existing session infrastructure
- No custom JWT signing needed

**Cons:**
- Extra redirect hop (callback → magic link → sanctuary)
- Depends on email being available (TikTok may not provide email)

**Email fallback for TikTok:**
- Generate synthetic email: `{open_id}@tiktok.solara.internal`
- Mark as unverified in Supabase
- Store real email separately if later obtained

---

### Approach B: Admin API `updateUserById` with custom session (RISKY)

**How it works:**
1. After OAuth, use `supabase.auth.admin.updateUserById()` to update user metadata
2. Manually construct session JWT and set as cookie
3. User lands in Sanctuary with session

**Permissions required:**
- Service role key
- Understanding of Supabase JWT structure

**Security concerns:**
- Must correctly sign JWT with project secret
- Must set correct expiry, claims, and refresh token
- Any mistake → security vulnerability or broken sessions

**Pros:**
- Single redirect (callback → sanctuary)
- No email dependency

**Cons:**
- High risk of implementation errors
- Couples to Supabase internals (JWT structure may change)
- Must handle refresh token rotation manually

**Verdict:** NOT RECOMMENDED - too fragile

---

### Approach C: Supabase `exchangeCodeForSession` via Custom PKCE Flow (CLEANEST)

**How it works:**
1. After custom OAuth succeeds, generate a Supabase-compatible PKCE flow internally
2. Use `supabase.auth.admin.generateLink({ type: 'recovery' })` or similar to get a code
3. Redirect to `/auth/callback` with that code
4. Existing callback route calls `exchangeCodeForSession()` → session established

**Permissions required:**
- Service role key
- Admin API generateLink access

**Security concerns:**
- Recovery/magic links have the same security as email-based auth
- Single-use, time-limited

**Pros:**
- Uses existing `/auth/callback` infrastructure
- Supabase handles all session mechanics
- Clean separation of concerns

**Cons:**
- Requires understanding link types
- May need to work around "recovery" vs "signup" semantics

**Verdict:** RECOMMENDED - cleanest integration with existing code

---

### Recommendation Matrix

| Approach | Complexity | Security | Email Required | Redirects | Recommended |
|----------|------------|----------|----------------|-----------|-------------|
| A: generateLink (magiclink) | Medium | High | YES* | 2 | YES |
| B: Custom JWT | High | MEDIUM | No | 1 | NO |
| C: generateLink → callback | Medium | High | YES* | 2 | YES (preferred) |

*Email can be synthetic for providers that don't return it

---

## 3) Identity Mapping Strategy

### Option A: New `social_identities` Table (RECOMMENDED)

**Schema:**
```sql
CREATE TABLE public.social_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique: one identity per provider per user, one user per external_user_id per provider
  CONSTRAINT social_identities_provider_external_unique UNIQUE (provider, external_user_id),
  CONSTRAINT social_identities_user_provider_unique UNIQUE (user_id, provider),

  -- Provider must be valid
  CONSTRAINT social_identities_provider_check CHECK (
    provider IN ('facebook', 'instagram', 'tiktok', 'x', 'reddit')
  )
);

-- Index for fast lookup by (provider, external_user_id)
CREATE INDEX idx_social_identities_lookup ON public.social_identities(provider, external_user_id);
```

**RLS Rules:**
```sql
ALTER TABLE public.social_identities ENABLE ROW LEVEL SECURITY;

-- Users can view their own identities (for account management UI)
CREATE POLICY "Users can view own identities"
  ON public.social_identities FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update/delete (during OAuth flow)
CREATE POLICY "Service role manages identities"
  ON public.social_identities FOR ALL
  USING (false)
  WITH CHECK (false);
-- Service role bypasses RLS, so this effectively makes writes service-only
```

**Pros:**
- Identity persists even if tokens are revoked
- Clear separation: identities = login capability, social_accounts = API access
- User can "disconnect" social insights (delete from `social_accounts`) without losing login capability
- Supports multiple providers linked to same account

**Cons:**
- New table to maintain
- Need to keep in sync during OAuth flows

---

### Option B: Reuse `social_accounts` for Mapping

**Current schema already has:**
- `user_id`
- `provider`
- `external_user_id`

**Modification:** Just add unique constraint on `(provider, external_user_id)`

**Pros:**
- No new table
- Already storing the mapping implicitly

**Cons:**
- When user "disconnects" provider in Settings, row is deleted → LOSES LOGIN CAPABILITY
- Conflates "API access tokens" with "identity"
- If token refresh fails and row is deleted → user locked out
- Cannot have identity without tokens

**Verdict:** NOT RECOMMENDED - dangerous coupling of concerns

---

### Recommendation: Option A (New Table)

**Reasoning:**
1. **Separation of concerns**: Identity (who you are) vs. API access (what you can do)
2. **Graceful disconnect**: User can revoke Social Insights access without losing login
3. **Future flexibility**: Could support "sign in with" even for providers we don't pull content from
4. **Data integrity**: Identity survives token expiry, refresh failures, user-initiated disconnect

---

## 4) Login vs Connect Mode - Decision Tree

### Mode Detection Logic

```
Request arrives at /api/social/oauth/[provider]/connect OR /api/auth/social/[provider]/login
         │
         ├─► Route is /api/auth/social/[provider]/login?
         │         │
         │         YES → SIGN-IN MODE (no session required)
         │         │
         │         ▼
         │    Store mode="login" in state cookie
         │    Proceed with OAuth (no userId in state)
         │
         └─► Route is /api/social/oauth/[provider]/connect?
                   │
                   ▼
             Check supabase.auth.getUser()
                   │
                   ├─► user exists → CONNECT MODE
                   │         │
                   │         ▼
                   │    Store mode="connect", userId in state
                   │    Proceed with OAuth
                   │
                   └─► no user → Redirect to /sign-in
                             (existing behavior)
```

### Callback Handling by Mode

```
Callback receives code + state
         │
         ▼
Parse mode from state cookie
         │
         ├─► mode === "connect"?
         │         │
         │         YES → CONNECT FLOW (existing)
         │         │
         │         ▼
         │    Exchange code → tokens
         │    Encrypt tokens
         │    Upsert to social_accounts
         │    Set social_insights_enabled = true
         │    Redirect to return_to (default /settings)
         │
         └─► mode === "login"?
                   │
                   YES → SIGN-IN FLOW (new)
                   │
                   ▼
             Exchange code → tokens → external_user_id
                   │
                   ▼
             Lookup social_identities(provider, external_user_id)
                   │
                   ├─► Found? → user_id = row.user_id
                   │         │
                   │         ▼
                   │    Optionally upsert tokens to social_accounts
                   │    Generate magic link for user_id
                   │    Redirect to magic link → /sanctuary
                   │
                   └─► Not found? → CREATE NEW USER
                             │
                             ▼
                       Generate email: {external_user_id}@{provider}.solara.internal
                       supabase.auth.admin.createUser({ email, email_confirm: true })
                       Create profile row (minimal)
                       Insert social_identities row
                       Optionally insert social_accounts row
                       Generate magic link
                       Redirect to magic link → /onboarding (new users)
```

### Files to Modify (Conceptual)

| File | Change | Why |
|------|--------|-----|
| **NEW**: `app/api/auth/social/[provider]/login/route.ts` | Create login initiation route | Separate from connect, no session required |
| **NEW**: `app/api/auth/social/[provider]/callback/route.ts` | Create login callback route | OR: Modify existing callback to handle both modes |
| `app/api/social/oauth/[provider]/connect/route.ts` | No change | Keep for connect-only flow |
| `app/api/social/oauth/[provider]/callback/route.ts` | Add mode handling | Check mode, branch to login vs connect logic |
| `app/(auth)/sign-in/page.tsx` | Update button hrefs | Point to `/api/auth/social/[provider]/login` |
| `app/(auth)/join/page.tsx` | Update button hrefs | Point to `/api/auth/social/[provider]/login` |
| `lib/supabase/server.ts` | Already has `createAdminSupabaseClient()` | Use for generateLink |

### Alternative: Single Callback with Mode Detection

Instead of separate callback routes, modify existing callback to:
1. Check `storedState.mode`
2. If `mode === "login"` → run login flow
3. If `mode === "connect"` → run existing connect flow

This keeps OAuth redirect URIs simpler (one callback per provider, registered with TikTok/Facebook).

---

## 5) Provider-Specific Constraints

### Normalization to `NormalizedIdentity`

```typescript
interface NormalizedIdentity {
  provider: SocialProvider;
  externalUserId: string;      // Always present after OAuth
  email: string | null;        // May be null (TikTok)
  displayName: string | null;  // May be null
  profileImageUrl: string | null;
}
```

### Provider Matrix

| Provider | external_user_id Source | Email Available? | Notes |
|----------|------------------------|------------------|-------|
| **TikTok** | Token response `open_id` | NO (scope `user.info.basic`) | Must generate synthetic email |
| **Facebook** | Graph API `/me` → `id` | MAYBE (`email` scope) | May need separate permission request |
| **Instagram** | Graph API `/me` → `id` | NO | Business accounts only have `id` |
| **X/Twitter** | Token response `user_id` or `/me` | MAYBE | Depends on app permissions |
| **Reddit** | Token response → `/api/v1/me` → `id` | YES (usually) | Reddit returns username, not numeric ID |

### Adapter Standardization

Each provider adapter should implement:

```typescript
interface ProviderAdapter {
  // ... existing fields ...

  /**
   * Extract identity from token response + optional API call.
   * Returns NormalizedIdentity with at least externalUserId populated.
   */
  extractIdentity(tokens: NormalizedTokens): Promise<NormalizedIdentity>;
}
```

**TikTok:**
```typescript
extractIdentity(tokens) {
  return {
    provider: "tiktok",
    externalUserId: tokens.userId!, // open_id from token response
    email: null,
    displayName: null,
    profileImageUrl: null,
  };
}
```

**Facebook:**
```typescript
extractIdentity(tokens) {
  // Already have fetchUserId, extend to fetch email
  const response = await fetch("https://graph.facebook.com/me?fields=id,email,name,picture", {
    headers: { Authorization: `Bearer ${tokens.accessToken}` }
  });
  const data = await response.json();
  return {
    provider: "facebook",
    externalUserId: data.id,
    email: data.email || null,
    displayName: data.name || null,
    profileImageUrl: data.picture?.data?.url || null,
  };
}
```

---

## 6) Security Audit

### 6.1 Account Takeover Prevention

**Scenario:** Attacker tries to link their social account to victim's Solara account.

**Current protection (CONNECT mode):**
- Requires existing session → attacker would need victim's session
- `userId` in state cookie is set from authenticated session

**New protection needed (LOGIN mode):**
- Identity lookup is deterministic: `(provider, external_user_id)` → one `user_id`
- Attacker cannot choose which Solara account to link to
- First connection "claims" the identity forever

**Additional safeguard:**
- Log all `social_identities` inserts with IP, timestamp
- Alert on same `external_user_id` attempting to link to different `user_id` (should never happen due to unique constraint)

### 6.2 Open Redirect Protection

**Current status:** ✅ IMPLEMENTED in `callback/route.ts:28-42`

```typescript
function isValidReturnTo(returnTo: string | null | undefined): returnTo is string {
  if (!returnTo) return false;
  if (!returnTo.startsWith("/")) return false;
  if (returnTo.startsWith("//")) return false;
  if (returnTo.toLowerCase().includes("http:")) return false;
  if (returnTo.toLowerCase().includes("https:")) return false;
  if (returnTo.includes("://")) return false;
  if (returnTo.includes("\\")) return false;
  if (returnTo.includes("%2f") || returnTo.includes("%2F")) return false;
  return true;
}
```

**For login flow:** Apply same validation. Default return_to should be `/sanctuary` for login, `/settings` for connect.

### 6.3 Token Encryption

**Current status:** ✅ IMPLEMENTED

- Tokens encrypted with AES-256-GCM before storage
- Key from `SOCIAL_TOKEN_ENCRYPTION_KEY` env var
- See `lib/social/crypto.ts`

**For login flow:** No change needed - login flow optionally stores tokens to `social_accounts` using same encryption.

### 6.4 OAUTH_DEBUG_LOGS Flag

**Current status:** ✅ IMPLEMENTED

```typescript
const debug = process.env.OAUTH_DEBUG_LOGS === "true";
if (debug) console.log(`[OAuth Debug] ...`);
```

**For login flow:** Use same pattern. Log:
- Mode (login vs connect)
- Identity lookup result (found vs not found)
- User creation events
- Magic link generation (NOT the link itself)

### 6.5 Rate Limiting

**Current status:** ⚠️ NOT IMPLEMENTED for OAuth routes

**Risk assessment:**
- OAuth providers have their own rate limits
- Supabase Admin API has rate limits
- Main risk: Repeated magic link generation → email spam

**Recommendation:**
- Add rate limit on login initiation: 10 requests per IP per minute
- Add rate limit on callback: 5 requests per IP per minute
- Use Redis or in-memory store with sliding window

**Implementation location:**
- Add to `app/api/auth/social/[provider]/login/route.ts`
- Consider shared rate limit middleware

### 6.6 CSRF Protection

**Current status:** ✅ IMPLEMENTED via state parameter

- Random state generated in connect route
- Stored in httpOnly cookie
- Validated in callback
- State expires after 10 minutes

**For login flow:** Same mechanism, just without `userId` in state.

---

## 7) Deliverables

### B) Current-State Flow Diagrams

#### CONNECT Flow (Working Today)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONNECT MODE (Settings)                          │
└─────────────────────────────────────────────────────────────────────────┘

User (authenticated) clicks "Connect TikTok" in Settings
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ GET /api/social/oauth/tiktok/connect?return_to=/settings                │
│ (connect/route.ts)                                                      │
│ ─────────────────────────────────────────────────────────────────────── │
│ 1. supabase.auth.getUser() → user (HAS SESSION)                        │
│ 2. Generate PKCE pair                                                   │
│ 3. Generate state, store in cookie with userId                         │
│ 4. Store PKCE verifier in cookie                                       │
│ 5. Redirect to TikTok authorize URL                                    │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
         TikTok Auth Page
         User approves
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ GET /api/social/oauth/tiktok/callback?code=xxx&state=yyy                │
│ (callback/route.ts)                                                     │
│ ─────────────────────────────────────────────────────────────────────── │
│ 1. Validate state from cookie                                          │
│ 2. Retrieve PKCE verifier                                              │
│ 3. Exchange code for tokens                                            │
│ 4. Encrypt tokens                                                      │
│ 5. Upsert to social_accounts (userId from state)                       │
│ 6. Set social_insights_enabled = true                                  │
│ 7. Redirect to /settings?social=connected&provider=tiktok              │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
         /settings with success toast
```

#### SIGN-IN Flow (Proposed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LOGIN MODE (/sign-in)                            │
└─────────────────────────────────────────────────────────────────────────┘

User (NOT authenticated) clicks "Sign in with TikTok"
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ GET /api/auth/social/tiktok/login                                       │
│ (NEW: login/route.ts)                                                   │
│ ─────────────────────────────────────────────────────────────────────── │
│ 1. NO session check required                                           │
│ 2. Generate PKCE pair                                                   │
│ 3. Generate state, store in cookie with mode="login"                   │
│ 4. Store PKCE verifier in cookie                                       │
│ 5. Redirect to TikTok authorize URL                                    │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
         TikTok Auth Page
         User approves
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ GET /api/auth/social/tiktok/callback?code=xxx&state=yyy                 │
│ (NEW: callback/route.ts OR modified existing)                          │
│ ─────────────────────────────────────────────────────────────────────── │
│ 1. Validate state from cookie                                          │
│ 2. Retrieve PKCE verifier                                              │
│ 3. Exchange code for tokens → external_user_id (open_id)              │
│ 4. LOOKUP: social_identities WHERE (tiktok, open_id)                  │
│    │                                                                    │
│    ├─► FOUND: user_id = row.user_id                                   │
│    │   │                                                               │
│    │   ▼                                                               │
│    │   (Optionally update social_accounts)                            │
│    │   Generate magic link for user_id                                │
│    │   Redirect to magic link → /sanctuary                            │
│    │                                                                    │
│    └─► NOT FOUND: Create new user                                      │
│        │                                                               │
│        ▼                                                               │
│        email = "{open_id}@tiktok.solara.internal"                     │
│        supabase.auth.admin.createUser({ email, email_confirm: true }) │
│        Create profile (is_onboarded = false)                          │
│        INSERT INTO social_identities                                  │
│        INSERT INTO social_accounts (optional)                         │
│        Generate magic link                                            │
│        Redirect to magic link → /onboarding                           │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
         /sanctuary (existing user)
         OR /onboarding (new user)
```

---

### C) Recommended Architecture

#### File Structure

```
app/
├── api/
│   ├── auth/
│   │   └── social/
│   │       └── [provider]/
│   │           ├── login/
│   │           │   └── route.ts    # NEW: Login initiation
│   │           └── callback/
│   │               └── route.ts    # NEW: Login callback
│   │
│   └── social/
│       └── oauth/
│           └── [provider]/
│               ├── connect/
│               │   └── route.ts    # EXISTING: Connect initiation
│               └── callback/
│                   └── route.ts    # EXISTING: Connect callback
```

#### Alternative: Unified Callback

If TikTok/Facebook only allow one redirect URI per app:

```
app/
├── api/
│   ├── auth/
│   │   └── social/
│   │       └── [provider]/
│   │           └── login/
│   │               └── route.ts    # Login initiation only
│   │
│   └── social/
│       └── oauth/
│           └── [provider]/
│               ├── connect/
│               │   └── route.ts    # Connect initiation
│               └── callback/
│                   └── route.ts    # MODIFIED: Handles both modes
```

---

### D) DB Schema Proposal

```sql
-- ============================================================================
-- SOCIAL IDENTITIES TABLE
-- ============================================================================
-- Maps (provider, external_user_id) → Solara user_id for login purposes.
-- Separate from social_accounts to survive token revocation.

CREATE TABLE public.social_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  email_from_provider TEXT,           -- If provider returned email
  display_name_from_provider TEXT,    -- If provider returned name
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One identity per provider per user
  CONSTRAINT social_identities_user_provider_unique UNIQUE (user_id, provider),

  -- One user per external_user_id per provider (prevents linking to multiple accounts)
  CONSTRAINT social_identities_provider_external_unique UNIQUE (provider, external_user_id),

  -- Provider validation
  CONSTRAINT social_identities_provider_check CHECK (
    provider IN ('facebook', 'instagram', 'tiktok', 'x', 'reddit')
  )
);

-- Fast lookup for login flow
CREATE INDEX idx_social_identities_lookup
  ON public.social_identities(provider, external_user_id);

-- RLS
ALTER TABLE public.social_identities ENABLE ROW LEVEL SECURITY;

-- Users can view their own (for account settings UI)
CREATE POLICY "Users can view own identities"
  ON public.social_identities FOR SELECT
  USING (auth.uid() = user_id);

-- All writes via service role only
CREATE POLICY "Block direct user writes"
  ON public.social_identities FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Block direct user updates"
  ON public.social_identities FOR UPDATE
  USING (false);

CREATE POLICY "Block direct user deletes"
  ON public.social_identities FOR DELETE
  USING (false);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_social_identities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER social_identities_updated_at
  BEFORE UPDATE ON public.social_identities
  FOR EACH ROW
  EXECUTE FUNCTION update_social_identities_updated_at();
```

---

### E) Risk Register

| ID | Risk | Impact | Probability | Severity | Mitigation |
|----|------|--------|-------------|----------|------------|
| **P0-1** | Magic link email not deliverable (synthetic email) | Users can't complete login | Medium | P0 | Use `email_confirm: true` to skip email verification |
| **P0-2** | External user ID collision across providers | Wrong account linked | Very Low | P0 | Unique constraint on `(provider, external_user_id)` |
| **P1-1** | User disconnects social → loses login | User locked out | Medium | P1 | Keep `social_identities` separate from `social_accounts` |
| **P1-2** | TikTok/Facebook rate limits during high traffic | OAuth failures | Low | P1 | Implement retry with exponential backoff |
| **P1-3** | Magic link expiry (5 min default) | User sees error | Low | P1 | Generate link just before redirect, increase TTL if needed |
| **P2-1** | Provider changes external_user_id format | Lookup failures | Very Low | P2 | Monitor, migrate if needed |
| **P2-2** | Supabase Admin API changes | Build breaks | Very Low | P2 | Pin SDK version, test on upgrades |

---

### F) PR Plan

#### PR 1: Database Schema (Low Risk)

**Goal:** Create `social_identities` table

**Files:**
- NEW: `sql/016_social_identities.sql`

**Verification:**
- [ ] Table created with correct constraints
- [ ] Indexes created
- [ ] RLS policies applied
- [ ] Can insert via service role
- [ ] Cannot insert via anon/authenticated role

---

#### PR 2: Login Route + Basic Flow (Medium Risk)

**Goal:** Create login initiation route, modify callback to handle login mode

**Files:**
- NEW: `app/api/auth/social/[provider]/login/route.ts`
- MODIFY: `app/api/social/oauth/[provider]/callback/route.ts` (add mode handling)
- NEW: `lib/auth/social.ts` (shared utilities: generateSyntheticEmail, createUserForSocialLogin)

**Verification:**
- [ ] Login route generates state with `mode: "login"`
- [ ] Callback detects login mode
- [ ] Identity lookup works
- [ ] New user creation works
- [ ] Magic link generated and redirects correctly
- [ ] Existing user login works

---

#### PR 3: UI Integration (Low Risk)

**Goal:** Wire up sign-in/join pages to use login route

**Files:**
- MODIFY: `app/(auth)/sign-in/page.tsx` - Update TikTok/Reddit/X button hrefs
- MODIFY: `app/(auth)/join/page.tsx` - Same
- MODIFY: `app/(auth)/welcome/page.tsx` - Same

**Verification:**
- [ ] TikTok button on /sign-in initiates login flow
- [ ] New user ends up in /onboarding
- [ ] Existing user ends up in /sanctuary
- [ ] Facebook still uses Supabase-native OR switched to custom
- [ ] X/Reddit show "coming soon" OR wired to login flow

---

#### PR 4: Facebook Migration (Optional)

**Goal:** Migrate Facebook from Supabase-native to Solara custom OAuth

**Files:**
- MODIFY: `app/(auth)/sign-in/page.tsx` - Change Facebook handler
- MODIFY: `app/(auth)/join/page.tsx` - Same
- NEW: `app/api/auth/social/facebook/login/route.ts` (or reuse [provider])

**Verification:**
- [ ] Facebook sign-in uses custom OAuth
- [ ] Existing Facebook users can still log in
- [ ] Identity lookup finds existing users by Facebook ID
- [ ] Migration of existing auth.identities data (if needed)

**Note:** This PR is optional. Facebook via Supabase-native already works. Migrating provides consistency but adds risk.

---

## Verification Checklist (Final)

After all PRs:

- [ ] `npm run build` passes
- [ ] TikTok "Sign in with" button works on `/sign-in`
- [ ] New TikTok user → creates account → lands in `/onboarding`
- [ ] Existing TikTok user → logs in → lands in `/sanctuary`
- [ ] TikTok "Connect" in Settings still works (existing flow)
- [ ] Disconnect TikTok in Settings does NOT break login capability
- [ ] Facebook sign-in still works (Supabase-native or migrated)
- [ ] `social_identities` table populated correctly
- [ ] `social_accounts` table populated correctly (when connecting)
- [ ] RLS blocks direct user writes to `social_identities`
- [ ] OAUTH_DEBUG_LOGS shows correct logs when enabled
- [ ] No open redirect vulnerabilities
- [ ] Magic links are single-use and expire

---

## Summary

**Key decisions:**
1. Keep Solara custom OAuth for ALL providers
2. Create new `social_identities` table (separate from `social_accounts`)
3. Use Supabase Admin API `generateLink` to mint sessions
4. Detect mode (login vs connect) via state cookie
5. Generate synthetic emails for providers that don't return email (TikTok)

**Files to create/modify:**
- 1 new SQL migration
- 1-2 new route handlers
- 1 new utility lib
- 3 UI page updates

**Estimated PRs:** 3-4
**Risk level:** Medium (Admin API usage, new auth flow)
