# Social Systems Audit - Comprehensive Report

**Date:** 2026-01-15
**Scope:** Complete audit of social media OAuth, Social Insights feature, and all tie-ins

---

## Executive Summary

### Verdict: Mostly Working, One Critical Blocker

| Category | Status | Notes |
|----------|--------|-------|
| **Auth Flow (TikTok)** | Working | Full PKCE, magic link session minting |
| **Auth Flow (Facebook)** | Working | Via Supabase OAuth |
| **Social Insights Connect** | Working | OAuth callbacks store encrypted tokens |
| **Token Encryption** | Working | AES-256-GCM |
| **Content Fetchers** | Partially Working | TikTok MVP (basic scope only) |
| **AI Summarization** | Working | GPT-4o-mini with structured output |
| **Sync Pipeline** | Working | Fire-and-forget with Redis locks |
| **Status Reflection** | Working | When service role key is valid |
| **Service Role Key** | BLOCKING | Missing/wrong on dev.website |

### The One Blocker

**Root Cause:** `SUPABASE_SERVICE_ROLE_KEY` is missing or from wrong project on dev.website.

**Evidence:**
- Client-side login works (uses anon key)
- Server routes return 500 "Invalid API key"
- All `/api/social/*` routes require service role for RLS-locked tables

---

## A. Complete File Inventory

### Auth Routes (Login Flow)

| File | Purpose | Status |
|------|---------|--------|
| [app/api/auth/login/tiktok/route.ts](app/api/auth/login/tiktok/route.ts) | TikTok OAuth initiation | Working |
| [app/api/auth/login/tiktok/callback/route.ts](app/api/auth/login/tiktok/callback/route.ts) | TikTok OAuth callback + session minting | Working |
| [app/api/auth/login/x/route.ts](app/api/auth/login/x/route.ts) | X OAuth initiation | Disabled |
| [app/api/auth/login/x/callback/route.ts](app/api/auth/login/x/callback/route.ts) | X OAuth callback | Disabled |
| [app/auth/callback/route.ts](app/auth/callback/route.ts) | Supabase OAuth callback (Facebook) | Working |

### Social Insights Routes (Connect/Sync Flow)

| File | Purpose | Status |
|------|---------|--------|
| [app/api/social/status/route.ts](app/api/social/status/route.ts) | Get connection statuses for Settings | Needs service key |
| [app/api/social/sync/route.ts](app/api/social/sync/route.ts) | Sync single provider (CRON protected) | Needs service key |
| [app/api/social/sync-user/route.ts](app/api/social/sync-user/route.ts) | Sync all providers for user | Needs service key |
| [app/api/social/revoke/route.ts](app/api/social/revoke/route.ts) | Disconnect provider | Needs service key |
| [app/api/social/oauth/[provider]/connect/route.ts](app/api/social/oauth/[provider]/connect/route.ts) | Start Social Insights OAuth | Working |
| [app/api/social/oauth/[provider]/callback/route.ts](app/api/social/oauth/[provider]/callback/route.ts) | Complete OAuth, store tokens | Needs service key |

### Core Libraries

| File | Purpose | Status |
|------|---------|--------|
| [lib/social/fetchers.ts](lib/social/fetchers.ts) | Content fetchers per provider | Working (TikTok MVP) |
| [lib/social/summarize.ts](lib/social/summarize.ts) | AI summary generation | Working |
| [lib/social/staleness.ts](lib/social/staleness.ts) | Staleness detection + fire-and-forget sync | Working |
| [lib/social/socialRateLimit.ts](lib/social/socialRateLimit.ts) | 5 connections/day rate limit | Working |
| [lib/social/crypto.ts](lib/social/crypto.ts) | Token encryption (AES-256-GCM) | Working |
| [lib/social/oauth.ts](lib/social/oauth.ts) | OAuth helpers (exchange, refresh) | Working |

### Provider Adapters

