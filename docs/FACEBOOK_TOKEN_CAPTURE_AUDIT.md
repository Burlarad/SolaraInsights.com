# Facebook/Meta Token Capture Audit

**Date:** 2026-01-16
**Goal:** Explain why Facebook tokens aren't captured and propose quiet auto-connect

---

## A. All Facebook OAuth Paths

### Path 1: Supabase-Managed Facebook Login

```
User clicks Facebook → sign-in/page.tsx:125
         ↓
supabase.auth.signInWithOAuth({ provider: 'facebook' })
         ↓
Facebook OAuth (Supabase proxy)
         ↓
/auth/callback (server route)
         ↓
exchangeCodeForSession(code) → returns session
         ↓
/auth/post-callback (client page)
         ↓
IF consent → redirect to /api/social/oauth/facebook/connect
         ↓
(Second OAuth flow - see Path 2)
```

**Files:**
- [app/(auth)/sign-in/page.tsx:125-128](app/(auth)/sign-in/page.tsx#L125-L128) - signInWithOAuth call
- [app/auth/callback/route.ts:71](app/auth/callback/route.ts#L71) - exchangeCodeForSession
- [app/auth/post-callback/page.tsx:88-124](app/auth/post-callback/page.tsx#L88-L124) - auto-connect redirect

### Path 2: Custom Meta Connect (Social Insights)

```
User clicks Connect in Settings
         ↓
/api/social/oauth/facebook/connect
         ↓
Redirect to Facebook with OUR client_id, PKCE
         ↓
Facebook OAuth (direct to our app)
         ↓
/api/social/oauth/facebook/callback
         ↓
exchangeCodeForTokens() → returns raw access_token
         ↓
encryptToken() → store in social_accounts
```

**Files:**
- [app/api/social/oauth/[provider]/connect/route.ts](app/api/social/oauth/[provider]/connect/route.ts) - initiate
- [app/api/social/oauth/[provider]/callback/route.ts:240](app/api/social/oauth/[provider]/callback/route.ts#L240) - token exchange
- [lib/social/oauth.ts](lib/social/oauth.ts) - exchangeCodeForTokens
- [lib/oauth/providers/meta.ts](lib/oauth/providers/meta.ts) - Facebook adapter

---

## B. Supabase Session Token Behavior

### What Supabase Returns

When `exchangeCodeForSession(code)` completes, Supabase returns:

```typescript
{
  data: {
    user: User,
    session: {
      access_token: string,      // Supabase JWT (NOT Facebook token)
      refresh_token: string,     // Supabase refresh token
      provider_token?: string,   // Facebook access token (TRANSIENT!)
      provider_refresh_token?: string, // Facebook refresh (FB doesn't support)
      expires_at: number,
    }
  },
  error: null
}
```

### Critical Finding: `provider_token` is Transient

**Supabase behavior:**
- `provider_token` is ONLY available immediately after `exchangeCodeForSession`
- It is NOT persisted in the Supabase session
- It is NOT returned by subsequent `getSession()` or `getUser()` calls
- It disappears after the callback response completes

**Evidence:** Supabase docs state:
> "The provider_token is returned only on the initial session creation... you must persist this token yourself if needed."

### Where We Read Session (Code References)

| Location | Method | provider_token Available? |
|----------|--------|---------------------------|
| [auth/callback/route.ts:71](app/auth/callback/route.ts#L71) | `exchangeCodeForSession` | **YES** (only here!) |
| [lib/supabase/server.ts](lib/supabase/server.ts) | `createServerSupabaseClient` | NO |
| [lib/supabase/client.ts](lib/supabase/client.ts) | `createClientSupabaseClient` | NO |
| Any `getUser()` call | `supabase.auth.getUser()` | NO |

### Current Code: provider_token is Ignored

[app/auth/callback/route.ts:71](app/auth/callback/route.ts#L71):

```typescript
const { data, error } = await supabase.auth.exchangeCodeForSession(code);

// data.session.provider_token EXISTS HERE but we never capture it!

console.log(`[AuthCallback] Session established for user: ${data.user?.id}`);
// Only uses data.user, never data.session.provider_token
```

---

## C. Why Tokens Don't Land in social_accounts

### Call Graph

```
signInWithOAuth('facebook')
         ↓
[Supabase handles OAuth internally]
         ↓
/auth/callback
    ├── exchangeCodeForSession(code) ← provider_token available HERE
    ├── Create profile if new
    ├── Claim checkout session
    └── Redirect to /auth/post-callback
                    ↓
           /auth/post-callback
                ├── Check consent
                ├── Check if already connected
                └── IF consent && !connected:
                        window.location.href = /api/social/oauth/facebook/connect
                                    ↓
                           [SECOND OAuth flow starts]
                                    ↓
                           Provider token captured HERE
```

### Root Cause: Token Not Captured in First OAuth Flow

**Location of bug:** [app/auth/callback/route.ts:71-88](app/auth/callback/route.ts#L71-L88)

```typescript
const { data, error } = await supabase.auth.exchangeCodeForSession(code);

// BUG: data.session.provider_token is available but NOT captured!
// We SHOULD:
// 1. Check if provider_token exists
// 2. If consent cookie present, store it in social_accounts
// 3. Enable social_insights_enabled
// 4. Trigger sync

console.log(`[AuthCallback] Session established for user: ${data.user?.id}`);
```

### Why Second OAuth Flow is Needed Today

Because we don't capture `provider_token` in `/auth/callback`, the current architecture requires a second OAuth flow:

1. First OAuth: Supabase login (token discarded)
2. Second OAuth: Custom connect flow (token captured)

This causes:
- Double OAuth consent dialogs for user
- Slower onboarding experience
- Confusing UX

---

## D. Architecture Options

### Option 1: Capture provider_token in /auth/callback (Recommended)

**How it works:**
```
signInWithOAuth('facebook')
         ↓
/auth/callback
    ├── exchangeCodeForSession(code)
    ├── IF provider_token exists AND consent cookie:
    │       ├── Encrypt provider_token
    │       ├── Upsert to social_accounts
    │       ├── Set social_insights_enabled = true
    │       └── Trigger sync (fire-and-forget)
    └── Redirect to destination (no second OAuth needed)
```

**Pros:**
- Single OAuth flow
- Token captured server-side (secure)
- Best UX - no repeated prompts
- Works with existing consent system

**Cons:**
- Requires Supabase to pass through scopes we need (`user_posts`)
- Supabase may request different scopes than our custom flow

**Security:**
- Token encrypted at rest (AES-256-GCM)
- Never logged or sent to client
- Service-role only access to social_accounts

**Changes needed:**
1. Modify `/auth/callback` to check for `provider_token`
2. Add `encryptToken` and upsert to `social_accounts`
3. Set `social_insights_enabled` on profile
4. Trigger sync

### Option 2: Keep Two OAuth Flows But Make Seamless

**How it works:**
```
signInWithOAuth('facebook')
         ↓
/auth/callback → session established
         ↓
/auth/post-callback
    └── IF consent → silent redirect to /api/social/oauth/facebook/connect
                         ↓
                 Second OAuth (user may see FB prompt again)
                         ↓
                 /api/social/oauth/facebook/callback → tokens stored
```

**Pros:**
- No changes to Supabase setup
- Already implemented (current behavior)
- Guaranteed to get exact scopes we need

**Cons:**
- User sees two OAuth prompts (bad UX)
- Slower flow
- More complex state management

**Security:**
- Same as Option 1 (encrypted, service-role only)

---

## E. Token Durability and Refresh

### Facebook Token Behavior

| Token Type | Lifetime | Refresh? |
|------------|----------|----------|
| Short-lived | ~2 hours | Yes (exchange for long-lived) |
| Long-lived | ~60 days | Yes (extend before expiry) |

**Source:** [lib/oauth/providers/meta.ts:91](lib/oauth/providers/meta.ts#L91):
```typescript
supportsRefreshToken: false, // FB uses long-lived tokens instead
```

### Token Exchange for Long-Lived

Facebook requires a server-side call to exchange short-lived tokens:

```
GET https://graph.facebook.com/v18.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={app-id}
  &client_secret={app-secret}
  &fb_exchange_token={short-lived-token}
```

**Returns:** Long-lived token (~60 days)

### Current Implementation

- [lib/social/oauth.ts](lib/social/oauth.ts) has `refreshAccessToken` but it throws for Facebook
- [lib/oauth/providers/meta.ts:128-131](lib/oauth/providers/meta.ts#L128-L131):
  ```typescript
  buildRefreshRequestBody() {
    throw new Error("Facebook does not support refresh tokens");
  }
  ```

### Recommendation: Add Long-Lived Token Exchange

After capturing `provider_token`, exchange for long-lived:

```typescript
async function exchangeForLongLivedToken(shortToken: string): Promise<string> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?` +
    `grant_type=fb_exchange_token&` +
    `client_id=${process.env.META_APP_ID}&` +
    `client_secret=${process.env.META_APP_SECRET}&` +
    `fb_exchange_token=${shortToken}`
  );

  const data = await response.json();
  return data.access_token; // Long-lived (~60 days)
}
```

---

## F. Implementation Plan

### PR 1: Capture provider_token in /auth/callback

**Files to modify:**
- `app/auth/callback/route.ts`

**Code changes:**

```typescript
// After line 71: const { data, error } = await supabase.auth.exchangeCodeForSession(code);

// --- START: Facebook provider_token capture ---
const providerToken = data.session?.provider_token;
const providerRefreshToken = data.session?.provider_refresh_token;

// Check if this is a Facebook OAuth and we have consent
const cookieStore = await cookies();
const fbConsentCookie = cookieStore.get("oauth_consent_facebook");
const hasConsent = fbConsentCookie?.value === "true";

if (providerToken && hasConsent && data.user) {
  const provider = data.user.app_metadata?.provider ||
    data.user.identities?.find(i => i.provider !== 'email')?.provider;

  if (provider === 'facebook') {
    console.log(`[AuthCallback] Facebook provider_token present, auto-connecting...`);

    try {
      // Import helpers
      const { encryptToken } = await import("@/lib/social/crypto");
      const { createServiceSupabaseClient } = await import("@/lib/supabase/service");

      const serviceSupabase = createServiceSupabaseClient();

      // Fetch Facebook user ID (provider_token doesn't include it)
      const fbUserResponse = await fetch(
        `https://graph.facebook.com/me?fields=id&access_token=${providerToken}`
      );
      const fbUser = await fbUserResponse.json();
      const externalUserId = fbUser.id;

      if (externalUserId) {
        // Encrypt token
        const encryptedToken = encryptToken(providerToken);

        // Upsert to social_accounts
        await serviceSupabase.from("social_accounts").upsert(
          {
            user_id: data.user.id,
            provider: "facebook",
            external_user_id: externalUserId,
            access_token: encryptedToken,
            refresh_token: null, // FB doesn't use refresh tokens
            expires_at: null, // Short-lived tokens expire in ~2 hours
          },
          { onConflict: "user_id,provider" }
        );

        // Upsert to social_identities
        await serviceSupabase.from("social_identities").upsert(
          {
            user_id: data.user.id,
            provider: "facebook",
            external_user_id: externalUserId,
          },
          { onConflict: "user_id,provider" }
        );

        // Enable social insights on profile
        await serviceSupabase
          .from("profiles")
          .update({
            social_insights_enabled: true,
            social_insights_activated_at: new Date().toISOString(),
          })
          .eq("id", data.user.id);

        // Trigger sync (fire-and-forget)
        const baseUrl = getBaseUrl(request);
        fetch(`${baseUrl}/api/social/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({
            userId: data.user.id,
            provider: "facebook",
          }),
        }).catch(console.error);

        console.log(`[AuthCallback] Facebook auto-connect complete for user: ${data.user.id}`);
      }
    } catch (autoConnectError: any) {
      // Log but don't fail auth - user can connect later
      console.error(`[AuthCallback] Facebook auto-connect failed:`, autoConnectError.message);
    }
  }
}
// --- END: Facebook provider_token capture ---
```

**Verification:**

```bash
# 1. Clear social_accounts for test user
DELETE FROM social_accounts WHERE user_id = 'TEST_UUID' AND provider = 'facebook';

# 2. Set consent cookie in browser, then login via Facebook

# 3. Check logs for:
grep "Facebook provider_token present" logs.txt
grep "Facebook auto-connect complete" logs.txt

# 4. Verify token stored:
SELECT user_id, provider, LENGTH(access_token) as token_length
FROM social_accounts
WHERE provider = 'facebook';
```

### PR 2: Configure Supabase Facebook Scopes

**Problem:** Supabase may not request `user_posts` scope by default.

**Action:** In Supabase Dashboard → Authentication → Providers → Facebook:
- Add `user_posts` to scopes (comma-separated)
- Verify redirect URI is correct

**Verification:**
- After login, check that provider_token has `user_posts` permission
- Test by calling Graph API `/me/posts`

### PR 3: Add Long-Lived Token Exchange (Optional)

**Files to modify:**
- `lib/social/oauth.ts`
- `app/auth/callback/route.ts` (after PR 1)

**Add function:**

```typescript
// lib/social/oauth.ts

export async function exchangeFacebookForLongLived(shortToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?` +
    `grant_type=fb_exchange_token&` +
    `client_id=${process.env.META_APP_ID}&` +
    `client_secret=${process.env.META_APP_SECRET}&` +
    `fb_exchange_token=${encodeURIComponent(shortToken)}`
  );

  if (!response.ok) {
    throw new Error(`Failed to exchange for long-lived token: ${response.status}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000, // Default 60 days
  };
}
```

---

## G. Edge Cases

### First Login

| Scenario | Behavior |
|----------|----------|
| New user, consent given | provider_token captured, auto-connect, sync |
| New user, no consent | Skip auto-connect, user must connect later |

### Returning Login

| Scenario | Behavior |
|----------|----------|
| Returning user, already connected | Upsert updates token (idempotent) |
| Returning user, consent given, not connected | Auto-connect on this login |
| Returning user, no consent cookie | Skip auto-connect |

### Token Revoked

| Scenario | Behavior |
|----------|----------|
| User revokes app in FB settings | Next sync fails with 401, deletes social_account |
| Sync detects auth error | Auto-deletes row, status shows "disconnected" |

### Needs Reauth

| Scenario | Behavior |
|----------|----------|
| Token expired | `expires_at < now()` → status shows "needs_reauth" |
| User clicks Reconnect | Redirects to /api/social/oauth/facebook/connect |

### User Disconnects Then Logs In Again

| Scenario | Behavior |
|----------|----------|
| User disconnects via Settings | Row deleted from social_accounts |
| User logs in again with consent | provider_token captured, new row created |
| User logs in again without consent | No auto-connect (consent required) |

---

## H. Summary

### Why Tokens Don't Land Today

1. Supabase returns `provider_token` in `exchangeCodeForSession` response
2. We never capture it - code only uses `data.user`
3. Token is transient - disappears after callback
4. Current flow requires second OAuth flow to capture tokens

### Recommended Fix

**Option 1: Capture provider_token in /auth/callback**

- Capture `data.session.provider_token` immediately after `exchangeCodeForSession`
- If consent cookie present, encrypt and store in `social_accounts`
- Enable `social_insights_enabled` on profile
- Trigger sync (fire-and-forget)

**Benefits:**
- Single OAuth flow (best UX)
- Token captured server-side (secure)
- No repeated consent prompts
- Works with existing consent system

---

**End of Audit**
