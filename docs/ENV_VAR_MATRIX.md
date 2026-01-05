# ENV_VAR_MATRIX.md

**Generated:** 2026-01-01
**Scope:** Complete environment variable inventory with validation status and security classification

---

## RAW GREP OUTPUT

```bash
grep -rh "process\.env\.\([A-Z_]*\)" --include="*.ts" --include="*.tsx" | sort -u
```

**Environment Variables Found:**

```
process.env.APP_URL
process.env.CRON_SECRET
process.env.DEV_PAYWALL_BYPASS
process.env.META_APP_ID
process.env.META_APP_SECRET
process.env.NEXT_PUBLIC_APP_URL
process.env.NEXT_PUBLIC_SITE_URL
process.env.NEXT_PUBLIC_SOLARA_DEBUG
process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
process.env.NEXT_PUBLIC_SUPABASE_URL
process.env.NEXT_PUBLIC_X_OAUTH_ENABLED
process.env.NODE_ENV
process.env.OAUTH_DEBUG_LOGS
process.env.OPENAI_API_KEY
process.env.OPENAI_BIRTHCHART_MODEL
process.env.OPENAI_CONNECTION_BRIEF_MODEL
process.env.OPENAI_DAILY_BUDGET_USD
process.env.OPENAI_DAILY_INSIGHTS_MODEL
process.env.OPENAI_DEEP_MODEL
process.env.OPENAI_FAST_MODEL
process.env.OPENAI_HOROSCOPE_MODEL
process.env.OPENAI_INSIGHTS_MODEL
process.env.OPENAI_PLACEMENTS_MODEL
process.env.OPENAI_YEARLY_INSIGHTS_MODEL
process.env.REDDIT_CLIENT_ID
process.env.REDDIT_CLIENT_SECRET
process.env.REDIS_URL
process.env.RESEND_API_KEY
process.env.RESEND_FROM
process.env.SOCIAL_TOKEN_ENCRYPTION_KEY
process.env.STRIPE_FAMILY_PRICE_ID
process.env.STRIPE_PRICE_ID
process.env.STRIPE_PRICING_TABLE_ID
process.env.STRIPE_SECRET_KEY
process.env.STRIPE_WEBHOOK_SECRET
process.env.SUPABASE_SERVICE_ROLE_KEY
process.env.TIKTOK_CLIENT_KEY
process.env.TIKTOK_CLIENT_SECRET
process.env.VALKEY_URL
process.env.X_CLIENT_ID
process.env.X_CLIENT_SECRET
process.env.X_OAUTH_ENABLED
```

---

## ENVIRONMENT VARIABLE INVENTORY

### 1. CORE APPLICATION

| Variable | Required | Default | Validated? | Location | Security |
|----------|----------|---------|------------|----------|----------|
| `NODE_ENV` | Yes | `development` | Implicit | Next.js | PUBLIC |
| `NEXT_PUBLIC_SITE_URL` | Yes (prod) | `http://localhost:3000` | No | OAuth callbacks | PUBLIC |
| `NEXT_PUBLIC_APP_URL` | No | Falls back to window.location | No | Auth redirects | PUBLIC |
| `APP_URL` | No | Legacy fallback | No | Deprecated | PUBLIC |
| `NEXT_PUBLIC_SOLARA_DEBUG` | No | `undefined` | No | Debug UI | PUBLIC |
| `DEV_PAYWALL_BYPASS` | No | `false` | **Yes** (line 41) | `lib/membership/paywall.ts` | DANGEROUS |

**DEV_PAYWALL_BYPASS Validation Evidence:**
```typescript
// lib/membership/paywall.ts
function isPaywallBypassActive(): boolean {
  // HARD SAFETY: Never bypass in production or on solarainsights.com
  if (process.env.NODE_ENV === "production") {
    console.log("[PAYWALL] DEV_PAYWALL_BYPASS ignored - NODE_ENV is production");
    return false;
  }
  // ... additional checks
}
```

---

### 2. SUPABASE

| Variable | Required | Default | Validated? | Location | Security |
|----------|----------|---------|------------|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | None | **Yes** (throws) | `lib/supabase/client.ts:8` | PUBLIC |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | None | **Yes** (throws) | `lib/supabase/client.ts:12` | PUBLIC |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server) | None | **Partial** (warn) | `lib/supabase/server.ts:45` | SECRET |