| File | Purpose | Status |
|------|---------|--------|
| [lib/oauth/providers/index.ts](lib/oauth/providers/index.ts) | Provider registry | Working |
| [lib/oauth/providers/tiktok.ts](lib/oauth/providers/tiktok.ts) | TikTok OAuth adapter | Working |
| [lib/oauth/providers/meta.ts](lib/oauth/providers/meta.ts) | Facebook/Instagram adapters | Working |
| [lib/oauth/providers/x.ts](lib/oauth/providers/x.ts) | X adapter | Disabled |
| [lib/oauth/providers/reddit.ts](lib/oauth/providers/reddit.ts) | Reddit adapter | Exists (UI disabled) |
| [lib/oauth/pkce.ts](lib/oauth/pkce.ts) | PKCE challenge generation/storage | Working |

### Supabase Clients

| File | Purpose | Status |
|------|---------|--------|
| [lib/supabase/server.ts](lib/supabase/server.ts) | Server client (session-based) | Working |
| [lib/supabase/service.ts](lib/supabase/service.ts) | Service role client (bypasses RLS) | Needs valid key |

### Database Migrations

| File | Purpose | Status |
|------|---------|--------|
| [supabase/migrations/20260108170752_lock_down_sensitive_tables.sql](supabase/migrations/20260108170752_lock_down_sensitive_tables.sql) | RLS: service_role only | Applied |
| [supabase/migrations/20241221_social_insights_toggle.sql](supabase/migrations/20241221_social_insights_toggle.sql) | social_insights_enabled columns | Applied |

### UI Components

| File | Purpose | Status |
|------|---------|--------|
| [app/(protected)/settings/page.tsx](app/(protected)/settings/page.tsx) | Settings with Social Insights section | Working |
| [components/sanctuary/SocialConnectModal.tsx](components/sanctuary/SocialConnectModal.tsx) | Connect prompt in Sanctuary | Working |
| [app/(auth)/sign-in/page.tsx](app/(auth)/sign-in/page.tsx) | Sign-in with social buttons | Working |

---

## B. Provider Flow Details

### TikTok Login Flow (Complete)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TIKTOK LOGIN FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. User clicks TikTok button                                              │
│      └─► /api/auth/login/tiktok                                             │
│           ├─ Generate PKCE challenge (S256)                                 │
│           ├─ Store verifier in cookie                                       │
│           ├─ Store state in cookie (with checkoutSessionId if present)      │
│           └─► Redirect to TikTok authorize URL                              │
│                                                                              │
│   2. User authorizes on TikTok                                              │
│      └─► TikTok redirects to /api/auth/login/tiktok/callback               │
│           ├─ Validate state + PKCE                                         │
│           ├─ Exchange code for tokens                                      │
│           ├─ Look up user by open_id in social_identities                  │
│           │                                                                  │
│           ├─ IF new user:                                                   │
│           │   ├─ Create auth.users entry (placeholder email)               │
│           │   ├─ Insert social_identities mapping                          │
│           │   └─ Create profile                                            │
│           │                                                                  │
│           ├─ IF consent cookie present:                                    │
│           │   ├─ Store tokens in social_accounts (encrypted)               │
│           │   └─ Enable social_insights if first connection                │
│           │                                                                  │
│           ├─ Mint session via magic link + verifyOtp                       │
│           ├─ Trigger fire-and-forget sync (if consent)                     │
│           └─► Redirect to /join (new) or /sanctuary (existing)             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Facebook Login Flow (via Supabase)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FACEBOOK LOGIN FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. User clicks Facebook button                                            │
│      └─► signInWithOAuth({ provider: 'facebook' })                         │
│           └─► Supabase handles redirect to Facebook                         │
│                                                                              │
│   2. User authorizes on Facebook                                            │
│      └─► Facebook redirects to Supabase callback                           │
│           └─► Supabase redirects to /auth/callback                         │
│               ├─ Exchange code for session                                  │
│               ├─ Create/update auth.users entry                            │
│               └─► Redirect to /join or /sanctuary                          │
│                                                                              │
│   NOTE: Facebook login does NOT auto-connect Social Insights               │
│         User must manually connect via Settings                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Social Insights Connect Flow (Post-Login)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SOCIAL INSIGHTS CONNECT FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. User clicks Connect button in Settings                                 │
│      └─► /api/social/oauth/[provider]/connect                              │
│           ├─ Verify user is logged in                                      │
│           ├─ Check rate limit (5/day)                                      │
│           ├─ Generate PKCE challenge                                       │
│           ├─ Store state cookie (with userId)                              │
│           └─► Redirect to provider authorize URL                           │
│                                                                              │
│   2. User authorizes                                                        │
│      └─► /api/social/oauth/[provider]/callback                             │
│           ├─ Validate state + PKCE                                         │
│           ├─ Exchange code for tokens                                      │
│           ├─ Encrypt tokens (AES-256-GCM)                                  │
│           ├─ Upsert to social_accounts                                     │
│           ├─ Upsert to social_identities                                   │
│           ├─ Enable social_insights_enabled (first connection)             │
│           ├─ Trigger fire-and-forget sync                                  │
│           └─► Redirect to Settings with ?social=connected                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## C. Summary Generation Scheduling

