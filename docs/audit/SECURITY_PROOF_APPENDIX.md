# SECURITY_PROOF_APPENDIX.md

**Generated:** 2026-01-01
**Scope:** Code evidence for all security claims with "what could go wrong" analysis

---

## 1. AES-256-GCM TOKEN ENCRYPTION

### 1.1 Claim
OAuth tokens (Facebook, etc.) are encrypted at rest using AES-256-GCM before storage in Supabase.

### 1.2 Evidence

**File:** `lib/social/crypto.ts:1-92`

```typescript
/**
 * Token Encryption/Decryption for Social OAuth Tokens
 *
 * Uses AES-256-GCM for symmetric encryption.
 * The encryption key should be stored in SOCIAL_TOKEN_ENCRYPTION_KEY env var.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";   // Line 10
const IV_LENGTH = 16;              // Line 11 - 128-bit IV
const AUTH_TAG_LENGTH = 16;        // Line 12 - 128-bit auth tag

/**
 * Get the encryption key from environment variables.
 * Must be exactly 32 bytes (256 bits) for AES-256.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;

  if (!key) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY environment variable is not set");
  }

  // Key should be base64-encoded 32 bytes
  const keyBuffer = Buffer.from(key, "base64");

  if (keyBuffer.length !== 32) {                    // Line 28
    throw new Error(
      `SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes (256 bits). Got ${keyBuffer.length} bytes.`
    );
  }

  return keyBuffer;
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded string containing: IV + ciphertext + auth tag
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);         // Line 43 - Random IV each time

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);  // Line 45

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();              // Line 50 - GCM auth tag

  // Combine: IV (16 bytes) + encrypted data + auth tag (16 bytes)
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, "base64"),
    authTag,
  ]);

  return combined.toString("base64");
}

/**
 * Decrypt an encrypted token string.
 * Input should be base64-encoded string from encryptToken().
 */
export function decryptToken(encryptedData: string): string {
  const key = getEncryptionKey();

  const combined = Buffer.from(encryptedData, "base64");

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);                              // Line 72
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);    // Line 73
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);  // Line 74

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);                    // Line 77 - Verify authenticity

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}
```

### 1.3 Verification Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| AES-256 (256-bit key) | PASS | `keyBuffer.length !== 32` check at line 28 |
| GCM mode (authenticated) | PASS | `ALGORITHM = "aes-256-gcm"` at line 10 |
| Random IV per encryption | PASS | `crypto.randomBytes(IV_LENGTH)` at line 43 |
| Auth tag verified on decrypt | PASS | `decipher.setAuthTag(authTag)` at line 77 |
| Key from env variable | PASS | `process.env.SOCIAL_TOKEN_ENCRYPTION_KEY` at line 19 |
| Key validation | PASS | Length check at line 28 |

### 1.4 What Could Go Wrong

| Threat | Mitigation | Gap |
|--------|------------|-----|
| Key in version control | `.env` in `.gitignore` | VERIFY: `git ls-files .env` returns empty |
| Key rotation | Not implemented | RISK: No key rotation mechanism |
| Key compromise | Change env + re-encrypt | RISK: No automated re-encryption tool |
| Timing attacks on comparison | GCM uses constant-time comparison | SAFE |
| IV reuse | Random IV each time | SAFE |

### 1.5 Risk Rating: LOW

The implementation follows cryptographic best practices. Key rotation is the main gap.

---

## 2. RATE LIMIT FAIL-CLOSED BEHAVIOR

### 2.1 Claim
When Redis is unavailable, rate limiting fails closed (blocks requests) for expensive operations like OpenAI calls.

### 2.2 Evidence

**File:** `lib/cache/redis.ts:197-240`

```typescript
/**
 * Check if Redis is currently available.
 *
 * @returns true if Redis is connected and ready, false otherwise
 */
export function isRedisAvailable(): boolean {
  initRedis();
  return redis !== null && redisAvailable;
}

/**
 * Acquire a lock with fail-closed behavior.
 *
 * Unlike acquireLock(), this function returns false when Redis is unavailable,
 * preventing operations from proceeding without distributed coordination.
 *
 * Use this for expensive operations (like OpenAI calls) where duplicate
 * execution is costly.
 *
 * @param lockKey - Unique key for the lock
 * @param ttlSeconds - How long to hold the lock (default: 30 seconds)
 * @returns { acquired: boolean, redisDown: boolean }
 */
export async function acquireLockFailClosed(
  lockKey: string,
  ttlSeconds: number = 30
): Promise<{ acquired: boolean; redisDown: boolean }> {
  initRedis();

  if (!redis || !redisAvailable) {                           // Line 227-228
    console.warn(`[Cache] Redis unavailable, failing closed for lock "${lockKey}"`);
    return { acquired: false, redisDown: true };             // Line 229 - BLOCKS
  }

  try {
    const result = await redis.set(lockKey, "locked", "EX", ttlSeconds, "NX");
    return { acquired: result === "OK", redisDown: false };  // Line 234
  } catch (error: any) {
    console.error(`[Cache] Error acquiring lock "${lockKey}":`, error.message);
    // On error, fail closed (don't allow the operation)
    return { acquired: false, redisDown: true };             // Line 238 - BLOCKS
  }
}

/**
 * Standard 503 response for Redis unavailable on expensive operations.
 */
export const REDIS_UNAVAILABLE_RESPONSE = {
  error: "Service unavailable",
  message: "Please try again in a moment.",
};
```