**Validation Evidence:**
```typescript
// lib/supabase/client.ts:8-12
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
}

// lib/supabase/server.ts:45 - WARNING only
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("SUPABASE_SERVICE_ROLE_KEY not set, admin features unavailable");
}
```

**FINDING (MEDIUM):** `SUPABASE_SERVICE_ROLE_KEY` only warns, doesn't throw. Admin features silently fail.

---

### 3. OPENAI

| Variable | Required | Default | Validated? | Location | Security |
|----------|----------|---------|------------|----------|----------|
| `OPENAI_API_KEY` | Yes | None | **Yes** (throws) | `lib/openai/client.ts:4-8` | SECRET |
| `OPENAI_DAILY_INSIGHTS_MODEL` | No | `gpt-4.1-mini` | No | `lib/openai/client.ts:22` | CONFIG |
| `OPENAI_YEARLY_INSIGHTS_MODEL` | No | `gpt-5.1` | No | `lib/openai/client.ts:24` | CONFIG |
| `OPENAI_BIRTHCHART_MODEL` | No | `gpt-5.1` | No | `lib/openai/client.ts:26` | CONFIG |
| `OPENAI_HOROSCOPE_MODEL` | No | `gpt-4.1-mini` | No | `lib/openai/client.ts:28` | CONFIG |
| `OPENAI_CONNECTION_BRIEF_MODEL` | No | `gpt-4.1-mini` | No | `lib/openai/client.ts:30` | CONFIG |
| `OPENAI_DEEP_MODEL` | No | `gpt-4o` | No | `lib/openai/client.ts:32` | CONFIG |
| `OPENAI_FAST_MODEL` | No | `gpt-4o-mini` | No | `lib/openai/client.ts:34` | CONFIG |
| `OPENAI_INSIGHTS_MODEL` | No | `gpt-4.1-mini` | Legacy | `lib/openai/client.ts:36` | CONFIG |
| `OPENAI_PLACEMENTS_MODEL` | No | `gpt-5.1` | Legacy | `lib/openai/client.ts:38` | CONFIG |
| `OPENAI_DAILY_BUDGET_USD` | No | `100` | **Yes** (parseFloat) | `lib/ai/costControl.ts:27-34` | CONFIG |

**Validation Evidence:**
```typescript
// lib/openai/client.ts:4-8
if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "Missing OPENAI_API_KEY environment variable. Please add it to your .env file."
  );
}

// lib/ai/costControl.ts:27-34
function getDailyBudgetLimit(): number {
  const envBudget = process.env.OPENAI_DAILY_BUDGET_USD;
  if (envBudget) {
    const parsed = parseFloat(envBudget);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_DAILY_BUDGET_USD; // 100
}
```

**FINDING (LOW):** Invalid `OPENAI_DAILY_BUDGET_USD` (e.g., "abc") silently falls back to $100. Consider logging a warning.

---

### 4. STRIPE

| Variable | Required | Default | Validated? | Location | Security |
|----------|----------|---------|------------|----------|----------|
| `STRIPE_SECRET_KEY` | Yes | None | **Partial** (warn) | `lib/stripe/client.ts:3-5` | SECRET |
| `STRIPE_WEBHOOK_SECRET` | Yes (prod) | None | **Yes** (500 error) | `app/api/stripe/webhook/route.ts:98-104` | SECRET |
| `STRIPE_PRICE_ID` | Yes | `""` | No | `lib/stripe/client.ts:22` | CONFIG |
| `STRIPE_FAMILY_PRICE_ID` | Yes | `""` | No | `lib/stripe/client.ts:23` | CONFIG |
| `STRIPE_PRICING_TABLE_ID` | No | `""` | No | `lib/stripe/client.ts:25` | CONFIG |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | `""` | No | Client-side | PUBLIC |
| `NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID` | No | `""` | No | Client-side | PUBLIC |

**Validation Evidence:**
```typescript
// lib/stripe/client.ts:3-5
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY is not set; Stripe client will be created with an empty key.");
}

// app/api/stripe/webhook/route.ts:98-104
if (!STRIPE_CONFIG.webhookSecret) {
  console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
  return NextResponse.json(
    { error: "Webhook not configured" },
    { status: 500 }
  );
}
```