### When Summaries Are Generated

| Trigger | Route | Condition |
|---------|-------|-----------|
| **On Login (TikTok)** | Callback fires /api/social/sync | If consent cookie present |
| **On Connect** | Callback fires /api/social/sync | Always |
| **Daily (Passive)** | /api/insights checks staleness | If `last_social_sync_local_date !== today` |

### Staleness Detection Logic

```typescript
// lib/social/staleness.ts:isUserSocialStale()

1. Get today's local date for user's timezone
2. If last_social_sync_local_date === today → not stale
3. Check if user has any connected accounts in social_accounts
4. If no accounts → not stale
5. Otherwise → stale (trigger sync)
```

### Fire-and-Forget Pattern

```typescript
// lib/social/staleness.ts:triggerSocialSyncFireAndForget()

1. Acquire Redis lock (10 min TTL) to prevent duplicate syncs
2. If lock already held → skip (another sync in progress)
3. Fire POST to /api/social/sync-user (don't await)
4. Release lock when sync completes (in .finally())
```

### Why This Works

- **On Login:** Sync happens immediately after OAuth callback
- **Daily:** When user visits Sanctuary and loads insights, staleness is checked
- **No Cron Needed:** Sync piggybacks on user activity (insights load)

---

## D. Status Reflection Analysis

### How Settings Page Gets Status

```typescript
// app/(protected)/settings/page.tsx:305-321

useEffect(() => {
  const loadSocialStatus = async () => {
    const response = await fetch("/api/social/status");
    if (response.ok) {
      const data = await response.json();
      setSocialStatuses(data.connections || []);
    }
  };
  loadSocialStatus();
}, []);
```

### How Status Route Determines Connection State

```typescript
// app/api/social/status/route.ts

1. Get authenticated user (session-based)
2. Use SERVICE ROLE to read social_accounts (RLS blocks regular users)
3. Build status for each provider:
   - connected: Row exists with non-expired token
   - needs_reauth: Row exists but token expired
   - disconnected: No row exists
4. Return { connections: [...] }
```

### Why Status Might Not Reflect Correctly

1. **Service Role Key Missing** → Route returns 500, UI shows loading state
2. **Token Expired** → Shows "needs_reauth" but user thinks they're connected
3. **Race Condition** → User just connected but page loaded before DB updated

### Current Behavior

- If `/api/social/status` fails (500), Settings shows "Loading..." indefinitely
- The UI does NOT show an error state for failed status fetch
- User has no visibility into what went wrong

---

## E. Data Model

### social_accounts (Token Vault)

```sql
CREATE TABLE social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  provider text NOT NULL,
  external_user_id text,
  access_token text,           -- AES-256-GCM encrypted
  refresh_token text,          -- AES-256-GCM encrypted, nullable
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- RLS: service_role ONLY (users cannot read their own tokens)
```

### social_summaries

```sql
CREATE TABLE social_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles NOT NULL,
  provider text NOT NULL,
  summary text,                -- AI-generated analysis with embedded metadata
  posts_count int,
  window_days int DEFAULT 30,
  last_fetched_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- RLS: service_role ONLY
```

### social_identities (For Meta Data Deletion)