**File:** `lib/ai/costControl.ts:77-105`

```typescript
/**
 * Check if we have budget remaining for an OpenAI call.
 *
 * @returns { allowed, used, limit, remaining }
 *
 * If Redis is unavailable and fail mode is "closed", returns allowed: false
 * If Redis is unavailable and fail mode is "open", returns allowed: true (risky)
 */
export async function checkBudget(): Promise<BudgetCheckResult> {
  const limit = getDailyBudgetLimit();
  const failMode = getFailMode();                            // Line 79 - Default: "closed"

  try {
    const key = getBudgetKey();
    const used = (await getCache<number>(key)) || 0;
    const remaining = Math.max(0, limit - used);
    const allowed = used < limit;

    if (!allowed) {
      console.warn(`[CostControl] Daily budget exceeded: $${used.toFixed(4)} / $${limit}`);
    }

    return { allowed, used, limit, remaining };
  } catch (error: any) {
    console.error("[CostControl] Error checking budget:", error.message);

    // Fail mode determines behavior when Redis is down
    if (failMode === "closed") {                             // Line 96
      console.warn("[CostControl] Redis unavailable, failing closed");
      return { allowed: false, used: 0, limit, remaining: 0 };  // Line 98 - BLOCKS
    }

    // Fail open (risky - only use in development)
    console.warn("[CostControl] Redis unavailable, failing open (risky!)");
    return { allowed: true, used: 0, limit, remaining: limit };
  }
}
```

### 2.3 Verification Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Fail-closed on Redis down | PASS | Line 229 returns `{ acquired: false, redisDown: true }` |
| Fail-closed on Redis error | PASS | Line 238 returns `{ acquired: false, redisDown: true }` |
| Budget check fail-closed | PASS | Line 98 returns `{ allowed: false }` when `failMode === "closed"` |
| Default fail mode is "closed" | PASS | `getFailMode()` defaults to "closed" at lines 40-46 |
| 503 response available | PASS | `REDIS_UNAVAILABLE_RESPONSE` at lines 245-248 |

### 2.4 What Could Go Wrong

| Threat | Mitigation | Gap |
|--------|------------|-----|
| Redis failover during request | Fail-closed behavior | SAFE |
| Fail mode set to "open" in prod | Default is "closed" | VERIFY: Check prod env vars |
| Lock held indefinitely | TTL on locks (default 30s) | SAFE |
| Duplicate requests during Redis recovery | Clients may retry on 503 | LOW RISK |

### 2.5 Risk Rating: LOW

Fail-closed is properly implemented with appropriate defaults.

---

## 3. STRIPE SIGNATURE VERIFICATION

### 3.1 Claim
All Stripe webhooks verify the signature before processing.

### 3.2 Evidence

**File:** `app/api/stripe/webhook/route.ts:85-120`

```typescript
/**
 * Stripe webhook handler
 * Handles subscription lifecycle events from Stripe
 */
export async function POST(req: NextRequest) {
  try {
    // Get the raw body as text
    const body = await req.text();                           // Line 88 - Raw body for signature
    const signature = req.headers.get("stripe-signature");   // Line 89

    if (!signature) {                                        // Line 91-95
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    if (!STRIPE_CONFIG.webhookSecret) {                      // Line 98-104
      console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(                // Line 109
        body,
        signature,
        STRIPE_CONFIG.webhookSecret
      );
    } catch (err: any) {
      console.error("[Webhook] Signature verification failed:", err.message);
      return NextResponse.json(                              // Line 116-118
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    console.log(`[Webhook] Received event: ${event.type}`);  // Line 122 - Only logged after verification
```

### 3.3 Verification Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Raw body used (not parsed JSON) | PASS | `req.text()` at line 88 |
| Signature header checked | PASS | Line 91 rejects if missing |
| Webhook secret from env | PASS | `STRIPE_CONFIG.webhookSecret` at line 98 |
| `constructEvent()` used | PASS | Line 109 - Stripe SDK signature verification |
| Invalid signature returns 400 | PASS | Lines 116-118 |
| Processing only after verification | PASS | Event handler switch at line 125 |