**FINDING (HIGH):** `STRIPE_SECRET_KEY` only warns, creates client with empty key. This will fail silently on Stripe API calls.

**Fix:** Add throw statement:
```typescript
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}
```

---

### 5. REDIS/VALKEY

| Variable | Required | Default | Validated? | Location | Security |
|----------|----------|---------|------------|----------|----------|
| `REDIS_URL` | No | `undefined` | **Yes** (graceful) | `lib/cache/redis.ts:30-35` | SECRET |
| `VALKEY_URL` | No | `undefined` | **Yes** (graceful) | `lib/cache/redis.ts:30` | SECRET |

**Validation Evidence:**
```typescript
// lib/cache/redis.ts:30-35
const redisUrl = process.env.REDIS_URL || process.env.VALKEY_URL;
if (!redisUrl) {
  console.warn("[Cache] No REDIS_URL or VALKEY_URL found. Caching is disabled.");
  return;
}
```

**Behavior:** Redis is optional. When unavailable:
- Rate limiting falls back to in-memory (process-local)
- AI cost control fails closed (blocks requests)
- Caching is disabled (every request generates new content)

---

### 6. EMAIL (RESEND)

| Variable | Required | Default | Validated? | Location | Security |
|----------|----------|---------|------------|----------|----------|
| `RESEND_API_KEY` | Yes | None | **Partial** (warn) | `lib/resend/client.ts:4-6` | SECRET |
| `RESEND_FROM` | No | `"Solara <no-reply@solarainsights.com>"` | No | `lib/resend/client.ts:24` | CONFIG |

**Validation Evidence:**
```typescript
// lib/resend/client.ts:4-6
if (!process.env.RESEND_API_KEY) {
  console.warn("RESEND_API_KEY is not set; email sending will fail.");
}
```

**FINDING (MEDIUM):** Missing `RESEND_API_KEY` only warns. Welcome emails will fail silently.

---

### 7. SOCIAL OAUTH

| Variable | Required | Default | Validated? | Location | Security |
|----------|----------|---------|------------|----------|----------|
| `META_APP_ID` | Conditional | None | No | `lib/oauth/providers/meta.ts` | SECRET |
| `META_APP_SECRET` | Conditional | None | No | `lib/oauth/providers/meta.ts` | SECRET |
| `TIKTOK_CLIENT_KEY` | Conditional | None | No | `lib/oauth/providers/tiktok.ts` | SECRET |
| `TIKTOK_CLIENT_SECRET` | Conditional | None | No | `lib/oauth/providers/tiktok.ts` | SECRET |
| `X_CLIENT_ID` | Conditional | None | No | `lib/oauth/providers/x.ts` | SECRET |
| `X_CLIENT_SECRET` | Conditional | None | No | `lib/oauth/providers/x.ts` | SECRET |
| `X_OAUTH_ENABLED` | No | `false` | No | `lib/oauth/providers/index.ts` | CONFIG |
| `NEXT_PUBLIC_X_OAUTH_ENABLED` | No | `false` | No | Client-side UI | PUBLIC |
| `REDDIT_CLIENT_ID` | No | None | No | Not implemented | SECRET |
| `REDDIT_CLIENT_SECRET` | No | None | No | Not implemented | SECRET |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | Yes | None | **Yes** (throws) | `lib/social/crypto.ts:18-32` | SECRET |
| `OAUTH_DEBUG_LOGS` | No | `false` | No | OAuth debugging | CONFIG |

**Validation Evidence:**
```typescript
// lib/social/crypto.ts:18-32
function getEncryptionKey(): Buffer {
  const key = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY environment variable is not set");
  }
  const keyBuffer = Buffer.from(key, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error(
      `SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes (256 bits). Got ${keyBuffer.length} bytes.`
    );
  }
  return keyBuffer;
}
```

**Behavior:** OAuth providers are conditionally enabled. Missing credentials = provider disabled (graceful).

---

### 8. CRON/INTERNAL

| Variable | Required | Default | Validated? | Location | Security |
|----------|----------|---------|------------|----------|----------|
| `CRON_SECRET` | Yes (prod) | None | **Yes** (401) | All cron routes | SECRET |

