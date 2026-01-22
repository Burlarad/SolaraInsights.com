# Consent Cookie Audit

**Date:** 2026-01-16
**Goal:** Verify `oauth_consent_facebook` cookie survives OAuth redirect to `/auth/callback`

---

## A. Where is `oauth_consent_facebook` SET?

### Single Source: `persistOauthContext()`

| Location | File | Lines | When Called |
|----------|------|-------|-------------|
| Sign-in page | [app/(auth)/sign-in/page.tsx](../app/(auth)/sign-in/page.tsx) | 108-112 | User clicks Facebook, consents in modal, then `handleConsentContinue()` |
| Welcome page | [app/(auth)/welcome/WelcomeContent.tsx](../app/(auth)/welcome/WelcomeContent.tsx) | 141-146 | User clicks Facebook, consents in modal, then `handleConsentContinue()` |

### Implementation: `lib/auth/socialConsent.ts:54-92`

```typescript
export function persistOauthContext({
  nextPath,
  provider,
  consentChecked,
  checkoutSessionId,
}: { ... }): void {
  // Store in sessionStorage
  sessionStorage.setItem(getConsentKey(provider), consentChecked ? "true" : "false");

  // Set cookie fallbacks
  setOAuthCookie(getConsentKey(provider), consentChecked ? "true" : "false");
  // ... other context
}
```

---

## B. Cookie Attributes Analysis

### `setOAuthCookie()` Implementation

```typescript
// lib/auth/socialConsent.ts:24-28
function setOAuthCookie(name: string, value: string): void {
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
  const secureFlag = isSecure ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=900; Path=/; SameSite=Lax${secureFlag}`;
}
```

### Attribute Breakdown

| Attribute | Value | Analysis |
|-----------|-------|----------|
| **domain** | (implicit - current host) | No explicit domain = exact host only |
| **path** | `/` | Accessible on all paths |
| **secure** | `true` on HTTPS, `false` on HTTP | Correct for dev/prod |
| **httpOnly** | `false` (not set) | Client-readable, server-readable |
| **sameSite** | `Lax` | Allows top-level navigations |
| **maxAge** | `900` (15 minutes) | Sufficient for OAuth flow |

### Will Cookie Survive OAuth Redirect?

**OAuth redirect chain:**
```
solarainsights.com (cookie SET)
       ↓
facebook.com (cookie NOT sent - cross-site)
       ↓
*.supabase.co (cookie NOT sent - cross-site)
       ↓
solarainsights.com/auth/callback (cookie SENT - same-site return)
```

**SameSite=Lax behavior:**
- Cross-site requests: Cookie NOT sent
- Top-level navigation TO same-site: Cookie IS sent

**Verdict:** Cookie SHOULD be present at `/auth/callback` because:
1. Final redirect is a top-level navigation TO our domain
2. SameSite=Lax permits this
3. Cookie hasn't expired (15-minute TTL)
4. Same domain match (assuming consistent NEXT_PUBLIC_SITE_URL)

---

## C. Cross-Domain/Subdomain Considerations

### Domain Scenarios

| Scenario | Cookie Domain | Callback Domain | Cookie Present? |
|----------|---------------|-----------------|-----------------|
| Production | `solarainsights.com` | `solarainsights.com` | YES |
| Dev tunnel | `dev.solarainsights.com` | `dev.solarainsights.com` | YES |
| Local dev | `localhost:3000` | `localhost:3000` | YES |
| **Mismatch** | `localhost:3000` | `solarainsights.com` | **NO** |
| **Mismatch** | `dev.solarainsights.com` | `solarainsights.com` | **NO** |

### Critical: NEXT_PUBLIC_SITE_URL Consistency

The OAuth callback URL is built using:

```typescript
// lib/url/base.ts:49-51
export function getOauthCallbackUrl(): string {
  return `${getClientBaseUrl()}/auth/callback`;
}
```

Where `getClientBaseUrl()` returns:
1. `NEXT_PUBLIC_SITE_URL` if set
2. `window.location.origin` as fallback

**If mismatch occurs:**
- Cookie set on `localhost:3000`
- Supabase configured to redirect to `https://solarainsights.com/auth/callback`
- Cookie NOT present on callback (different domain)

---

## D. Consent Semantics

### Current Design: Dual Storage

| Storage | Purpose | TTL | Scope |
|---------|---------|-----|-------|
| **sessionStorage** | Primary (client-side) | Session (tab close) | Client-only |
| **Cookie** | Fallback (survives redirect) | 15 minutes | Client + Server |
| **DB (profiles.social_insights_enabled)** | Long-term state | Permanent | After activation |

### Flow Semantics

1. **Before OAuth:** User checks consent box → stored in sessionStorage + cookie
2. **After OAuth:** `/auth/callback` reads cookie server-side
3. **After auto-connect:** `profiles.social_insights_enabled = true` persisted to DB
4. **Subsequent logins:** Cookie not needed (DB is source of truth for existing users)

### Recommendation: Clarify Sources of Truth

| Context | Source of Truth | Notes |
|---------|-----------------|-------|
| First-time consent (OAuth in-flight) | Cookie | Short-lived, survives redirect |
| Already-enabled users | `profiles.social_insights_enabled` | DB flag |
| Reconnect after disconnect | Cookie (new consent required) | Or skip consent if DB flag true? |

**Current gap:** No check if `profiles.social_insights_enabled = true` AND cookie missing.

---

## E. Failure Modes

### 1. Domain Mismatch

