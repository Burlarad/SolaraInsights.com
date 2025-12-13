# Cron Job Deployment Guide

**Last Updated**: 2025-12-13

This guide covers setting up the Solara cron job on Render for pre-warming insight caches.

---

## Overview

The prewarm cron job runs every 30 minutes to pre-generate tomorrow's daily insights for active users. This ensures users see instant loading when they visit the Sanctuary.

**Endpoint**: `/api/cron/prewarm-insights`
**Schedule**: `*/30 * * * *` (every 30 minutes)
**Auth**: `x-cron-secret` header matching `CRON_SECRET` env var

---

## Render UI Setup

### Step 1: Create Cron Job Service

1. Log into [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Cron Job**
3. Configure:
   - **Name**: `solara-prewarm-insights`
   - **Region**: Same as your web service (e.g., Oregon)
   - **Schedule**: `*/30 * * * *`

### Step 2: Set Command

Use the curl command directly:

```bash
curl -fsS -H "x-cron-secret: $CRON_SECRET" https://solarainsights.com/api/cron/prewarm-insights
```

Or use the helper script (if deployed):

```bash
./scripts/run-prewarm-cron.sh
```

### Step 3: Configure Environment Variables

Add the following environment variable:

| Variable | Value | Notes |
|----------|-------|-------|
| `CRON_SECRET` | (generate secure value) | Must match the web service's CRON_SECRET |

**To generate a secure secret:**
```bash
openssl rand -base64 32
```

### Step 4: Save and Deploy

1. Click **Create Cron Job**
2. Verify the job appears in your dashboard
3. Wait for first scheduled run or trigger manually

---

## Verification

### Manual Test

Run locally or via Render shell:

```bash
curl -i -H "x-cron-secret: YOUR_SECRET" \
  https://solarainsights.com/api/cron/prewarm-insights
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "stats": {
    "usersProcessed": 42,
    "insightsPrewarmed": 42,
    "errors": 0,
    "durationMs": 15234
  }
}
```

### Check Render Logs

1. Go to your Cron Job service in Render
2. Click **Logs** tab
3. Look for successful runs every 30 minutes

### Query Telemetry

```sql
SELECT
  date_trunc('hour', created_at) as hour,
  cache_status,
  COUNT(*) as count
FROM ai_usage_events
WHERE route = '/api/cron/prewarm-insights'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1, 2
ORDER BY 1 DESC;
```

---

## Troubleshooting

### HTTP 401 Unauthorized

- Verify `CRON_SECRET` is set in both web service and cron job
- Ensure values match exactly (no trailing whitespace)
- Check header name is exactly `x-cron-secret` (lowercase)

### HTTP 500 Error

- Check web service logs for errors
- Verify database connection is healthy
- Ensure Redis is accessible

### No Users Processed

- Users must have `last_seen_at` within 7 days
- Check timezone detection is working
- Window is 3 hours before user's local midnight

---

## Architecture Notes

### How It Works

1. Cron triggers every 30 minutes
2. Endpoint finds users active in last 7 days
3. For each user in their "prewarm window" (3h before midnight):
   - Generates tomorrow's daily insight
   - Caches with 48h TTL
4. Uses distributed locking to prevent duplicate AI calls

### Limits

- **Max users per run**: 500 (prevents timeouts)
- **Lock timeout**: 60 seconds per insight
- **Request timeout**: 5 minutes (Render default)

### Cost Impact

- Only charges for cache misses (new generations)
- Telemetry tracks all AI usage in `ai_usage_events`
- Expected: ~$0.01-0.03 per user per day

---

## Related Files

- [app/api/cron/prewarm-insights/route.ts](app/api/cron/prewarm-insights/route.ts) - Endpoint implementation
- [lib/redis/cache.ts](lib/redis/cache.ts) - Caching utilities
- [scripts/run-prewarm-cron.sh](scripts/run-prewarm-cron.sh) - Helper script
