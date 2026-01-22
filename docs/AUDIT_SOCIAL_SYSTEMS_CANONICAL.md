# Social Systems Audit - Canonical Document

**Date:** 2026-01-15
**Status:** Authoritative - supersedes all prior social audit docs

---

## Quick Status

| Component | Status | Blocker? |
|-----------|--------|----------|
| TikTok Login | Working | No |
| Facebook Login | Working | No |
| Facebook Connect (Social Insights) | BLOCKED | **Yes - redirect URI** |
| TikTok Connect (Social Insights) | Working | No |
| Status Reflection (Settings) | Working | No |
| Summary Generation | Working | No |
| Tone Integration | Working | No |
| Daily Sync | Working | No |

---

## A. Punch List - What's Left To Do

### 1. Login Flows

| Item | Status | Notes |
|------|--------|-------|
| Facebook via Supabase | Done | Uses `signInWithOAuth` |
| TikTok custom flow | Done | PKCE + magic link session |
| X (Twitter) | Disabled | $100/mo tier required |
| Reddit | Stub | UI says "Coming soon" |

### 2. Settings Connect Flows

| Item | Status | Notes |
|------|--------|-------|
| Facebook connect | **BLOCKED** | Meta "URL Blocked" error |
| TikTok connect | Done | Full flow works |
| Instagram connect | Untested | Shares Meta creds |
| X connect | Disabled | Feature-flagged off |
| Reddit connect | Not wired | Adapter exists but UI disabled |

### 3. Status Reflection + UI State

