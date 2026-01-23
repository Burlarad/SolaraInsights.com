# Social Media + Social Insights Audit

**Date:** 2026-01-14
**Focus:** Complete audit of social login, OAuth pipelines, and Social Insights feature

---

## A. How Social Works Today

### Authentication vs Social Insights: Two Separate Flows

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          AUTHENTICATION FLOW                            │
│   (User identity - "who is this person?")                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────┐    OAuth     ┌──────────────┐    Session    ┌─────────┐ │
│   │ Sign-In  │ ──────────▶  │  Callback    │ ──────────▶   │ Profile │ │
│   │  Page    │              │  Route       │               │  Page   │ │
│   └──────────┘              └──────────────┘               └─────────┘ │
│                                                                         │
│   Facebook: Supabase OAuth (/auth/callback)                            │
│   TikTok:   Custom OAuth (/api/auth/login/tiktok/callback)             │
│                                                                         │
│   Uses: ANON KEY (client) + SERVICE ROLE KEY (server callbacks)        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       SOCIAL INSIGHTS FLOW                              │
│   (Content sync - "what have they posted?")                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────┐   Connect   ┌──────────────┐    Sync     ┌───────────┐  │
│   │ Settings │ ─────────▶  │ OAuth Flow   │ ─────────▶  │ Summary   │  │
│   │   UI     │             │ + Token Vault│             │ Generated │  │
│   └──────────┘             └──────────────┘             └───────────┘  │
│                                   │                           │        │
│                                   ▼                           ▼        │
│                            social_accounts            social_summaries │
│                            (encrypted tokens)         (AI analysis)    │
│                                                                         │
│   Uses: SERVICE ROLE KEY for ALL database operations                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Provider-Specific Flows

#### Facebook (via Supabase OAuth)

| Step | Route | Key Used |
|------|-------|----------|
| 1. Sign-in button | Client-side `signInWithOAuth` | ANON KEY |
| 2. OAuth redirect | Facebook → Supabase | (external) |
| 3. Callback | `/auth/callback` | ANON KEY (cookies) |
| 4. Status check | `/api/social/status` | **SERVICE ROLE KEY** |
| 5. Connect for insights | `/api/social/oauth/facebook/connect` | **SERVICE ROLE KEY** |
| 6. Callback | `/api/social/oauth/facebook/callback` | **SERVICE ROLE KEY** |

#### TikTok (Custom OAuth)

| Step | Route | Key Used |
|------|-------|----------|
| 1. Sign-in button | Redirect to `/api/auth/login/tiktok` | None |
| 2. OAuth redirect | TikTok | (external) |
| 3. Callback | `/api/auth/login/tiktok/callback` | **SERVICE ROLE KEY** |
| 4. Status check | `/api/social/status` | **SERVICE ROLE KEY** |
| 5. Sync | `/api/social/sync` | **SERVICE ROLE KEY** |

---

## B. What's Complete vs What's Missing

### ✅ Complete

