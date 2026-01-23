# Social Systems Audit - Flip-ON and Auto-Connect

**Date:** 2026-01-16
**Focus:** Verify auto-enable behavior, identify gaps, propose fixes

---

## Executive Summary

### Critical Finding: Facebook Login Does NOT Auto-Connect

| Provider | Login Flow | Auto-Store Tokens | Auto-Enable social_insights | Auto-Trigger Sync |
|----------|------------|-------------------|-----------------------------|--------------------|
| TikTok | Custom callback | **Yes** (if consent) | **Yes** (if consent) | **Yes** (if consent) |
| Facebook | Supabase OAuth | **NO** | **NO** | **NO** |

**Root Cause:** Supabase OAuth doesn't expose raw access tokens to our callback. Facebook users must manually connect via Settings.

---

## A. Full Social Inventory

### Routes - Login Flows

| File | Provider | Purpose |
|------|----------|---------|
| [app/api/auth/login/tiktok/route.ts](app/api/auth/login/tiktok/route.ts) | TikTok | Initiate login |
| [app/api/auth/login/tiktok/callback/route.ts](app/api/auth/login/tiktok/callback/route.ts) | TikTok | Complete login, mint session, store tokens |
| [app/auth/callback/route.ts](app/auth/callback/route.ts) | Facebook | Supabase OAuth callback (NO token access) |

### Routes - Social Insights Connect (Post-Login)

| File | Purpose |
|------|---------|
| [app/api/social/oauth/[provider]/connect/route.ts](app/api/social/oauth/[provider]/connect/route.ts) | Initiate connect from Settings |
| [app/api/social/oauth/[provider]/callback/route.ts](app/api/social/oauth/[provider]/callback/route.ts) | Complete connect, store tokens, enable social_insights |
| [app/api/social/status/route.ts](app/api/social/status/route.ts) | Get connection status for Settings UI |
| [app/api/social/sync/route.ts](app/api/social/sync/route.ts) | Sync single provider (CRON protected) |
| [app/api/social/sync-user/route.ts](app/api/social/sync-user/route.ts) | Sync all providers for user |
| [app/api/social/revoke/route.ts](app/api/social/revoke/route.ts) | Disconnect provider |

### Libraries