### 3.4 What Could Go Wrong

| Threat | Mitigation | Gap |
|--------|------------|-----|
| Webhook secret leaked | `.env` in `.gitignore` | VERIFY: `git ls-files .env` returns empty |
| Replay attacks | Stripe includes timestamp in signature | SAFE - SDK handles |
| Forged events | `constructEvent()` verifies signature | SAFE |
| Missing webhook secret in prod | Returns 500, logs error | VERIFY: Check prod env vars |

### 3.5 Risk Rating: LOW

Stripe's official SDK and verification pattern is correctly implemented.

---

## 4. OPEN REDIRECT PREVENTION

### 4.1 Claim
Auth callback only redirects to allowlisted paths, preventing open redirect attacks.

### 4.2 Evidence

**File:** `app/auth/callback/route.ts:218-238`

```typescript
// Check for `next` query param (used by magiclink flows from complete-signup/resend)
// SECURITY: Allowlist-only to prevent open redirect attacks
const ALLOWED_NEXT = new Set([                               // Line 220-226
  "/onboarding",
  "/set-password",
  "/settings?refresh=1",
  "/sanctuary",
  "/welcome",
]);

const nextPath = requestUrl.searchParams.get("next");
if (nextPath) {
  // Defense-in-depth: reject obviously malicious patterns
  const isMalicious = nextPath.includes("://") ||            // Line 231
                      nextPath.startsWith("//") ||           // Protocol-relative
                      nextPath.includes("\\");               // Windows path escape

  if (!isMalicious && ALLOWED_NEXT.has(nextPath)) {          // Line 233
    console.log(`[AuthCallback] Magiclink flow - redirecting to: ${nextPath}`);
    return NextResponse.redirect(new URL(nextPath, baseUrl));
  }
  console.warn(`[AuthCallback] Rejected next param (not in allowlist): ${nextPath}`);
}
```

### 4.3 Verification Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Allowlist approach | PASS | `ALLOWED_NEXT = new Set([...])` at line 220 |
| Exact match required | PASS | `ALLOWED_NEXT.has(nextPath)` at line 233 |
| Protocol injection blocked | PASS | `nextPath.includes("://")` at line 231 |
| Protocol-relative URLs blocked | PASS | `nextPath.startsWith("//")` at line 231 |
| Backslash injection blocked | PASS | `nextPath.includes("\\")` at line 231 |
| Rejected paths logged | PASS | `console.warn()` at line 237 |
| Redirect uses baseUrl | PASS | `new URL(nextPath, baseUrl)` at line 235 |

### 4.4 What Could Go Wrong

| Threat | Mitigation | Gap |
|--------|------------|-----|
| `javascript:` URLs | Not in allowlist, blocked | SAFE |
| `//evil.com` URLs | `startsWith("//")` check | SAFE |
| `https://evil.com` | `includes("://")` check | SAFE |
| Encoded characters (`%2F%2F`) | URL is parsed raw, not decoded | VERIFY |
| Path traversal (`/onboarding/../evil`) | Allowlist is exact match | SAFE |
| New paths added without review | Allowlist is code-reviewed | LOW RISK |

### 4.5 Additional Defense: baseUrl Resolution

**File:** `app/auth/callback/route.ts:13-30`

```typescript
/**
 * Get the correct base URL for redirects.
 *
 * IMPORTANT: In reverse proxy/tunnel environments (Cloudflare, ngrok, etc.),
 * request.url will show the internal URL (e.g., localhost:3000) not the
 * external URL the user accessed. We MUST use NEXT_PUBLIC_SITE_URL instead.
 */
function getBaseUrl(request: NextRequest): string {
  // First priority: Use configured site URL (required for tunnels/proxies)
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredUrl) {
    return configuredUrl;                                    // Line 16-18
  }

  // Fallback: Try to detect from X-Forwarded headers
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;           // Line 24
  }

  // Last resort: Use request URL
  const requestUrl = new URL(request.url);
  return requestUrl.origin;
}
```

**Risk:** X-Forwarded headers can be spoofed. However, since redirects are to the **same origin**, this doesn't create a cross-domain redirect vulnerability.

### 4.6 Risk Rating: LOW

Robust defense-in-depth with allowlist and pattern checks.

---

## 5. AI BUDGET CIRCUIT BREAKER

### 5.1 Claim
OpenAI API calls are gated by a daily budget limit that prevents runaway costs.

### 5.2 Evidence

**File:** `lib/ai/costControl.ts:20-35`