| Component | Evidence |
|-----------|----------|
| Facebook auth | [sign-in/page.tsx:125](app/(auth)/sign-in/page.tsx#L125) - `signInWithOAuth` |
| TikTok auth | [login/tiktok/callback/route.ts](app/api/auth/login/tiktok/callback/route.ts) - Full flow |
| OAuth PKCE | [lib/oauth/pkce.ts](lib/oauth/pkce.ts) - S256 for all providers |
| Token encryption | [lib/social/crypto.ts](lib/social/crypto.ts) - AES-256-GCM |
| Social accounts vault | [social_accounts table](supabase/migrations/20260108170752_lock_down_sensitive_tables.sql) - RLS service_role |
| Social summaries | [social_summaries table](supabase/migrations/20260108170752_lock_down_sensitive_tables.sql) - RLS service_role |
| Content fetchers | [lib/social/fetchers.ts](lib/social/fetchers.ts) - TikTok + Meta |
| AI summarization | [lib/social/summarize.ts](lib/social/summarize.ts) - GPT-4o-mini |
| Sync pipeline | [/api/social/sync](app/api/social/sync/route.ts) - Cron-protected |
| Status endpoint | [/api/social/status](app/api/social/status/route.ts) - For Settings UI |
| Revoke flow | [/api/social/revoke](app/api/social/revoke/route.ts) - Disconnect |

### ⚠️ Partially Complete

| Component | Status | Evidence |
|-----------|--------|----------|
| X (Twitter) | Disabled | `X_OAUTH_ENABLED=false` - $100/mo tier required |
| Reddit | Stub only | [sign-in/page.tsx:202](app/(auth)/sign-in/page.tsx#L202) - "Coming soon" |
| Instagram | Config present | Shares Meta credentials but may need separate scopes |

### ❌ Missing / Not Working

| Component | Issue |
|-----------|-------|
| **Dev.website service role** | `Invalid API key` - SERVICE ROLE KEY missing/wrong |
| Settings UI enable toggle | Fails because `/api/social/status` 500s |
| Cron social sync | Never triggers (status check fails first) |

---

## C. What's Broken Right Now

### Root Cause: `Invalid API key` on Server Routes

**Symptom:** Client login works, but Social Insights features fail.

**Evidence from terminal:**
```
/api/social/status 500 - Invalid API key
/api/auth/login/tiktok/callback - Invalid API key (when creating user)
```

### Why Client Login Works But Server Routes Fail

```
CLIENT SIDE (works)
├─ Uses: NEXT_PUBLIC_SUPABASE_URL
├─ Uses: NEXT_PUBLIC_SUPABASE_ANON_KEY
└─ Result: Can authenticate, read public data

SERVER SIDE (fails)
├─ Uses: NEXT_PUBLIC_SUPABASE_URL
├─ Uses: SUPABASE_SERVICE_ROLE_KEY  ← THIS IS THE PROBLEM
└─ Result: "Invalid API key"
```

### Root Cause Candidates (Ordered by Likelihood)

#### 1. **SUPABASE_SERVICE_ROLE_KEY Missing on Dev.website** (Most Likely)

The hosting platform for dev.website doesn't have `SUPABASE_SERVICE_ROLE_KEY` set.

**Verification:**
```bash
# On dev.website hosting platform, check if this exists:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 2. **Key/URL Mismatch**

The service role key is from a **different Supabase project** than the URL.

**Example of mismatch:**
```env
# URL points to prod project
NEXT_PUBLIC_SUPABASE_URL=https://abc123.supabase.co

# But service key is from dev project (different project!)
SUPABASE_SERVICE_ROLE_KEY=eyJ...from_xyz789_project...
```

#### 3. **Wrong Key Type**

Using the anon key where service role is expected.

**Supabase key types:**
- `eyJ...` starting with `anon` role claim = ANON KEY
- `eyJ...` starting with `service_role` role claim = SERVICE ROLE KEY

#### 4. **Environment Variable Naming**

Variable named differently on hosting platform.

**Check for:**
- `SUPABASE_SERVICE_KEY` (wrong name)
- `SUPABASE_SERVICE_ROLE_KEY` (correct name)

---

## D. Fix Plan (PR-Sized Chunks)

### PR 1: Fix Dev.website Service Role Key (BLOCKING)

**Goal:** Make `/api/social/status` return 200 instead of 500.

**Steps:**

1. **Get correct service role key:**
   - Go to Supabase Dashboard → Project Settings → API
   - Copy the `service_role` key (the secret one, not anon)

2. **Set on dev.website hosting:**
   ```env
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Verify URL matches:**
   ```env
   # Both must be from the SAME Supabase project
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<key from same project>
   ```

4. **Redeploy and test:**
   ```bash
   curl https://dev.solarainsights.com/api/social/status
   # Should return 401 (Unauthorized) not 500 (Invalid API key)
   ```

### PR 2: Verify OAuth Redirect URLs

**Goal:** Facebook and TikTok OAuth complete without errors.

**Supabase Dashboard:**
- Site URL: `https://dev.solarainsights.com`
- Redirect URLs:
  - `https://dev.solarainsights.com/auth/callback`
  - `https://dev.solarainsights.com/api/auth/login/tiktok/callback`
  - `https://dev.solarainsights.com/api/social/oauth/facebook/callback`
  - `https://dev.solarainsights.com/api/social/oauth/tiktok/callback`

**Meta Developer Console:**
- Valid OAuth Redirect URIs: (same as above)

**TikTok Developer Portal:**
- Redirect URIs: (TikTok-specific ones)

### PR 3: Enable Social Insights Toggle

**Goal:** User can enable Social Insights in Settings.

**After PR 1 + PR 2:**
1. Sign in via Facebook or TikTok
2. Go to Settings → Social Insights
3. Toggle should now work (status endpoint returns data)

### PR 4: Test Sync Pipeline

**Goal:** Social content is fetched and summarized.

**Manual test:**
```bash
curl -X POST https://dev.solarainsights.com/api/social/sync \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid", "provider": "tiktok"}'
```

---

## E. Verification Checklist

### After PR 1 (Service Role Key Fixed)

| Test | Endpoint | Expected |
|------|----------|----------|
| Status check | `GET /api/social/status` | 401 (not 500) when not logged in |
| Status check (logged in) | `GET /api/social/status` | 200 with connections array |

### After PR 2 (OAuth Redirect URLs)

| Test | Action | Expected |
|------|--------|----------|
| Facebook login | Click Facebook button | Redirects to FB → back to app |
| TikTok login | Click TikTok button | Redirects to TikTok → back to app |
| Facebook connect | Settings → Connect Facebook | Returns with `social=connected` |

### After PR 3 (Social Insights Toggle)

| Test | Action | Expected |
|------|--------|----------|
| Enable toggle | Settings → Social Insights → Enable | Toggle turns on |
| Status shows connected | Refresh settings | Provider shows "connected" |

### After PR 4 (Sync Pipeline)

| Test | Action | Expected |
|------|--------|----------|
| Manual sync | POST to /api/social/sync | 200 with `postCount` |
| Summary generated | Check social_summaries table | Row exists for user+provider |
| UI shows insights | View in app | Summary displayed |

---

## Appendix: Route Inventory

### Social Routes (`app/api/social/*`)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/social/status` | GET | User session | Get all provider statuses |
| `/api/social/sync` | POST | CRON_SECRET | Trigger sync for user+provider |
| `/api/social/sync-user` | POST | CRON_SECRET | Sync all providers for user |
| `/api/social/revoke` | POST | User session | Disconnect a provider |
| `/api/social/oauth/[provider]/connect` | GET | User session | Start OAuth for Social Insights |
| `/api/social/oauth/[provider]/callback` | GET | OAuth state | Complete OAuth, store tokens |

### Auth Routes (`app/api/auth/*`)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/login/tiktok` | GET | None | Start TikTok OAuth for login |
| `/api/auth/login/tiktok/callback` | GET | OAuth state | Complete TikTok login |
| `/api/auth/login/x` | GET | None | Start X OAuth (disabled) |
| `/api/auth/login/x/callback` | GET | OAuth state | Complete X login |
| `/api/auth/reauth/prepare` | POST | User session | Start reauth flow |
| `/api/auth/reauth/tiktok/callback` | GET | OAuth state | Complete TikTok reauth |
| `/api/auth/reauth/x/callback` | GET | OAuth state | Complete X reauth |
| `/auth/callback` | GET | OAuth code | Supabase OAuth callback (Facebook) |

---

## Appendix: Data Model

### social_accounts (Token Vault)

| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | FK to profiles |
| provider | text | facebook, tiktok, etc. |
| external_user_id | text | Provider's user ID |
| access_token | text | Encrypted (AES-256-GCM) |
| refresh_token | text | Encrypted, nullable |
| expires_at | timestamptz | Token expiry |

**RLS:** `service_role` only (users cannot read their own tokens)

### social_summaries

| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | FK to profiles |
| provider | text | Source provider |
| summary | text | AI-generated analysis |
| posts_count | int | Posts analyzed |
| window_days | int | Time window |
| last_fetched_at | timestamptz | Last sync time |

**RLS:** `service_role` only

### social_identities

| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | FK to auth.users |
| provider | text | OAuth provider |
| external_user_id | text | Provider's user ID |

**RLS:** `service_role` only

---

## Appendix: Environment Variables Required

### For Social Login to Work

```env
# Supabase (all environments)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...anon...
SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...  # ← CRITICAL

# Site URL (must match current domain)
NEXT_PUBLIC_SITE_URL=https://dev.solarainsights.com

# Meta (Facebook)
META_APP_ID=123456789
META_APP_SECRET=abc123...

# TikTok
TIKTOK_CLIENT_KEY=abc123
TIKTOK_CLIENT_SECRET=xyz789

# Token encryption
SOCIAL_TOKEN_ENCRYPTION_KEY=base64-32-bytes

# For sync pipeline
CRON_SECRET=random-secret
```

### Checklist for Dev.website

- [ ] `NEXT_PUBLIC_SUPABASE_URL` set (same project as service key)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set (from same project)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (from same project) ← **Check this!**
- [ ] `NEXT_PUBLIC_SITE_URL` = `https://dev.solarainsights.com`
- [ ] `META_APP_ID` + `META_APP_SECRET` set
- [ ] `TIKTOK_CLIENT_KEY` + `TIKTOK_CLIENT_SECRET` set
- [ ] `SOCIAL_TOKEN_ENCRYPTION_KEY` set
- [ ] `CRON_SECRET` set

---

**End of Social Audit Report**