```sql
CREATE TABLE social_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  provider text NOT NULL,
  external_user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- RLS: service_role ONLY
-- NOTE: This mapping persists even if user disconnects (compliance)
```

### Profile Columns (Social-Related)

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  social_insights_enabled BOOLEAN NOT NULL DEFAULT false,
  social_insights_activated_at TIMESTAMPTZ DEFAULT NULL,
  social_connect_prompt_dismissed_at TIMESTAMPTZ DEFAULT NULL,
  last_social_sync_at TIMESTAMPTZ DEFAULT NULL,
  last_social_sync_local_date DATE DEFAULT NULL,
  social_sync_status TEXT DEFAULT NULL,
  social_sync_error TEXT DEFAULT NULL;
```

---

## F. Environment Variables Matrix

### Required for Social Login

| Variable | Used By | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | All clients | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client auth | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server routes | **CRITICAL** |
| `NEXT_PUBLIC_SITE_URL` | OAuth redirects | Yes |

### Required for TikTok

| Variable | Used By | Required |
|----------|---------|----------|
| `TIKTOK_CLIENT_KEY` | TikTok OAuth | Yes |
| `TIKTOK_CLIENT_SECRET` | TikTok OAuth | Yes |

### Required for Facebook/Meta

| Variable | Used By | Required |
|----------|---------|----------|
| `META_APP_ID` | Meta OAuth | Yes |
| `META_APP_SECRET` | Meta OAuth | Yes |

### Required for Social Insights

| Variable | Used By | Required |
|----------|---------|----------|
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | Token encryption | Yes |
| `CRON_SECRET` | Sync authorization | Yes |

### Optional (Feature Flags)

| Variable | Used By | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_X_OAUTH_ENABLED` | X OAuth toggle | false |
| `OAUTH_DEBUG_LOGS` | Debug logging | false |

---

## G. Provider Status Summary

| Provider | Login | Connect | Fetch Content | Notes |
|----------|-------|---------|---------------|-------|
| **Facebook** | Supabase | Working | Posts (50) | Via Meta Graph API |
| **Instagram** | N/A | Working | Captions (50) | Shares Meta credentials |
| **TikTok** | Custom | Working | Profile only | MVP: user.info.basic scope |
| **X** | Disabled | Disabled | Tweets (100) | $100/mo tier required |
| **Reddit** | N/A | UI disabled | Posts + Comments | Adapter exists, UI says "Coming Soon" |

### TikTok Content Limitation

```typescript
// lib/social/fetchers.ts:99-140

// MVP: Only request fields available with user.info.basic scope
// - display_name, avatar_url, open_id
// Future (after portal approval): username, bio_description, follower_count, etc.

const userResponse = await fetch(
  "https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url",
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
```

**Impact:** TikTok summaries have minimal content ("TikTok User: [display_name]"). This results in low `signalStrength` from the AI, which affects personalization quality.

---

## H. Health Issues & Cleanup Needs

### Critical Issues

| Issue | Impact | Fix |
|-------|--------|-----|
| **Missing service role key on dev.website** | All social features fail | Set correct key |

### Moderate Issues

| Issue | Impact | Fix |
|-------|--------|-----|
| TikTok minimal content | Low signal summaries | Get user.info.profile scope approved |
| No error state in Settings for failed status fetch | User sees "Loading..." forever | Add error handling UI |
| Instagram shares Facebook scopes | May need separate config | Review Meta app permissions |

### Low Priority Cleanup

| Item | Notes |
|------|-------|
| X adapter code | Works but disabled - keep for future |
| Reddit adapter | Complete but UI disabled - keep for future |
| Debug logging | Properly gated behind `OAUTH_DEBUG_LOGS` |

---

## I. Fix Plan (Prioritized)

### Phase 1: Unblock Dev Environment (BLOCKING)

**PR 1: Fix Service Role Key**

