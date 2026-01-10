# Render Deployment Guide

This guide covers environment variable configuration for deploying Solara Insights to Render.

## Environment Variable Setup

Render uses the dashboard (not a render.yaml file) to manage environment variables. Configure these in:

**Dashboard → Your Web Service → Environment**

### Required Environment Variables

| Variable | Source | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_SITE_URL` | Set to `https://solarainsights.com` | Primary URL for OAuth callbacks |
| `APP_URL` | Same as SITE_URL | Legacy compatibility |
| `NEXT_PUBLIC_APP_URL` | Same as SITE_URL | Legacy compatibility |
| `NEXTAUTH_URL` | Same as SITE_URL | Legacy compatibility |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API | Public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API | Admin key - never expose client-side |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API Keys | Use `sk_live_*` for production |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → API Keys | Use `pk_live_*` for production |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → Signing secret | |
| `STRIPE_PRICE_ID` | Stripe Dashboard → Products → Price ID | Individual plan |
| `STRIPE_FAMILY_PRICE_ID` | Stripe Dashboard → Products → Price ID | Family plan |
| `STRIPE_PRICING_TABLE_ID` | Stripe Dashboard → Product Catalog → Pricing Tables | |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same as STRIPE_PUBLISHABLE_KEY | Client-side |
| `NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID` | Same as STRIPE_PRICING_TABLE_ID | Client-side |
| `OPENAI_API_KEY` | OpenAI Dashboard → API Keys | |
| `RESEND_API_KEY` | Resend Dashboard → API Keys | |
| `RESEND_FROM` | Set to `Solara Insights <solara@solarainsights.com>` | |
| `REDIS_URL` | Render Valkey addon or external Redis | |
| `AUTH_SECRET` | Generate: `openssl rand -base64 32` | |
| `CRON_SECRET` | Generate: `openssl rand -base64 32` | |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | Generate: `openssl rand -base64 32` | AES-256-GCM key |

### OAuth Provider Variables

| Variable | Source | Notes |
|----------|--------|-------|
| `META_APP_ID` | Meta Developer Portal | Facebook/Instagram |
| `META_APP_SECRET` | Meta Developer Portal | |
| `TIKTOK_CLIENT_KEY` | TikTok Developer Portal | |
| `TIKTOK_CLIENT_SECRET` | TikTok Developer Portal | |
| `X_OAUTH_ENABLED` | Set to `false` | X requires $100/mo Basic tier |
| `NEXT_PUBLIC_X_OAUTH_ENABLED` | Set to `false` | Client-side mirror |

### Optional Variables

| Variable | Default | Notes |
|----------|---------|-------|
| `NEXT_SUPABASE_DB_URL` | N/A | Direct DB connection (migrations only) |
| `OPENAI_HOROSCOPE_MODEL` | `gpt-4.1-mini` | |
| `OPENAI_DAILY_INSIGHTS_MODEL` | `gpt-4.1-mini` | |
| `OPENAI_PLACEMENTS_MODEL` | `gpt-5.1` | |
| `OPENAI_DAILY_BUDGET_USD` | N/A | Cost control |
| `OPENAI_BUDGET_FAIL_MODE` | N/A | `open` or `closed` |

### Variables to NEVER Set in Production

These are for local development only:

- `DEV_PAYWALL_BYPASS` - Bypasses payment gates
- `OAUTH_DEBUG_LOGS` - Verbose logging
- `DEBUG_MIDDLEWARE` - Middleware debug logging
- `TOKEN_AUDIT_ENABLED` - Token audit logging
- `NEXT_PUBLIC_SOLARA_DEBUG` - Client-side debug mode

## Environment Groups

Consider using Render Environment Groups for shared secrets across services:

1. **solara-supabase**: SUPABASE_* variables
2. **solara-stripe**: STRIPE_* variables
3. **solara-oauth**: META_*, TIKTOK_*, X_* variables
4. **solara-secrets**: AUTH_SECRET, CRON_SECRET, SOCIAL_TOKEN_ENCRYPTION_KEY

## Webhook Configuration

### Stripe Webhook

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://solarainsights.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

### OAuth Callback URLs

Configure these in each provider's developer portal:

- **Meta (Facebook)**: `https://solarainsights.com/api/social/oauth/facebook/callback`
- **Meta (Instagram)**: `https://solarainsights.com/api/social/oauth/instagram/callback`
- **TikTok**: `https://solarainsights.com/api/social/oauth/tiktok/callback`

## Verification Checklist

After deployment, verify:

- [ ] Site loads at `https://solarainsights.com`
- [ ] User authentication works (sign up, sign in)
- [ ] Stripe checkout redirects properly
- [ ] Stripe webhooks are received (check Stripe Dashboard → Webhooks → Logs)
- [ ] OAuth flows work for configured providers
- [ ] AI-generated content appears (horoscopes, insights)
- [ ] Emails are sent (check Resend Dashboard)

## Troubleshooting

### "Missing environment variable" errors

Check that all required variables are set in Render dashboard. Variables starting with `NEXT_PUBLIC_` must be set before build time.

### OAuth callback errors

Ensure callback URLs in provider portals exactly match `{NEXT_PUBLIC_SITE_URL}/api/social/oauth/{provider}/callback`.

### Stripe webhook failures

1. Check `STRIPE_WEBHOOK_SECRET` matches the signing secret in Stripe Dashboard
2. Verify webhook endpoint URL is correct
3. Check Stripe Dashboard → Webhooks → Logs for error details

### Redis connection errors

If using Render Valkey addon, ensure `REDIS_URL` is set to the addon's connection URL. The app gracefully degrades if Redis is unavailable.