**Validation Evidence:**
```typescript
// app/api/cron/prewarm-insights/route.ts
const cronSecret = req.headers.get("x-cron-secret");
if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

---

## COMPARISON WITH .env.example

### Variables in .env.example but NOT in code:

| Variable | Status | Notes |
|----------|--------|-------|
| `AUTH_SECRET` | UNUSED | Listed in .env.example but not referenced in code |

### Variables in code but NOT in .env.example:

| Variable | Status | Notes |
|----------|--------|-------|
| `VALKEY_URL` | MISSING | Alternative to REDIS_URL, should be documented |
| `OPENAI_BUDGET_FAIL_MODE` | MISSING | Controls fail-open/fail-closed for budget |

### Drift Analysis:

```diff
# .env.example vs actual usage

+ VALKEY_URL                    # Used in lib/cache/redis.ts:30
+ OPENAI_BUDGET_FAIL_MODE       # Used in lib/ai/costControl.ts:40-46
- AUTH_SECRET                   # Listed but unused
```

---

## SECURITY CLASSIFICATION

### CRITICAL SECRETS (Never expose)

| Variable | Compromise Impact |
|----------|-------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Full database access, bypass RLS |
| `STRIPE_SECRET_KEY` | Process payments, refunds |
| `STRIPE_WEBHOOK_SECRET` | Forge payment events |
| `OPENAI_API_KEY` | Run up AI costs |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | Decrypt OAuth tokens |
| `CRON_SECRET` | Trigger internal jobs |
| `META_APP_SECRET` | Impersonate app |
| `TIKTOK_CLIENT_SECRET` | Impersonate app |
| `X_CLIENT_SECRET` | Impersonate app |

### SENSITIVE CONFIG (Keep private)

| Variable | Exposure Risk |
|----------|---------------|
| `REDIS_URL` | Cache poisoning, data leakage |
| `RESEND_API_KEY` | Send emails from app |
| `STRIPE_PRICE_ID` | Pricing manipulation |

### PUBLIC (Safe to expose)

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_*` | Client-side by design |
| `NODE_ENV` | Build-time constant |

---

## FINDINGS SUMMARY

### HIGH SEVERITY

| ID | Issue | Location | Fix |
|----|-------|----------|-----|
| E1 | `STRIPE_SECRET_KEY` only warns when missing | `lib/stripe/client.ts:3-5` | Add throw statement |
| E2 | `SUPABASE_SERVICE_ROLE_KEY` only warns | `lib/supabase/server.ts:45` | Add throw or explicit error handling |

### MEDIUM SEVERITY

| ID | Issue | Location | Fix |
|----|-------|----------|-----|
| E3 | `RESEND_API_KEY` only warns | `lib/resend/client.ts:4-6` | Add throw or disable email features |
| E4 | `.env.example` missing `VALKEY_URL` | `.env.example` | Add documentation |
| E5 | `.env.example` has unused `AUTH_SECRET` | `.env.example` | Remove or document future use |

### LOW SEVERITY

| ID | Issue | Location | Fix |
|----|-------|----------|-----|
| E6 | Invalid `OPENAI_DAILY_BUDGET_USD` silent fallback | `lib/ai/costControl.ts:27-34` | Add warning log |
| E7 | Missing `OPENAI_BUDGET_FAIL_MODE` in .env.example | `.env.example` | Add documentation |

---

## RECOMMENDED .env.example UPDATES

```diff
# Add missing variables:
+ # Redis/Valkey (alternative cache backends)
+ VALKEY_URL=

+ # OpenAI Budget Control
+ OPENAI_BUDGET_FAIL_MODE=closed  # "closed" (block) or "open" (allow)

# Remove unused:
- AUTH_SECRET=your-auth-secret
```

---

## VALIDATION ENFORCEMENT RECOMMENDATIONS

### Add startup validation script

Create `lib/config/validate.ts`:

```typescript
export function validateRequiredEnvVars() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'OPENAI_API_KEY',
  ];

  const requiredInProd = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'CRON_SECRET',
    'SOCIAL_TOKEN_ENCRYPTION_KEY',
    'RESEND_API_KEY',
  ];

  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    for (const key of requiredInProd) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

Call from `instrumentation.ts`:
```typescript
export async function register() {
  const { validateRequiredEnvVars } = await import('./lib/config/validate');
  validateRequiredEnvVars();
}
```
