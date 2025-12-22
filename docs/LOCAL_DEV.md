# Local Development Setup

## Quick Start

**IMPORTANT:** Always run commands from the repository root directory.

```bash
# 1. Navigate to the repository root
cd /Users/aaronburlar/Desktop/Solara

# 2. Start the Next.js dev server
npm run dev

# 3. In a separate terminal, start the Cloudflare Tunnel
cloudflared tunnel run solara-dev
```

Your local environment will be accessible at:
- **Tunnel URL:** https://dev.solarainsights.com
- **Local (fallback):** http://localhost:3000

---

## Environment Configuration

### Current Setup

The `.env.local` file is configured for development with Cloudflare Tunnel:

```bash
# Base URLs for OAuth callbacks
NEXT_PUBLIC_SITE_URL=https://dev.solarainsights.com
NEXT_PUBLIC_APP_URL=https://dev.solarainsights.com

# OAuth debug logging (enable for new provider setup)
OAUTH_DEBUG_LOGS=true
```

All required environment variables are already configured in `.env.local`.

---

## OAuth Provider Configuration

### TikTok Sandbox Setup

**Redirect URI for TikTok Developer Portal:**
```
https://dev.solarainsights.com/api/social/oauth/tiktok/callback
```

1. Go to https://developers.tiktok.com/apps
2. Open your app (client key: `sbawj8fkb8x05wdkza`)
3. Navigate to: **Settings → Login Kit → Redirect URLs**
4. Add exactly: `https://dev.solarainsights.com/api/social/oauth/tiktok/callback`
5. Save and wait 1-2 minutes for propagation

**Testing TikTok OAuth:**
```bash
# 1. Ensure OAUTH_DEBUG_LOGS=true in .env.local
# 2. Start dev server: npm run dev
# 3. Watch server console for:
[OAuth Debug] [tiktok] redirectUri: https://dev.solarainsights.com/api/social/oauth/tiktok/callback
[OAuth Debug] [tiktok] authUrl: https://www.tiktok.com/v2/auth/authorize?client_key=...
```

The redirect URI in logs **must match** what's in your TikTok portal exactly.

---

### Meta (Facebook + Instagram)

**Redirect URIs for Meta Developer Portal:**
```
https://dev.solarainsights.com/api/social/oauth/facebook/callback
https://dev.solarainsights.com/api/social/oauth/instagram/callback
```

1. Go to https://developers.facebook.com/apps
2. Open your app (App ID: `1854718841840122`)
3. Navigate to: **Products → Facebook Login → Settings**
4. Add both callback URLs to "Valid OAuth Redirect URIs"
5. Save changes

---

## Common Issues

### "Missing script: dev"

**Problem:** You ran `npm run dev` from the wrong directory (e.g., `~`).

**Fix:**
```bash
cd /Users/aaronburlar/Desktop/Solara
npm run dev
```

### OAuth "unauthorized_client" Error

**Diagnosis:**
1. Enable debug logs: `OAUTH_DEBUG_LOGS=true` in `.env.local`
2. Restart dev server: `npm run dev`
3. Attempt OAuth connection
4. Check server console for the exact `redirectUri` being sent
5. Compare with provider portal configuration (must match exactly)

**Common mismatches:**
- Protocol: `http://` vs `https://`
- Domain: `localhost:3000` vs `dev.solarainsights.com` vs `solarainsights.com`
- Trailing slash: `.../callback/` vs `.../callback`
- Missing `/callback` suffix

---

## Verifying Configuration

### Check Environment Variables

```bash
# From repo root:
cd /Users/aaronburlar/Desktop/Solara

# Check critical vars are set:
grep -E "(NEXT_PUBLIC_SITE_URL|TIKTOK_CLIENT_KEY|REDIS_URL)" .env.local

# Expected output:
# NEXT_PUBLIC_SITE_URL=https://dev.solarainsights.com
# TIKTOK_CLIENT_KEY=sbawj8fkb8x05wdkza
# REDIS_URL=rediss://red-d44nfr75r7bs73b1jjg0:...
```

### Test the Build

```bash
# Verify Next.js can build successfully:
npm run build

# Should complete with:
# ✓ Compiled successfully
```

---

## Required Services

Your local environment depends on these external services:

| Service | Purpose | Status Check |
|---------|---------|--------------|
| **Supabase** | Auth + Postgres | https://vjzwsponsczwozwfvtnd.supabase.co |
| **Redis (Render)** | Caching + Locking | Connected via `REDIS_URL` |
| **OpenAI** | AI Generation | API key in `.env.local` |
| **Stripe** | Subscriptions | Live keys (test carefully!) |
| **Cloudflare Tunnel** | Public HTTPS access | `cloudflared tunnel run solara-dev` |

---

## Debug Checklist

Before asking for help, verify:

- [ ] Running from `/Users/aaronburlar/Desktop/Solara` (not `~`)
- [ ] `npm run dev` starts successfully
- [ ] Cloudflare Tunnel is running (`cloudflared tunnel run solara-dev`)
- [ ] Can access https://dev.solarainsights.com
- [ ] OAuth debug logs enabled (`OAUTH_DEBUG_LOGS=true`)
- [ ] Redirect URIs in provider portals match exactly
- [ ] `.env.local` has all required variables (see checklist below)

---

## Environment Variables Checklist

All variables below should be present in `.env.local`:

**Core URLs:**
- [x] `NEXT_PUBLIC_SITE_URL`
- [x] `NEXT_PUBLIC_APP_URL`

**Supabase:**
- [x] `NEXT_PUBLIC_SUPABASE_URL`
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] `SUPABASE_SERVICE_ROLE_KEY`

**Redis:**
- [x] `REDIS_URL`

**OpenAI:**
- [x] `OPENAI_API_KEY`
- [x] `OPENAI_HOROSCOPE_MODEL`
- [x] `OPENAI_INSIGHTS_MODEL`
- [x] `OPENAI_PLACEMENTS_MODEL`

**Stripe:**
- [x] `STRIPE_SECRET_KEY`
- [x] `STRIPE_PUBLISHABLE_KEY`
- [x] `STRIPE_WEBHOOK_SECRET`
- [x] `STRIPE_PRICE_ID`
- [x] `STRIPE_FAMILY_PRICE_ID`
- [x] `STRIPE_PRICING_TABLE_ID`

**Email (Resend):**
- [x] `RESEND_API_KEY`
- [x] `RESEND_FROM`

**Social OAuth:**
- [x] `META_APP_ID`
- [x] `META_APP_SECRET`
- [x] `TIKTOK_CLIENT_KEY`
- [x] `TIKTOK_CLIENT_SECRET`
- [x] `SOCIAL_TOKEN_ENCRYPTION_KEY`

**Security:**
- [x] `AUTH_SECRET`
- [x] `CRON_SECRET`

**Debug:**
- [x] `NODE_ENV`
- [x] `NEXT_PUBLIC_SOLARA_DEBUG`
- [x] `OAUTH_DEBUG_LOGS`

---

## Next Steps

Once your local environment is running:

1. **Test authentication:** Visit https://dev.solarainsights.com/sign-in
2. **Test TikTok OAuth:** Go to Settings → Social Accounts → Connect TikTok
3. **Monitor logs:** Watch the terminal for OAuth debug output
4. **Check Redis:** Verify caching is working (should see `[Cache] Redis connected successfully.`)

**Tunnel not working?** Verify Cloudflare Tunnel configuration:
```bash
cloudflared tunnel list
# Should show: solara-dev
```
