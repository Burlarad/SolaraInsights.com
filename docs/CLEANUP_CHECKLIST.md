# Solara Cleanup Checklist

**Version:** 1.0
**Date:** 2026-01-01

This checklist tracks technical debt, cleanup tasks, and improvements identified during the audit.

---

## Priority Legend

| Priority | Timeline | Description |
|----------|----------|-------------|
| P0 | Immediate | Before next deploy |
| P1 | This sprint | Within 1-2 weeks |
| P2 | Backlog | When time permits |

---

## P0 - Immediate (Before Next Deploy)

### Security Fixes

- [ ] **Fix OpenAI model name defaults**
  - File: [lib/openai/client.ts:20-39](lib/openai/client.ts#L20-L39)
  - Issue: Default model names like "gpt-4.1-mini" and "gpt-5.1" are not valid
  - Fix: Change to "gpt-4o-mini" and "gpt-4o"
  - Test: Verify API calls succeed without env overrides

- [ ] **Add Stripe key validation in production**
  - File: [lib/stripe/client.ts:3-12](lib/stripe/client.ts#L3-L12)
  - Issue: Stripe client created with empty key if env var missing
  - Fix: Throw error in production if STRIPE_SECRET_KEY missing
  - Test: Verify build fails without required env vars

### Critical Bug Fixes

- [ ] **Fix server-side timezone detection**
  - File: [app/auth/callback/route.ts:106](app/auth/callback/route.ts#L106)
  - Issue: `Intl.DateTimeFormat()` returns server timezone, not user's
  - Fix: Use client-side detection or require user input
  - Test: Verify new users get correct timezone

---

## P1 - This Sprint

### Code Consolidation

- [ ] **Consolidate Supabase admin clients**
  - Files:
    - [lib/supabase/server.ts](lib/supabase/server.ts) (`createAdminSupabaseClient`)
    - [lib/supabase/service.ts](lib/supabase/service.ts) (`createServiceSupabaseClient`)
  - Issue: Two nearly identical functions
  - Fix: Keep one, remove or alias the other
  - Test: Update all imports, verify functionality

- [ ] **Remove legacy OPENAI_MODELS entries**
  - File: [lib/openai/client.ts:36-38](lib/openai/client.ts#L36-L38)
  - Issue: Legacy keys `insights` and `placements` duplicate others
  - Fix: Remove and update any usages
  - Test: Grep for legacy keys, update callers

### Dead Code Removal

- [ ] **Remove or feature-flag X OAuth code**
  - File: [lib/oauth/providers/x.ts](lib/oauth/providers/x.ts)
  - Issue: 231 lines of disabled code
  - Options:
    - Move to separate branch
    - Add clear feature flag documentation
  - Test: N/A if removed

- [ ] **Clean up week/month timeframe handling**
  - Files: Multiple in `app/api/`
  - Issue: Week/month disabled but code remains
  - Fix: Remove dead branches for unsupported timeframes
  - Test: Verify insights API still works

### Missing Tests

- [ ] **Add Stripe webhook signature test**
  - File: Create `__tests__/payments/webhook-security.test.ts`
  - Coverage: Invalid signatures rejected, replay protection

- [ ] **Add cost control Redis failure test**
  - File: Extend `__tests__/infrastructure/cost-control.test.ts`
  - Coverage: Fail-closed behavior when Redis unavailable

- [ ] **Add auth callback security tests**
  - File: Create `__tests__/auth/callback-security.test.ts`
  - Coverage: Open redirect prevention, reauth validation

### Translation Improvements

- [ ] **Move hardcoded numerology meanings to translations**
  - File: [lib/numerology/meanings.ts](lib/numerology/meanings.ts)
  - Issue: English-only content
  - Fix: Move to `messages/*.json` or document as English-only
  - Test: Verify numerology page works in non-English

---

## P2 - Backlog

### Technical Debt

- [ ] **Implement structured logging**
  - Issue: `console.log/warn/error` throughout codebase
  - Fix: Use pino or winston with log levels
  - Files affected: ~50+ files

- [ ] **Add request ID to all API routes**
  - Issue: Some routes missing requestId in errors
  - Fix: Wrap all routes with error middleware
  - Benefit: Better debugging/support

- [ ] **Upgrade crypto for request IDs**
  - File: [lib/api/errorResponse.ts:12-14](lib/api/errorResponse.ts#L12-L14)
  - Issue: `Math.random()` not cryptographically secure
  - Fix: Use `crypto.randomUUID().substring(0, 8)`

### Code Quality

- [ ] **Add JSDoc comments to public exports**
  - Files: All `lib/` exports
  - Benefit: Better IDE support, documentation

- [ ] **Standardize error messages**
  - Issue: Inconsistent error message formats
  - Fix: Create error message constants

- [ ] **Add return type annotations**
  - Issue: Some functions missing explicit return types
  - Fix: Add TypeScript annotations

### Performance

- [ ] **Audit cache TTLs**
  - Files: [app/api/insights/route.ts:48-60](app/api/insights/route.ts#L48-L60)
  - Issue: Some TTLs may be suboptimal
  - Review: daily=48h, weekly=10d, monthly=40d, yearly=400d

- [ ] **Add cache warming for common queries**
  - Issue: Cold start latency for first users
  - Fix: Expand prewarm cron job

### Documentation

- [ ] **Add API documentation (OpenAPI/Swagger)**
  - Issue: No formal API docs
  - Fix: Generate from route handlers

- [ ] **Document environment variables**
  - Issue: Scattered across codebase
  - Fix: Create comprehensive .env.example

---

## Files to Delete

| File | Reason | Blocked By |
|------|--------|------------|
| `scripts/add-asian-translations.js` | One-time migration script | Already in git history |
| `scripts/add-final-translations.js` | One-time migration script | Already in git history |
| `scripts/add-numerology-translations.js` | One-time migration script | Already in git history |
| `scripts/add-remaining-translations.js` | One-time migration script | Already in git history |

---

## Database Cleanup

### Unused Columns (Verify Before Removing)

- [ ] Review `profiles.location_for_charity` usage
- [ ] Review `profiles.latitude/longitude` vs `birth_lat/birth_lon`

### Index Optimization

- [ ] Review slow query logs in Supabase
- [ ] Add indexes based on actual query patterns

---

## Dependencies to Update

### Security Updates

```bash
npm audit
```

### Major Version Updates (Review Breaking Changes)

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| next | 15.0.0 | Check | App Router stable |
| @supabase/ssr | 0.8.0 | Check | Auth patterns |
| stripe | 20.0.0 | Check | Webhook handling |

### Dev Dependencies

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| vitest | 2.1.8 | Check | Test runner |
| typescript | 5.9.3 | Check | Type checking |

---

## Environment Variable Cleanup

### Required (Document in .env.example)

```env
# Database
NEXT_PUBLIC_SUPABASE_URL=required
NEXT_PUBLIC_SUPABASE_ANON_KEY=required
SUPABASE_SERVICE_ROLE_KEY=required

# Payments
STRIPE_SECRET_KEY=required
STRIPE_WEBHOOK_SECRET=required
STRIPE_PRICE_ID=required

# AI
OPENAI_API_KEY=required

# Site
NEXT_PUBLIC_SITE_URL=required
```

### Optional (Document Defaults)

```env
# Optional - graceful degradation if missing
REDIS_URL=optional (caching disabled without)
OPENAI_DAILY_BUDGET_USD=100
OPENAI_BUDGET_FAIL_MODE=closed

# Optional - per social provider
META_CLIENT_ID=optional
META_CLIENT_SECRET=optional
SOCIAL_TOKEN_ENCRYPTION_KEY=required if social enabled
```

### Development Only

```env
# NEVER set in production
DEV_PAYWALL_BYPASS=false
```

---

## Verification Steps

After completing P0 items:

1. [ ] Run full test suite: `npm run test`
2. [ ] Run build: `npm run build`
3. [ ] Run lint: `npm run lint`
4. [ ] Test locally with production config
5. [ ] Verify Stripe webhook in test mode
6. [ ] Verify OpenAI calls succeed

---

## Progress Tracking

### Week of 2026-01-01

| Task | Status | Notes |
|------|--------|-------|
| Fix OpenAI model defaults | Not Started | |
| Add Stripe key validation | Not Started | |
| Fix timezone detection | Not Started | |

---

*Cleanup checklist for Solara Insights*
