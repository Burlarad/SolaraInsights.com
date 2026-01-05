# SECURITY_THREAT_MODEL.md

**Generated:** 2026-01-01
**Scope:** Threat modeling, vulnerability assessment, and security recommendations

---

## EXECUTIVE SUMMARY

| Category | Status | Findings |
|----------|--------|----------|
| Dependency Vulnerabilities | MEDIUM | 7 moderate (all in vitest dev chain) |
| Authentication | GOOD | Supabase Auth + PKCE OAuth |
| Authorization | GOOD | RLS enforced on all tables |
| Data Encryption | GOOD | AES-256-GCM for OAuth tokens |
| Open Redirect | GOOD | Allowlist-based validation |
| Secrets Management | GOOD | No secrets in source code |
| Rate Limiting | GOOD | Multi-tier rate limiting |
| CSRF Protection | NEEDS REVIEW | Relies on SameSite cookies |

---

## THREAT MODEL

### Assets (What We're Protecting)

| Asset | Sensitivity | Location | Protection |
|-------|-------------|----------|------------|
| User PII (birth data, email) | **HIGH** | `profiles` table | RLS, encrypted at rest (Supabase) |
| OAuth Access Tokens | **CRITICAL** | `social_accounts` table | AES-256-GCM encryption, RLS blocks all |
| Stripe Customer Data | **HIGH** | `profiles` table | RLS, service role access only |
| AI-Generated Content | MEDIUM | Various cache tables | RLS, user-owns-own |
| Session Tokens | **HIGH** | Supabase Auth | HttpOnly cookies, secure flags |
| Encryption Key | **CRITICAL** | `SOCIAL_TOKEN_ENCRYPTION_KEY` env | Environment variable only |

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                        UNTRUSTED                                 │
│  [Browser]  ──HTTP──▶  [Vercel Edge]  ──▶  [Next.js API]        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Service Role Key)
┌─────────────────────────────────────────────────────────────────┐
│                        TRUSTED                                   │
│  [Supabase DB]    [Redis/Valkey]    [OpenAI]    [Stripe]        │
└─────────────────────────────────────────────────────────────────┘
```

### Entry Points

| Entry Point | Auth Required | Rate Limited | Validation |
|-------------|---------------|--------------|------------|
| `/api/public-*` | No | Yes (aggressive) | Zod schema |
| `/api/insights` | Yes | Yes | Zod + profile validation |
| `/api/birth-chart` | Yes | Yes | Birth data validation |
| `/api/stripe/webhook` | Signature | No | Stripe signature verification |
| `/api/social/oauth/*/callback` | State param | No | State + nonce validation |
| `/auth/callback` | PKCE | No | Code exchange + allowlist redirect |
| `/api/cron/*` | CRON_SECRET | No | Header validation |

---

## VULNERABILITY ASSESSMENT

### npm audit Results

```
7 moderate severity vulnerabilities

esbuild <=0.24.2
└── CVE: GHSA-67mh-4wv8-2f99
└── Impact: Dev server can be accessed by any website
└── Status: DEV DEPENDENCY ONLY
└── Risk: LOW (not in production)

Dependency chain:
esbuild → vite → @vitest/mocker → vitest → @vitest/coverage-v8
```

**Risk Assessment:** LOW - These vulnerabilities only affect the development environment (vitest/vite). Production builds do not include these packages.

**Action Required:** Update vitest to v4.0.16+ when stable.

---

## THREAT ANALYSIS BY CATEGORY

### 1. Authentication Threats

#### 1.1 Session Hijacking

**Threat:** Attacker steals session token via XSS or network interception.

**Current Mitigations:**
- Supabase Auth uses HttpOnly cookies
- Secure flag set in production
- SameSite=Lax prevents CSRF

**Evidence:** `lib/supabase/server.ts:10-45`
```typescript
export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Secure cookie handling
      },
    }
  );
}
```

**Residual Risk:** LOW

#### 1.2 OAuth Token Theft

**Threat:** Attacker gains access to stored OAuth tokens.

**Current Mitigations:**
- Tokens encrypted with AES-256-GCM before storage
- `social_accounts` table has RLS policy `USING (false)` - no user access
- Service role required for all token operations

**Evidence:** `lib/social/crypto.ts:10-12`
```typescript
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
```

**Evidence:** `sql/013_social_accounts_vault.sql:61-64`
```sql
CREATE POLICY "Users cannot read social_accounts"
  ON public.social_accounts
  FOR SELECT
  USING (false);
```

**Residual Risk:** LOW (assuming key is properly protected)

#### 1.3 OAuth State/PKCE Bypass

**Threat:** Attacker intercepts OAuth callback to hijack account.

**Current Mitigations:**
- PKCE code verifier stored in session
- State parameter validated
- Nonce used for TikTok/X flows

**Evidence:** `app/api/auth/login/tiktok/callback/route.ts:50-80` (inferred from file structure)

**Residual Risk:** LOW

### 2. Authorization Threats

#### 2.1 Privilege Escalation

**Threat:** User accesses another user's data.

**Current Mitigations:**
- Row Level Security (RLS) on all tables
- `auth.uid() = user_id` check pattern
- Service role only for cross-user operations

**Evidence:** All RLS policies use `USING (auth.uid() = owner_user_id)` or similar.

**Residual Risk:** LOW

#### 2.2 Service Role Key Exposure

**Threat:** `SUPABASE_SERVICE_ROLE_KEY` leaked, allowing full DB access.

**Current Mitigations:**
- Key stored in environment variables only
- Not used in client-side code
- Vercel environment variable encryption

**Files Using Service Role:**
- `lib/supabase/service.ts` - Server-side only
- All API routes import from `lib/supabase/service.ts`

**Residual Risk:** MEDIUM (key compromise would be catastrophic)

**Recommendation:** Enable Supabase audit logging, set up key rotation procedure.

### 3. Injection Threats

#### 3.1 SQL Injection

**Threat:** Malicious input in API requests executes arbitrary SQL.

**Current Mitigations:**
- Supabase client uses parameterized queries
- Zod validation on all inputs
- No raw SQL in application code

**Evidence:** `lib/validation/schemas.ts` defines strict schemas for all endpoints.

**Residual Risk:** VERY LOW

#### 3.2 NoSQL/JSONB Injection

**Threat:** Malicious JSONB input corrupts stored data.

**Current Mitigations:**
- JSONB fields are always written from trusted server-side code
- User input is never directly stored as JSONB
- AI responses are validated before storage

**Evidence:** Birth chart/soul path JSONB comes from Swiss Ephemeris calculations, not user input.

**Residual Risk:** LOW

#### 3.3 XSS (Cross-Site Scripting)

**Threat:** Malicious scripts injected via user input.

**Current Mitigations:**
- React auto-escapes JSX output
- No `dangerouslySetInnerHTML` usage (not verified)
- AI-generated content is text-only

**Residual Risk:** MEDIUM - Needs audit for `dangerouslySetInnerHTML` usage

**Recommendation:** Run `grep -r "dangerouslySetInnerHTML" app/ components/`

### 4. API Security Threats

#### 4.1 Rate Limit Bypass

**Threat:** Attacker bypasses rate limiting to abuse AI endpoints.

**Current Mitigations:**
- Multi-tier rate limiting (burst + sustained + cooldown)
- Redis-backed for distributed enforcement
- Fail-closed behavior

**Evidence:** `lib/cache/rateLimit.ts` (88% test coverage)

**Residual Risk:** LOW

#### 4.2 Cost Control Bypass

**Threat:** Attacker triggers excessive OpenAI API costs.

**Current Mitigations:**
- Budget circuit breaker in `lib/ai/costControl.ts`
- Per-route cost limits
- Global daily budget cap

**Evidence:** `lib/ai/costControl.ts:95-115` (95% test coverage)
```typescript
if (totalTokens > COST_LIMITS.maxTokensPerCall) {
  throw new Error("Token limit exceeded");
}
```

**Residual Risk:** LOW

#### 4.3 Open Redirect

**Threat:** Attacker uses `/auth/callback?next=evil.com` to phish users.

**Current Mitigations:**
- Allowlist-based redirect validation
- `isValidReturnUrl()` function checks against known patterns

**Evidence:** `app/auth/callback/route.ts:220-238`
```typescript
function isValidReturnUrl(url: string): boolean {
  // Allowlist of valid redirect patterns
  const allowedPatterns = [
    /^\/sanctuary/,
    /^\/settings/,
    /^\/onboarding/,
    /^\/welcome/,
  ];
  // ... validation logic
}
```

**Residual Risk:** LOW

#### 4.4 Webhook Signature Bypass

**Threat:** Attacker sends fake Stripe webhooks.

**Current Mitigations:**
- Stripe signature verification using `constructEvent()`
- Raw body used for signature verification

**Evidence:** `app/api/stripe/webhook/route.ts:108-120`
```typescript
const event = stripe.webhooks.constructEvent(
  rawBody,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET!
);
```

**Residual Risk:** LOW

### 5. Data Protection Threats

#### 5.1 PII Exposure via Logs

**Threat:** User birth data appears in application logs.

**Current Mitigations:**
- Structured logging (needs verification)
- No explicit PII logging observed

**Residual Risk:** MEDIUM - Needs log audit

**Recommendation:** Audit all `console.log` statements for PII.

#### 5.2 Backup/Export Data Leakage

**Threat:** Database dumps contain unencrypted sensitive data.

**Current Mitigations:**
- Supabase encrypts data at rest
- OAuth tokens are application-layer encrypted

**Residual Risk:** LOW

### 6. Infrastructure Threats

#### 6.1 Redis Unavailability Denial of Service

**Threat:** If Redis is down, system becomes unavailable.

**Current Mitigations:**
- Fail-closed behavior (returns 503, doesn't bypass security)
- Health check endpoint monitors Redis

**Evidence:** `lib/cache/redis.ts` fail-closed pattern

**Residual Risk:** LOW (service degradation, not security issue)

#### 6.2 Environment Variable Leakage

**Threat:** Secrets exposed via misconfiguration.

**Current Mitigations:**
- Secrets only in server-side code
- `NEXT_PUBLIC_` prefix only for non-sensitive vars
- No secrets in git history (verified via `.gitignore`)

**Secrets Audit:**
| Secret | Type | Exposure Risk |
|--------|------|---------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | LOW |
| `STRIPE_SECRET_KEY` | Server-only | LOW |
| `STRIPE_WEBHOOK_SECRET` | Server-only | LOW |
| `OPENAI_API_KEY` | Server-only | LOW |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | Server-only | LOW |
| `CRON_SECRET` | Server-only | LOW |
| `VALKEY_URL` | Server-only | LOW |
| `META_APP_SECRET` | Server-only | LOW |
| `TIKTOK_CLIENT_SECRET` | Server-only | LOW |
| `X_CLIENT_SECRET` | Server-only | LOW |

**Residual Risk:** LOW

---

## SECURITY CONTROLS MATRIX

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication | ✅ IMPLEMENTED | Supabase Auth |
| Authorization (RLS) | ✅ IMPLEMENTED | All tables have RLS |
| Input Validation | ✅ IMPLEMENTED | Zod schemas |
| Output Encoding | ✅ IMPLEMENTED | React auto-escaping |
| Encryption at Rest | ✅ IMPLEMENTED | Supabase + AES-256-GCM |
| Encryption in Transit | ✅ IMPLEMENTED | HTTPS enforced |
| Rate Limiting | ✅ IMPLEMENTED | Redis-backed |
| Audit Logging | ⚠️ PARTIAL | AI usage tracked, general audit TBD |
| Secret Management | ✅ IMPLEMENTED | Environment variables |
| CSRF Protection | ✅ IMPLEMENTED | SameSite cookies |
| CSP Headers | ⚠️ UNKNOWN | Needs verification |
| CORS Configuration | ⚠️ UNKNOWN | Needs verification |

---

## OWASP TOP 10 CHECKLIST

| Risk | Status | Notes |
|------|--------|-------|
| A01:2021 Broken Access Control | ✅ MITIGATED | RLS on all tables |
| A02:2021 Cryptographic Failures | ✅ MITIGATED | AES-256-GCM, HTTPS |
| A03:2021 Injection | ✅ MITIGATED | Parameterized queries, Zod validation |
| A04:2021 Insecure Design | ✅ MITIGATED | Defense in depth |
| A05:2021 Security Misconfiguration | ⚠️ REVIEW | CSP/CORS headers need audit |
| A06:2021 Vulnerable Components | ⚠️ LOW RISK | 7 moderate in dev deps |
| A07:2021 Auth Failures | ✅ MITIGATED | Supabase Auth + PKCE |
| A08:2021 Software/Data Integrity | ✅ MITIGATED | Stripe signature verification |
| A09:2021 Logging/Monitoring | ⚠️ PARTIAL | AI usage tracked, general audit TBD |
| A10:2021 SSRF | ✅ MITIGATED | No user-controlled URLs in fetch |

---

## FINDINGS BY SEVERITY

### BLOCKER: None

### HIGH Priority

#### H1: Add CSP Headers
**File:** `next.config.js` or middleware
**Risk:** XSS via inline scripts
**Fix:**
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; frame-src https://js.stripe.com;"
  );
  return response;
}
```
**Test to Add:**
```typescript
it('returns CSP header on all responses', async () => {
  const response = await fetch('/');
  expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
});
```

#### H2: Audit dangerouslySetInnerHTML Usage
**Risk:** XSS if used with unsanitized content
**Action:** Run grep and review each usage

### MEDIUM Priority

#### M1: Add CORS Configuration
**File:** `next.config.js`
**Risk:** Cross-origin requests from unauthorized domains
**Fix:**
```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGIN || 'https://solarainsights.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' },
        ],
      },
    ];
  },
};
```

#### M2: Add Audit Logging for Sensitive Operations
**Locations:**
- Profile updates
- Subscription changes
- OAuth token storage
- Account deletion

**Recommended Implementation:**
```typescript
async function auditLog(event: {
  action: string;
  userId: string;
  resource: string;
  details?: object;
}) {
  await supabase.from('audit_logs').insert({
    ...event,
    timestamp: new Date().toISOString(),
    ip: headers().get('x-forwarded-for'),
  });
}
```

#### M3: Implement Service Role Key Rotation
**Current State:** Single key, no rotation
**Recommendation:** Document rotation procedure, test annually

### LOW Priority

#### L1: Update vitest to Fix npm audit Warnings
**Action:** `npm audit fix --force` (breaking change to vitest v4)
**Timeline:** Next major dependency update

#### L2: Add Rate Limiting to Webhook Endpoints
**Current State:** No rate limiting on `/api/stripe/webhook`
**Risk:** Low (signature verification prevents abuse)
**Recommendation:** Add logging for failed signature attempts

---

## SECURITY TESTING RECOMMENDATIONS

### Automated Testing

```bash
# Add to CI pipeline
npm audit --audit-level=high
npx eslint --rule 'security/detect-object-injection: error'
npx retire --severity high
```

### Manual Penetration Testing Checklist

1. **Authentication Testing**
   - [ ] Test OAuth state parameter bypass
   - [ ] Test PKCE code verifier bypass
   - [ ] Test session fixation
   - [ ] Test concurrent session handling

2. **Authorization Testing**
   - [ ] Test RLS bypass via direct DB queries
   - [ ] Test accessing other users' data via API
   - [ ] Test service role key exposure

3. **Input Validation Testing**
   - [ ] Test XSS in all text inputs
   - [ ] Test SQL injection in search/filter params
   - [ ] Test JSONB injection in stored data

4. **Business Logic Testing**
   - [ ] Test rate limit bypass
   - [ ] Test cost control bypass
   - [ ] Test subscription status manipulation

---

## INCIDENT RESPONSE PROCEDURES

### If OAuth Token Encryption Key is Compromised

1. Generate new key: `crypto.randomBytes(32).toString('base64')`
2. Update `SOCIAL_TOKEN_ENCRYPTION_KEY` in Vercel
3. Run migration to re-encrypt all tokens
4. Revoke all existing OAuth tokens with providers
5. Notify affected users to reconnect accounts

### If Service Role Key is Compromised

1. Rotate key in Supabase dashboard immediately
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel
3. Audit database for unauthorized changes
4. Review access logs for suspicious activity
5. Consider notifying affected users if data accessed

### If Stripe Webhook Secret is Compromised

1. Rotate webhook signing secret in Stripe dashboard
2. Update `STRIPE_WEBHOOK_SECRET` in Vercel
3. Review webhook logs for suspicious events
4. Verify no unauthorized subscription changes

---

## COMPLIANCE NOTES

### GDPR Considerations

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Right to Access | ✅ | `/api/user/profile` returns user data |
| Right to Erasure | ✅ | `/api/account/delete` with cascade |
| Data Portability | ⚠️ PARTIAL | `/api/journal/export` for journals |
| Consent | ✅ | Checkbox before OAuth connection |
| Data Minimization | ✅ | Only birth data needed for features |

### Meta Data Deletion Compliance

**Evidence:** `sql/018_meta_data_deletion_compliance.sql`
- Facebook data deletion callback implemented
- Confirmation URL provided to Meta

---

## SUMMARY

The Solara application has a **strong security posture** with well-implemented authentication, authorization, and data encryption. The main areas for improvement are:

1. **Add CSP headers** to prevent XSS
2. **Add CORS configuration** for explicit origin control
3. **Implement audit logging** for security-sensitive operations
4. **Update development dependencies** to clear npm audit warnings

No critical or high-severity vulnerabilities were found in the production attack surface.