| File | Purpose |
|------|---------|
| [lib/social/oauth.ts](lib/social/oauth.ts) | OAuth orchestration |
| [lib/social/fetchers.ts](lib/social/fetchers.ts) | Content fetchers per provider |
| [lib/social/summarize.ts](lib/social/summarize.ts) | AI summary generation |
| [lib/social/staleness.ts](lib/social/staleness.ts) | Daily refresh detection |
| [lib/social/socialRateLimit.ts](lib/social/socialRateLimit.ts) | Rate limiting (5/day) |
| [lib/social/crypto.ts](lib/social/crypto.ts) | Token encryption |
| [lib/oauth/pkce.ts](lib/oauth/pkce.ts) | PKCE helpers |
| [lib/oauth/providers/*.ts](lib/oauth/providers/) | Provider adapters |

### Settings UI

| File | Purpose |
|------|---------|
| [app/(protected)/settings/page.tsx](app/(protected)/settings/page.tsx) | Settings page with Social Insights section |

**Status fetch:** Lines 305-321 - fetches `/api/social/status` on mount
**Connect handler:** Lines 329-331 - redirects to `/api/social/oauth/{provider}/connect`

---

## B. Exact "Flip ON" Trace

### TikTok Login Flow (WORKING)

```
User clicks TikTok button on /sign-in
    ↓
/api/auth/login/tiktok (initiate)
    ↓
TikTok OAuth authorization
    ↓
/api/auth/login/tiktok/callback (lines 25-385)
    │
    ├─ Token exchange (line 132)
    ├─ User lookup/create (lines 153-216)
    │
    ├─ IF hasConsent (lines 238-282):
    │   ├─ Store tokens in social_accounts (line 248-258) ✅
    │   ├─ Set social_insights_enabled = true (line 269-279) ✅
    │   └─ Trigger sync (lines 331-346) ✅
    │
    └─ Mint session and redirect
```

**Consent dependency:** Line 110-112 checks `oauth_consent_tiktok` cookie.
Without consent, tokens are NOT stored and social_insights is NOT enabled.

### Facebook Login Flow (BROKEN - No Auto-Connect)

```
User clicks Facebook button on /sign-in
    ↓
signInWithOAuth({ provider: 'facebook' })
    ↓
Facebook OAuth via Supabase
    ↓
Supabase callback (internal)
    ↓
/auth/callback (lines 50-268)
    │
    ├─ Exchange code for session (line 71)
    ├─ Create profile if new (lines 102-126)
    │   └─ social_insights_enabled: false (line 114) ❌
    │
    ├─ NO token storage in social_accounts ❌
    ├─ NO social_insights enable ❌
    └─ NO sync trigger ❌
```

**Why:** Supabase manages Facebook OAuth internally. Our callback receives a session, NOT raw tokens. We cannot store tokens we don't have.

### Social Insights Connect Flow (WORKING)

```
User clicks Connect in Settings
    ↓
/api/social/oauth/{provider}/connect
    ↓
Provider OAuth authorization
    ↓
/api/social/oauth/{provider}/callback (lines 60-377)
    │
    ├─ Token exchange (line 240)
    ├─ Store encrypted tokens (lines 274-288) ✅
    ├─ Set social_insights_enabled = true (lines 327-342) ✅
    └─ Trigger sync (lines 346-358) ✅
```

---

## C. Status Truth Model

### Single Source of Truth

**Connected = row exists in `social_accounts` with valid `access_token`**

### Database Columns

```sql
-- social_accounts (token vault)
user_id       UUID    -- FK to profiles
provider      TEXT    -- facebook, tiktok, etc.
access_token  TEXT    -- AES-256-GCM encrypted
expires_at    TIMESTAMPTZ  -- Token expiry

-- profiles (flags)
social_insights_enabled      BOOLEAN  -- Feature toggle
social_insights_activated_at TIMESTAMPTZ  -- First activation
```

### Status Computation

[app/api/social/status/route.ts:82-101](app/api/social/status/route.ts#L82-L101):

```typescript
const isConnected = !!account;  // Row exists in social_accounts
const expiresAt = account?.expires_at || null;
const needsReauth = isConnected && expiresAt ? new Date(expiresAt) < now : false;

return {
  status: isConnected ? (needsReauth ? "needs_reauth" : "connected") : "disconnected",
  hasSummary: providersWithSummaries.has(provider),
};
```

### What Settings Displays

| DB State | UI Shows |
|----------|----------|
| No row in social_accounts | "Disconnected" + Connect button |
| Row exists, token valid | "Connected" |
| Row exists, token expired | "Needs Reauth" + Reconnect button |

---

## D. Summary Generation Requirements

### Current Triggers

| Trigger | Location | Condition |
|---------|----------|-----------|
| On TikTok login | [login/tiktok/callback:331-346](app/api/auth/login/tiktok/callback/route.ts#L331-L346) | IF hasConsent |
| On Social Connect | [social/oauth/callback:346-358](app/api/social/oauth/[provider]/callback/route.ts#L346-L358) | Always |
| Daily piggyback | [insights/route.ts:206-216](app/api/insights/route.ts#L206-L216) | IF stale |

### Empty Content Handling

[app/api/social/sync/route.ts:183-191](app/api/social/sync/route.ts#L183-L191):

```typescript
if (!fetchedContent.content || fetchedContent.content.length < 100) {
  return NextResponse.json({
    success: true,
    message: "Insufficient content for summary",
    postCount: fetchedContent.postCount,
  });
}
```

**Gap:** No summary row is created when content is empty.
**Impact:** `hasSummary: false` in status even though user is connected.

### Idempotency

| Operation | Idempotent? | How |
|-----------|-------------|-----|
| Token upsert | Yes | `onConflict: "user_id,provider"` |
| Summary upsert | Yes | `onConflict: "user_id,provider"` |
| Daily sync | Yes | Redis lock (10 min TTL) |

---

## E. Identified Gaps

### Gap 1: Facebook Login Does NOT Auto-Connect

**Symptom:** User logs in with Facebook, Settings shows "Disconnected".

**Root Cause:** Supabase OAuth doesn't expose raw tokens to our callback.

**Impact:** Facebook users must click Connect in Settings separately.

**Possible Solutions:**

| Option | Effort | Notes |
|--------|--------|-------|
| A. Accept current behavior | Zero | Document that FB login ≠ FB connect |
| B. Prompt user post-login | Low | Show modal: "Connect Facebook for Social Insights?" |
| C. Use custom FB OAuth | High | Bypass Supabase, manage tokens ourselves |

**Recommendation:** Option B - Add post-login prompt for Facebook users.

### Gap 2: TikTok Requires Consent Cookie

**Symptom:** TikTok login without consent cookie doesn't auto-connect.

**Root Cause:** [login/tiktok/callback:238](app/api/auth/login/tiktok/callback/route.ts#L238) checks `hasConsent`.

**Current Behavior:** Consent cookie is set by client before OAuth redirect.

**Risk:** If cookie is blocked (SameSite, browser settings), auto-connect fails silently.

### Gap 3: No Summary Row for Empty Content

**Symptom:** Connected user shows `hasSummary: false` if no posts.

**Root Cause:** Sync returns early without creating summary row.

**Impact:** UI can't distinguish "syncing" from "no content available".

### Gap 4: No Returning User Re-Sync

**Symptom:** Returning TikTok user gets no sync on login.

**Root Cause:** Consent cookie may not persist across sessions.

**Code:** [login/tiktok/callback:331](app/api/auth/login/tiktok/callback/route.ts#L331) - sync only if `hasConsent`.

---

## F. Security Verification

### social_summaries is Service-Role Only

[supabase/migrations/20260108170752_lock_down_sensitive_tables.sql:17-36](supabase/migrations/20260108170752_lock_down_sensitive_tables.sql#L17-L36):

```sql
CREATE POLICY "Service role can manage social summaries"
ON public.social_summaries
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.social_summaries FROM anon, authenticated;
GRANT ALL ON TABLE public.social_summaries TO service_role;
```

**Verified:** Users cannot read their own summaries.

### Status API Returns Metadata Only

[app/api/social/status/route.ts:43-46](app/api/social/status/route.ts#L43-L46):

```typescript
const { data: accounts } = await serviceSupabase
  .from("social_accounts")
  .select("provider, expires_at")  // Never selects access_token or summary
  .eq("user_id", user.id);
```

**Verified:** No tokens or summary text exposed to client.

---

## G. Fix Plan (3 PRs)

### PR 1: Auto-Sync for Returning TikTok Users

**Problem:** Returning users don't get daily sync triggered on login.

**Files to modify:**
- `app/api/auth/login/tiktok/callback/route.ts`

**Changes:**
```typescript
// After line 282, add:
// ALWAYS trigger sync for returning users if they have connected accounts
if (!isNewUser) {
  const { count } = await admin
    .from("social_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("provider", "tiktok");

  if (count && count > 0) {
    // Trigger sync (fire and forget)
    fetch(`${baseUrl}/api/social/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ userId, provider: "tiktok" }),
    }).catch(console.error);
  }
}
```

**Definition of Done:**
- [ ] Returning TikTok user triggers sync on login
- [ ] Logs show `[SocialSync] Starting sync for user...`

**Verification:**
```bash
# 1. Login as existing TikTok user
# 2. Check server logs for:
grep "SocialSync.*Starting sync" logs.txt
```

### PR 2: Post-Login Connect Prompt for Facebook Users

**Problem:** Facebook users don't know they need to connect separately.

**Files to modify:**
- `app/auth/post-callback/page.tsx` (or create new)
- `app/(protected)/sanctuary/page.tsx`

**Changes:**
Add a modal/banner after Facebook login:

```tsx
// Check if user logged in via Facebook but isn't connected
const { data: profile } = await supabase
  .from("profiles")
  .select("social_insights_enabled")
  .eq("id", user.id)
  .single();

const identities = user.identities || [];
const isFacebookUser = identities.some(i => i.provider === "facebook");

if (isFacebookUser && !profile?.social_insights_enabled) {
  // Show connect prompt
}
```

**Definition of Done:**
- [ ] Facebook login users see "Connect for Social Insights" prompt
- [ ] Clicking prompt redirects to `/api/social/oauth/facebook/connect`
- [ ] After connect, prompt doesn't show again

### PR 3: Create Placeholder Summary for Empty Content

**Problem:** Connected users with no posts show `hasSummary: false`.

**Files to modify:**
- `app/api/social/sync/route.ts`

**Changes:**
```typescript
// Replace lines 183-191 with:
if (!fetchedContent.content || fetchedContent.content.length < 100) {
  console.log(`[SocialSync] Insufficient content for ${provider} (${fetchedContent.postCount} posts)`);

  // Create placeholder summary so status shows hasSummary: true
  await supabase
    .from("social_summaries")
    .upsert(
      {
        user_id: userId,
        provider,
        summary: "<!-- LOW_SIGNAL -->\nInsufficient content for personalization. User has limited public posts.",
        posts_count: fetchedContent.postCount,
        window_days: 30,
        last_fetched_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

  return NextResponse.json({
    success: true,
    message: "Low signal summary created",
    postCount: fetchedContent.postCount,
  });
}
```

**Definition of Done:**
- [ ] Connected user with no posts shows `hasSummary: true`
- [ ] Summary contains `<!-- LOW_SIGNAL -->` marker
- [ ] Tone layer handles low-signal gracefully

**Verification:**
```sql
SELECT user_id, provider, summary
FROM social_summaries
WHERE summary LIKE '%LOW_SIGNAL%';
```

---

## H. Verification Commands

### Check Connected Status

```bash
curl -s https://solarainsights.com/api/social/status \
  -H "Cookie: sb-xxx=..." | jq '.connections'
```

### Check Social Accounts

```sql
SELECT user_id, provider, expires_at, created_at
FROM social_accounts
ORDER BY created_at DESC
LIMIT 10;
```

### Check Summaries

```sql
SELECT
  user_id,
  provider,
  posts_count,
  last_fetched_at,
  CASE WHEN summary LIKE '%LOW_SIGNAL%' THEN 'low_signal' ELSE 'full' END AS signal
FROM social_summaries
ORDER BY last_fetched_at DESC
LIMIT 10;
```

### Check Profile Flags

```sql
SELECT
  id,
  social_insights_enabled,
  social_insights_activated_at,
  last_social_sync_local_date
FROM profiles
WHERE id = 'USER_UUID';
```

### Simulate Daily Sync

```sql
-- Clear last sync date
UPDATE profiles
SET last_social_sync_local_date = NULL
WHERE id = 'USER_UUID';

-- Visit Sanctuary, then check logs for:
-- [SocialStaleness] Triggering fire-and-forget sync
```

---

**End of Audit**