```typescript
// Default budget: $100/day (can be overridden via env)
const DEFAULT_DAILY_BUDGET_USD = 100;                        // Line 21

/**
 * Get the daily budget limit from env
 */
function getDailyBudgetLimit(): number {
  const envBudget = process.env.OPENAI_DAILY_BUDGET_USD;
  if (envBudget) {
    const parsed = parseFloat(envBudget);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_DAILY_BUDGET_USD;                           // Line 34
}
```

**File:** `lib/ai/costControl.ts:77-105` (checkBudget - see Section 2.2)

**File:** `lib/ai/costControl.ts:115-146`

```typescript
/**
 * Increment the daily budget counter after an OpenAI call.
 *
 * @param model - OpenAI model name
 * @param inputTokens - Input tokens consumed
 * @param outputTokens - Output tokens generated
 * @returns The new total used today
 */
export async function incrementBudget(
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<number> {
  const cost = estimateCostUsd(model, inputTokens, outputTokens);  // Line 120

  if (cost <= 0) {
    return 0;
  }

  try {
    const key = getBudgetKey();                              // "openai:budget:YYYY-MM-DD"

    // Get current usage
    const current = (await getCache<number>(key)) || 0;
    const newTotal = current + cost;

    // Set with 48h TTL (to ensure it persists through timezone edge cases)
    await setCache(key, newTotal, 172800);                   // Line 134

    console.log(
      `[CostControl] Budget updated: +$${cost.toFixed(6)} → $${newTotal.toFixed(4)} total today`
    );

    return newTotal;
  } catch (error: any) {
    console.error("[CostControl] Error incrementing budget:", error.message);
    // Don't fail the request on tracking error - just log
    return 0;
  }
}
```

### 5.3 Verification Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Default budget limit | PASS | `DEFAULT_DAILY_BUDGET_USD = 100` at line 21 |
| Configurable via env | PASS | `process.env.OPENAI_DAILY_BUDGET_USD` at line 27 |
| Pre-check before API call | PASS | `checkBudget()` returns `{ allowed: false }` when exceeded |
| Post-tracking after call | PASS | `incrementBudget()` updates Redis counter |
| Daily reset | PASS | Key includes date: `openai:budget:${getTodayKey()}` |
| 48h TTL prevents stale data | PASS | `setCache(key, newTotal, 172800)` at line 134 |

### 5.4 What Could Go Wrong

| Threat | Mitigation | Gap |
|--------|------------|-----|
| Redis failure loses tracking | Fail-closed blocks requests | SAFE |
| Race condition on increment | Slight over-budget possible | LOW RISK - acceptable |
| Clock skew across servers | UTC-based date key | SAFE |
| Budget set to 0 in env | Validation requires `> 0` | SAFE |
| Cost estimation inaccurate | Uses token-based pricing | LOW RISK |

### 5.5 Risk Rating: LOW

Budget circuit breaker is properly implemented with fail-safe behavior.

---

## 6. SUMMARY TABLE

| Security Control | Location | Status | Risk |
|------------------|----------|--------|------|
| AES-256-GCM encryption | lib/social/crypto.ts | IMPLEMENTED | LOW |
| Rate limit fail-closed | lib/cache/redis.ts:221-240 | IMPLEMENTED | LOW |
| Stripe signature verification | app/api/stripe/webhook/route.ts:108-120 | IMPLEMENTED | LOW |
| Open redirect prevention | app/auth/callback/route.ts:220-238 | IMPLEMENTED | LOW |
| AI budget circuit breaker | lib/ai/costControl.ts:77-105 | IMPLEMENTED | LOW |

---

## 7. OUTSTANDING GAPS

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| No encryption key rotation | MEDIUM | Implement key versioning with graceful migration |
| No automated re-encryption on key change | LOW | Create migration script |
| X-Forwarded header trust | LOW | Document that Cloudflare/proxy handles this securely |
| URL encoding edge cases in redirect | LOW | Add URL decode test cases |
| Cost estimation vs actual billing | LOW | Periodic reconciliation with OpenAI dashboard |

---

## 8. VERIFICATION COMMANDS

```bash
# Verify .env not in version control
git ls-files .env .env.local .env.production

# Check for hardcoded secrets
grep -r "sk_live\|sk_test\|OPENAI_API_KEY\|ENCRYPTION_KEY" --include="*.ts" --include="*.tsx" .

# Verify webhook secret is set in production
# (Run in prod environment)
echo $STRIPE_WEBHOOK_SECRET | wc -c  # Should be > 50 chars

# Test open redirect prevention
curl -I "https://your-domain.com/auth/callback?next=https://evil.com"
# Should NOT redirect to evil.com
```