| Item | Status | Evidence |
|------|--------|----------|
| `/api/social/status` endpoint | Done | [route.ts:24-111](app/api/social/status/route.ts#L24-L111) |
| Settings loads status on mount | Done | [settings/page.tsx:305-321](app/(protected)/settings/page.tsx#L305-L321) |
| Status shows connected/disconnected | Done | Tested |
| Status shows needs_reauth | Done | Implemented |

**Gap:** No error UI if status fetch fails - shows "Loading..." forever

### 4. Token Storage/Encryption/Rotation

| Item | Status | Evidence |
|------|--------|----------|
| AES-256-GCM encryption | Done | [crypto.ts](lib/social/crypto.ts) |
| social_accounts vault | Done | RLS service_role only |
| Token refresh (TikTok) | Done | [sync/route.ts:116-153](app/api/social/sync/route.ts#L116-L153) |
| Token refresh (Facebook) | N/A | FB uses long-lived tokens |
| Delete on auth failure | Done | Auto-deletes when 401 |

### 5. Sync Pipeline and Fetchers

| Item | Status | Evidence |
|------|--------|----------|
| `/api/social/sync` | Done | CRON_SECRET protected |
| `/api/social/sync-user` | Done | Syncs all providers |
| Facebook fetcher | Done | Fetches `/me/posts` |
| TikTok fetcher | MVP | Only `user.info.basic` scope |
| Instagram fetcher | Done | Fetches `/me/media` |
| X fetcher | Done | Ready but disabled |
| Reddit fetcher | Done | Ready but not wired |

**Gap:** TikTok fetcher returns minimal content (display_name only)

### 6. Summary Generation + Storage

| Item | Status | Evidence |
|------|--------|----------|
| AI summary via GPT-4o-mini | Done | [summarize.ts](lib/social/summarize.ts) |
| Metadata extraction | Done | signalStrength, humorDial, etc. |
| Upsert to social_summaries | Done | Idempotent via `onConflict` |
| Budget checking | Done | [costControl.ts](lib/ai/costControl.ts) |

### 7. Tone/Personalization Integration

| Item | Status | Evidence |
|------|--------|----------|
| Read summaries in `/api/insights` | Done | [insights/route.ts:342-359](app/api/insights/route.ts#L342-L359) |
| Parse metadata for humor dial | Done | [insights/route.ts:352-354](app/api/insights/route.ts#L352-L354) |
| Inject into system prompt | Done | [insights/route.ts:479-541](app/api/insights/route.ts#L479-L541) |

### 8. Cron/Scheduling

| Item | Status | Evidence |
|------|--------|----------|
| On-connect sync | Done | Fire-and-forget after OAuth callback |
| On-login sync (TikTok) | Done | If consent cookie present |
| Daily piggyback sync | Done | Via staleness check in `/api/insights` |
| Redis lock deduplication | Done | [staleness.ts:103-170](lib/social/staleness.ts#L103-L170) |

**No separate cron job needed** - sync piggybacks on user activity

---

## B. End-to-End Flow Verification

### TikTok Login Flow

| Step | Happens? | Where |
|------|----------|-------|
| User clicks TikTok | Yes | [sign-in/page.tsx:181-188](app/(auth)/sign-in/page.tsx#L181-L188) |
| State + PKCE created | Yes | [login/tiktok/route.ts](app/api/auth/login/tiktok/route.ts) |
| Callback received | Yes | [login/tiktok/callback/route.ts](app/api/auth/login/tiktok/callback/route.ts) |
| Token exchange | Yes | Uses `exchangeCodeForTokens` |
| Token vault write | Yes | If consent cookie present |
| Status reflects it | Yes | Via `/api/social/status` |
| Summary generated | Yes | Fire-and-forget sync |
| Tone layer reads | Yes | In `/api/insights` |

### Facebook Login Flow

| Step | Happens? | Where |
|------|----------|-------|
| User clicks Facebook | Yes | [sign-in/page.tsx:171-178](app/(auth)/sign-in/page.tsx#L171-L178) |
| Supabase OAuth | Yes | `signInWithOAuth` |
| Callback received | Yes | [auth/callback/route.ts](app/auth/callback/route.ts) |
| Session established | Yes | `exchangeCodeForSession` |
| Token vault write | **NO** | Login flow doesn't auto-connect |
| Status reflects it | N/A | Not connected yet |
| Summary generated | N/A | Not connected yet |
| Tone layer reads | N/A | Not connected yet |

**Facebook login does NOT auto-connect Social Insights** - user must manually connect via Settings.

### Facebook Connect Flow (from Settings)

| Step | Happens? | Blocker |
|------|----------|---------|
| User clicks Connect | Yes | [settings/page.tsx:329-331](app/(protected)/settings/page.tsx#L329-L331) |
| Redirect to Facebook | Yes | Via `/api/social/oauth/facebook/connect` |
| **Facebook redirect** | **BLOCKED** | "URL Blocked: This redirect failed..." |
| Token exchange | No | Never reaches callback |
| Token vault write | No | - |
| Summary generated | No | - |

---

## C. Meta/Facebook Production Readiness

### Scopes Requested

| Provider | Scopes | Requires App Review |
|----------|--------|---------------------|
| Facebook | `public_profile`, `user_posts` | **Yes** - `user_posts` needs Advanced Access |
| Instagram | `user_profile`, `user_media` | **Yes** - `user_media` needs Advanced Access |

**Source:** [lib/oauth/providers/meta.ts:87](lib/oauth/providers/meta.ts#L87), [meta.ts:164](lib/oauth/providers/meta.ts#L164)

### Redirect URI Construction

All redirect URIs are built from `NEXT_PUBLIC_SITE_URL`:

```typescript
// lib/social/oauth.ts:197-200
export function getCallbackUrl(provider: SocialProvider): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${baseUrl}/api/social/oauth/${provider}/callback`;
}
```

### Required Whitelist URIs (Meta Console)

**For dev.solarainsights.com:**
```
https://dev.solarainsights.com/auth/callback
https://dev.solarainsights.com/api/social/oauth/facebook/callback
https://dev.solarainsights.com/api/social/oauth/instagram/callback
```

**For production (solarainsights.com):**
```
https://solarainsights.com/auth/callback
https://solarainsights.com/api/social/oauth/facebook/callback
https://solarainsights.com/api/social/oauth/instagram/callback
```

**Supabase callback (for FB login via Supabase):**
```
https://<project>.supabase.co/auth/v1/callback
```

### Production Blockers

| Blocker | Status | Fix |
|---------|--------|-----|
| Redirect URI not whitelisted | **BLOCKING** | Add URIs to Meta console |
| App mode = Development | ? | Set to Live mode |
| `user_posts` needs Advanced Access | **BLOCKING** | Submit for App Review |
| `user_media` needs Advanced Access | **BLOCKING** | Submit for App Review |
| Business verification | ? | May be required |

### Meta Console Checklist

1. **App Settings > Basic:**
   - Add Privacy Policy URL
   - Add Terms of Service URL
   - Set App Domains

2. **Facebook Login > Settings:**
   - Enable "Web OAuth Login"
   - Add all redirect URIs above
   - Enable "Enforce HTTPS"

3. **App Review:**
   - Request `user_posts` permission
   - Request `user_media` permission
   - Submit use case description

---

## D. Robustness and Correctness

### Idempotency

| Operation | Idempotent? | How |
|-----------|-------------|-----|
| Token vault upsert | Yes | `onConflict: "user_id,provider"` |
| Summary upsert | Yes | `onConflict: "user_id,provider"` |
| Daily sync | Yes | Redis lock prevents duplicates |

### Rate Limits

| Limit | Value | Implementation |
|-------|-------|----------------|
| Social connects/day | 5 | [socialRateLimit.ts](lib/social/socialRateLimit.ts) |
| AI budget | Configurable | [costControl.ts](lib/ai/costControl.ts) |

**Gap:** No backoff strategy if provider API rate-limits us

### Observability

| Concern | Status |
|---------|--------|
| Request IDs in logs | Done (8-char UUID) |
| Debug mode available | Done (`OAUTH_DEBUG_LOGS=true`) |
| Token audit logging | Done |

**Gap:** Debug mode is too verbose for production

### Security

| Concern | Status | Evidence |
|---------|--------|----------|
| Service role isolated to server | Done | Never in client code |
| Encryption key in env only | Done | `SOCIAL_TOKEN_ENCRYPTION_KEY` |
| State cookie validation | Done | Timestamp + state match |
| PKCE S256 | Done | All providers |
| Rate limiting | Done | 5/day per user |
| RLS on sensitive tables | Done | service_role only |

---

## E. Verification Commands

### Test Status Endpoint

```bash
# Should return 401 (not 500) when unauthenticated
curl -i https://dev.solarainsights.com/api/social/status
```

### Test Sync (requires CRON_SECRET)

```bash
curl -X POST https://dev.solarainsights.com/api/social/sync \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_UUID","provider":"tiktok"}'
```

### SQL: Check Connected Accounts

```sql
SELECT user_id, provider, expires_at, created_at
FROM social_accounts
WHERE user_id = 'USER_UUID';
```

### SQL: Check Summaries

```sql
SELECT user_id, provider, posts_count, last_fetched_at
FROM social_summaries
WHERE user_id = 'USER_UUID';
```

### SQL: Verify Idempotency

```sql
-- Should return exactly 1 row per user+provider combo
SELECT user_id, provider, COUNT(*)
FROM social_accounts
GROUP BY user_id, provider
HAVING COUNT(*) > 1;
-- (expect zero rows)
```

### Simulate Daily Sync

```bash
# 1. Clear last_social_sync_local_date
UPDATE profiles SET last_social_sync_local_date = NULL WHERE id = 'USER_UUID';

# 2. Visit Sanctuary (triggers staleness check)
# 3. Check logs for "[SocialStaleness] Triggering fire-and-forget sync"
```

---

## F. Next 3 PRs

### PR 1: Fix Meta Redirect URI (BLOCKING)

**Scope:**
1. Add all redirect URIs to Meta Developer Console
2. Verify Facebook Connect works on dev.solarainsights.com
3. Test full flow: Connect → OAuth → Summary generated

**Definition of Done:**
- [ ] Facebook Connect button in Settings works
- [ ] Token stored in social_accounts
- [ ] Summary appears in social_summaries
- [ ] Status shows "connected" in Settings

**Commands to verify:**
```bash
# After connecting FB in Settings UI:
psql -c "SELECT provider, created_at FROM social_accounts WHERE user_id='USER_UUID';"
```

### PR 2: Request Meta Advanced Access

**Scope:**
1. Submit `user_posts` permission for App Review
2. Submit `user_media` permission for App Review
3. Complete Business Verification if required

**Definition of Done:**
- [ ] App Review submitted
- [ ] Permissions approved (or timeline known)

### PR 3: TikTok Scope Upgrade (Optional)

**Scope:**
1. Apply for `user.info.profile` scope in TikTok Developer Portal
2. Update [tiktok.ts:19](lib/oauth/providers/tiktok.ts#L19) to include new scope
3. Update [fetchers.ts:103-140](lib/social/fetchers.ts#L103-L140) to fetch bio

**Definition of Done:**
- [ ] TikTok summaries include bio_description
- [ ] signalStrength improves for TikTok users

---

## Appendix: File Inventory

### Routes

| File | Purpose |
|------|---------|
| `app/api/social/status/route.ts` | Get connection statuses |
| `app/api/social/sync/route.ts` | Sync single provider |
| `app/api/social/sync-user/route.ts` | Sync all providers |
| `app/api/social/revoke/route.ts` | Disconnect provider |
| `app/api/social/oauth/[provider]/connect/route.ts` | Start OAuth |
| `app/api/social/oauth/[provider]/callback/route.ts` | Complete OAuth |
| `app/api/auth/login/tiktok/route.ts` | TikTok login init |
| `app/api/auth/login/tiktok/callback/route.ts` | TikTok login callback |

### Libraries

| File | Purpose |
|------|---------|
| `lib/social/oauth.ts` | OAuth orchestration |
| `lib/social/fetchers.ts` | Content fetchers |
| `lib/social/summarize.ts` | AI summary generation |
| `lib/social/staleness.ts` | Daily sync detection |
| `lib/social/socialRateLimit.ts` | Rate limiting |
| `lib/social/crypto.ts` | Token encryption |
| `lib/oauth/pkce.ts` | PKCE helpers |
| `lib/oauth/providers/*.ts` | Provider adapters |

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Yes | Redirect URI base |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Token vault access |
| `META_APP_ID` | For Meta | Facebook/Instagram |
| `META_APP_SECRET` | For Meta | Facebook/Instagram |
| `TIKTOK_CLIENT_KEY` | For TikTok | TikTok OAuth |
| `TIKTOK_CLIENT_SECRET` | For TikTok | TikTok OAuth |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | Yes | AES-256-GCM |
| `CRON_SECRET` | Yes | Sync authorization |

---

**End of Canonical Social Systems Audit**