**Cause:** Cookie set on different domain than callback URL
**Symptom:** `cookieStore.get("oauth_consent_facebook")` returns `undefined`
**Reproduction:**
```bash
# 1. Set NEXT_PUBLIC_SITE_URL=https://solarainsights.com
# 2. Run dev server on localhost:3000
# 3. Navigate to localhost:3000/sign-in
# 4. Click Facebook, consent, login
# 5. Callback redirects to solarainsights.com - cookie not present
```

### 2. Cookie Not Set (persistOauthContext Not Called)

**Cause:** Code path bypasses `persistOauthContext()`
**Symptom:** Cookie doesn't exist
**Reproduction:**
```javascript
// If someone adds a direct link like:
<a href="/api/auth/login/facebook">Login</a>
// Without calling persistOauthContext(), no cookie is set
```

### 3. Cookie Cleared Before Callback

**Cause:** `clearOauthContext()` called too early
**Current code:** Called only in `/auth/post-callback` AFTER `/auth/callback`
**Status:** NOT a failure mode currently

### 4. Max-Age Expired

**Cause:** OAuth flow takes > 15 minutes (user delays)
**Symptom:** Cookie expired before callback
**Likelihood:** Low (user would need to sit on Facebook for 15+ min)

### 5. HTTPS/HTTP Protocol Mismatch

**Cause:** Cookie set with `Secure` flag on HTTPS, callback on HTTP
**Symptom:** Browser doesn't send cookie to HTTP endpoint
**Reproduction:**
```bash
# 1. User visits https://solarainsights.com, cookie set with Secure flag
# 2. Supabase misconfigured to redirect to http://solarainsights.com/auth/callback
# 3. Cookie not sent to HTTP endpoint
```

### 6. Third-Party Cookie Blocking (Safari ITP)

**Cause:** Aggressive browser privacy features
**Status:** NOT a failure mode because:
- Cookie is first-party (set on our domain, read on our domain)
- We use SameSite=Lax (not None)

### 7. Returning User Without Cookie

**Cause:** User previously enabled Social Insights, logs in again, no consent cookie
**Current behavior:** Auto-connect fails silently (no consent)
**Expected:** Should check `profiles.social_insights_enabled` as fallback

---

## F. Summary Table

| Cookie Name | Where Set | Attributes | Where Read | Risks |
|-------------|-----------|------------|------------|-------|
| `oauth_consent_facebook` | sign-in/page.tsx:108, WelcomeContent.tsx:141 via `persistOauthContext()` | `Max-Age=900; Path=/; SameSite=Lax; [Secure]` | auth/callback/route.ts:301, post-callback/page.tsx:73 | Domain mismatch, not called, returning user no cookie |

---

## G. Fix Plan (DO NOT IMPLEMENT YET)

### Fix 1: Add DB Fallback for Returning Users

**Problem:** Returning users who already have `social_insights_enabled = true` don't have consent cookie.

**Solution:** In `/auth/callback`, if cookie is missing, check DB flag:

```typescript
// After detecting Facebook login
let hasConsent = consentCookie?.value === "true";

// Fallback for returning users
if (!hasConsent && data.user) {
  const { data: profile } = await serviceSupabase
    .from("profiles")
    .select("social_insights_enabled")
    .eq("id", data.user.id)
    .single();

  hasConsent = profile?.social_insights_enabled === true;
}
```

**Tradeoff:** Extra DB read on every Facebook login. Minimal cost.

### Fix 2: Validate Domain Consistency

**Problem:** Cookie may be set on wrong domain if NEXT_PUBLIC_SITE_URL doesn't match runtime.

**Solution:** Add startup check or log warning:

```typescript
// In persistOauthContext() - warn if mismatch detected
const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : null;
const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;

if (runtimeOrigin && configuredUrl && runtimeOrigin !== configuredUrl) {
  console.warn(`[OAuth] Domain mismatch: runtime=${runtimeOrigin}, configured=${configuredUrl}`);
}
```

### Fix 3: Extend Cookie Max-Age (Optional)

**Current:** 15 minutes
**Proposed:** 30 minutes
**Reason:** Extra buffer for slow OAuth flows
**Risk:** Minimal (cookie is cleared after use anyway)

### Fix 4: Long-Term - Move Consent to DB Only

**Current:** Cookie for immediate OAuth context, DB for long-term
**Alternative:**
1. On first consent: write `profiles.social_insights_consent_given_at`
2. On OAuth callback: read DB, not cookie
3. Eliminates cookie survival concerns

**Tradeoff:** Extra DB read, but more reliable. Consider for future refactor.

---

## H. Recommended Immediate Actions

1. **Implement Fix 1** (DB fallback) - Low risk, fixes returning user case
2. **Add logging** to track consent cookie presence in `/auth/callback`
3. **Verify** `NEXT_PUBLIC_SITE_URL` matches actual domain in all environments

---

## I. Implementation Status (2026-01-16)

**IMPLEMENTED** in [app/auth/callback/route.ts](../app/auth/callback/route.ts):

1. **Consent logic with DB fallback** (lines 137-174)
   - `checkSocialInsightsConsent()` checks cookie first, then DB flag
   - Returning users auto-consent if `profiles.social_insights_enabled = true`

2. **Generalized provider token capture** (lines 176-271)
   - `handleSocialAutoConnect()` supports all social providers
   - Fetches external user ID via API or identities array
   - Falls back to placeholder if ID unavailable (non-blocking)

3. **Sync ONLY login provider** (lines 273-299, 433-452)
   - Removed `triggerSyncForReturningUser()` that synced ALL providers
   - Now only syncs the provider used for current login
   - Cron handles other providers daily

4. **Security improvements**
   - Removed full URL logging (no code param in logs)
   - No token logging
   - Minimal, safe debug output

---

**End of Audit**