1. Go to Supabase Dashboard → Project Settings → API
2. Copy the `service_role` key (secret, not anon)
3. Set on dev.website hosting platform:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. Verify URL matches the same project:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://[same-project].supabase.co
   ```
5. Redeploy and test:
   ```bash
   curl https://dev.solarainsights.com/api/social/status
   # Should return 401 (no session) not 500 (invalid key)
   ```

### Phase 2: Verify OAuth Redirects

**PR 2: Audit Redirect URLs**

Check these are configured in provider dashboards:

**Supabase Dashboard:**
- Site URL: `https://dev.solarainsights.com`
- Redirect URLs:
  - `https://dev.solarainsights.com/auth/callback`
  - `https://dev.solarainsights.com/api/auth/login/tiktok/callback`
  - `https://dev.solarainsights.com/api/social/oauth/facebook/callback`
  - `https://dev.solarainsights.com/api/social/oauth/tiktok/callback`

**Meta Developer Console:**
- Valid OAuth Redirect URIs: Same as above

**TikTok Developer Portal:**
- Redirect URIs: TikTok-specific callbacks

### Phase 3: End-to-End Test

**PR 3: Verification Checklist**

After fixing service key:

| Test | Action | Expected |
|------|--------|----------|
| TikTok login | Click TikTok on sign-in | Session created, redirect to /join |
| Facebook login | Click Facebook on sign-in | Session created, redirect to /join |
| Social status | Visit /settings | Shows connected/disconnected correctly |
| TikTok connect | Click Connect in Settings | Redirects, returns with ?social=connected |
| Sync triggered | After connect | Summary appears in DB within 30s |
| Disconnect | Click disconnect toggle | Status changes to disconnected |

### Phase 4: Content Quality (Optional)

**Future PR: TikTok Scope Upgrade**

1. Apply for `user.info.profile` scope in TikTok Developer Portal
2. Wait for approval
3. Update `lib/oauth/providers/tiktok.ts`:
   ```typescript
   scopes: ["user.info.basic", "user.info.profile"],
   ```
4. Update `lib/social/fetchers.ts` to fetch bio_description, etc.

---

## J. Verification Checklist

### After Service Key Fix

- [ ] `GET /api/social/status` returns 401 when not logged in (not 500)
- [ ] `GET /api/social/status` returns 200 with connections when logged in
- [ ] Settings page shows correct connected/disconnected status
- [ ] No "Invalid API key" errors in server logs

### After OAuth Redirect Verification

- [ ] TikTok login completes without errors
- [ ] Facebook login completes without errors
- [ ] TikTok connect (Settings) completes with ?social=connected
- [ ] Facebook connect (Settings) completes with ?social=connected

### After Full E2E Test

- [ ] New user can sign up via TikTok
- [ ] New user can sign up via Facebook
- [ ] Existing user can connect TikTok for Social Insights
- [ ] Existing user can connect Facebook for Social Insights
- [ ] Sync fires after connection (check social_summaries table)
- [ ] Disconnect removes row from social_accounts
- [ ] Daily staleness check triggers sync (wait until next day or force)

---

## Appendix: Quick Reference

### Key Files for Debugging

```
# OAuth Debugging
OAUTH_DEBUG_LOGS=true  # In .env

# Key Files
app/api/auth/login/tiktok/callback/route.ts  # TikTok login
app/api/social/oauth/[provider]/callback/route.ts  # Social connect
app/api/social/status/route.ts  # Status check
lib/supabase/service.ts  # Service role client

# Error Messages
"Invalid API key" → SUPABASE_SERVICE_ROLE_KEY wrong/missing
"state_expired" → Cookie expired (>10 min) or SameSite issue
"needs_reauth" → Token expired or PKCE mismatch
```

### Database Queries for Debugging

```sql
-- Check connected accounts
SELECT user_id, provider, expires_at
FROM social_accounts
WHERE user_id = 'USER_UUID';

-- Check summaries
SELECT user_id, provider, posts_count, last_fetched_at
FROM social_summaries
WHERE user_id = 'USER_UUID';

-- Check identities (persists after disconnect)
SELECT * FROM social_identities
WHERE user_id = 'USER_UUID';

-- Check profile social columns
SELECT
  social_insights_enabled,
  social_insights_activated_at,
  last_social_sync_at,
  last_social_sync_local_date,
  social_sync_status,
  social_sync_error
FROM profiles
WHERE id = 'USER_UUID';
```

---

**End of Social Systems Audit**
