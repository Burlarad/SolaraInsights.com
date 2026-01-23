# Solara Code Health & Launch Readiness Audit

**Date:** 2026-01-14
**Auditor:** Claude Code
**Branch:** `pr5-rls-hardening`

---

## 1. Executive Summary

- ✅ **Build passes** — 80/80 pages generated, TypeScript compiles cleanly
- ✅ **RLS hardening complete** — 24 migrations applied, sensitive tables locked to `service_role`
- ✅ **OpenAI tracking deployed** — All 14 call sites use `trackAiUsage()`
- ⚠️ **CRITICAL: Schema/code mismatch** — `upsert_ai_usage_rollup` references columns that were renamed/dropped
- ⚠️ **cost_cents vs cost_micros** — Code writes `cost_cents`, schema expects `cost_micros`
- ⚠️ **Stripe webhook idempotency** — Only `invoice.payment_succeeded` has idempotency guard
- 🟡 **7 TODOs in production code** — Minor, but shows incomplete features

### 3 Biggest Risks

| Risk | Impact | Fix Effort |
|------|--------|------------|
| **Rollup function schema mismatch** | ❌ Runtime failures when tracking AI usage | 1-2 hours |
| **Missing idempotency on checkout.session.completed** | ⚠️ Duplicate user creation possible | 30 min |
| **No request_id correlation** | 🔍 Hard to debug distributed issues | 1 hour |

---

## 2. Scorecard

| Category | % Healthy | % Launch-Ready | Evidence | Risks | Fixes |
|----------|-----------|----------------|----------|-------|-------|
| **Build & CI** | 95% | 95% | `pnpm build` succeeds | No lint in CI | Add lint step |
| **Auth Boundaries** | 90% | 90% | Protected layout works | 7 TODOs remain | Complete or remove |
| **RLS & Security** | 95% | 95% | 24 hardening migrations | None critical | — |
| **AI Cost Tracking** | 60% | ❌ 40% | Schema mismatch | **BLOCKER** | Sync code ↔ schema |
| **Stripe Webhooks** | 85% | 80% | Signature verified | Idempotency gaps | Add event dedup |
| **Localization** | 90% | 90% | 19 locales supported | Stone tablets English-only | Document |
| **Performance** | 85% | 85% | Redis caching present | 1045-line route | Consider split |
| **Observability** | 70% | 70% | console.warn/error used | 291 occurrences | Structured logging |
| **Dependencies** | 90% | 90% | All deps used | `resend` low usage | Keep for email |

---

## 3. Refactor Radar

### 🔴 High ROI (Small effort, big payoff)

| Item | Files | Why It Matters |
|------|-------|----------------|
| **Fix `upsert_ai_usage_rollup` schema** | [trackUsage.ts:164](lib/ai/trackUsage.ts#L164), migration `170000` | **BLOCKER**: Function references renamed columns |
| **Use `cost_micros` consistently** | [trackUsage.ts:90-94](lib/ai/trackUsage.ts#L90-L94) | Code uses `cost_cents`, schema uses `cost_micros` |
| **Add idempotency to checkout webhook** | [webhook/route.ts:159](app/api/stripe/webhook/route.ts#L159) | Duplicate events could create duplicate users |

### 🟡 Medium ROI

| Item | Files | Why It Matters |
|------|-------|----------------|
| **Split birth-chart route** | [birth-chart/route.ts](app/api/birth-chart/route.ts) (1045 lines) | Largest route, hard to maintain |
| **Structured logging** | 46 API routes | 291 console.warn/error calls need aggregation |
| **Add request_id propagation** | All AI routes | Currently optional, should be standard |
| **Remove Reddit TODO stub** | [sign-in/page.tsx:202](app/(auth)/sign-in/page.tsx#L202) | Dead UI code |

### 🟢 Low ROI / Avoid For Now

| Item | Why Skip |
|------|----------|
| Migrate from pnpm to bun | Works fine, no benefit |
| Add i18n for birth chart narratives | Stone tablets are English-only by design |
| Split all routes under 500 lines | Diminishing returns |

---

## 4. Deletions & Dead Code

### Files Safe to Delete

| File/Pattern | Reason | Safety |
|--------------|--------|--------|
| `supabase/migrations/verification_ai_usage_tracking.sql` | Should be in `verification/` | ✅ Already duplicate |
| `ai_usage_rollup_daily_legacy` table | Backfilled to new schema | ✅ Can DROP after verification |

### Unused Exports

| Export | File | Usage |
|--------|------|-------|
| `estimateCostMicros` | [pricing.ts:104](lib/ai/pricing.ts#L104) | Defined but **never called** |
| `getDailyUsageSummary` | [trackUsage.ts:190](lib/ai/trackUsage.ts#L190) | Defined but **never called** |

### Unused Dependencies

**None found** — All package.json deps are imported somewhere.

---

## 5. Correctness & Security

### RLS Policy Audit ✅

| Table | RLS Enabled | Policy | Grants |
|-------|-------------|--------|--------|
| `ai_usage_events` | ✅ | service_role only | ✅ |
| `ai_usage_rollup_daily` | ✅ | service_role only | ✅ |
| `foundation_ledger` | ✅ | service_role only | ✅ |
| `profiles` | ✅ | User can read/update own | ✅ |
| `connections` | ✅ | User owns connection | ✅ |
| `storage.*` | ✅ | **REVOKED** (unused) | ✅ |

### Webhook Verification ✅

```typescript
// app/api/stripe/webhook/route.ts:114-118
event = stripe.webhooks.constructEvent(body, signature, STRIPE_CONFIG.webhookSecret);
```

**Correct**: Uses `constructEvent` with raw body + signature.

### Idempotency ⚠️

| Event | Has Guard | Evidence |
|-------|-----------|----------|
| `invoice.payment_succeeded` | ✅ | [route.ts:506-509](app/api/stripe/webhook/route.ts#L506-L509) unique on `stripe_event_id` |
| `checkout.session.completed` | ❌ | No duplicate check |
| `subscription.updated` | ❌ | No duplicate check |
| `subscription.deleted` | ❌ | No duplicate check |

### Auth Boundary Analysis

| Route Group | Auth Required | Enforcement |
|-------------|---------------|-------------|
| `/api/insights` | ✅ | `getUser()` check |
| `/api/public-*` | ❌ | Intentionally public |
| `/api/cron/*` | ✅ | `CRON_SECRET` header |
| `/api/stripe/webhook` | ✅ | Signature verification |
| `/(protected)/*` | ✅ | Layout auth guard |

---

## 6. Performance & Cost

### Heaviest Routes (by LOC)

| Route | Lines | AI Calls | Caching |
|-------|-------|----------|---------|
| [birth-chart/route.ts](app/api/birth-chart/route.ts) | 1045 | 2-4 | ✅ Redis 1yr |
| [insights/route.ts](app/api/insights/route.ts) | 714 | 1 | ✅ Redis 1d/1yr |
| [connection-space-between/route.ts](app/api/connection-space-between/route.ts) | 628 | 1 | ✅ Redis 90d |
| [connections/route.ts](app/api/connections/route.ts) | 606 | 0 | N/A |
| [cron/prewarm-insights/route.ts](app/api/cron/prewarm-insights/route.ts) | 590 | Many | ✅ Pre-warm |

### AI Cost Control ✅

- **Budget circuit breaker**: [costControl.ts](lib/ai/costControl.ts) — $100/day default
- **Redis counter**: `openai:budget:YYYY-MM-DD`
- **Fail modes**: `closed` (default) or `open`

### Caching Strategy ✅

| Feature | TTL | Key Pattern |
|---------|-----|-------------|
| Daily insights | 24h | `insights:{userId}:{date}:{locale}` |
| Yearly insights | 365d | `insights:{userId}:{year}:{locale}` |
| Birth chart | 365d | `birthchart:{userId}:{version}` |
| Space Between | 90d | `space-between:{connId}:{quarter}` |

---

## 7. Top 20 Next Actions

### 🔴 Build-Breaking / Blockers

1. **Fix `upsert_ai_usage_rollup` function** — references renamed columns `day`, `feature`, `cost_cents`
2. **Align `trackUsage.ts` with `cost_micros` schema** — code writes `cost_cents`, DB expects `cost_micros`
3. **Remove or fix legacy `ai_usage_rollup_daily` conflict constraint** — multiple schemas conflict

### 🟠 Security / Data Correctness

4. **Add idempotency guard to `checkout.session.completed`** — store processed session IDs
5. **Add idempotency to `subscription.updated/deleted`** — use `event.id` as unique key
6. **Verify `foundation_ledger` unique constraint works** — test duplicate webhook replay

### 🟡 Cost Control

7. **Use `estimateCostMicros` instead of `estimateCostCents`** — avoid rounding small costs to 0
8. **Add `request_id` to all AI tracking calls** — currently optional, should be required
9. **Monitor daily rollup accuracy** — verify rollup totals match raw events

### 🔵 Performance

10. **Consider splitting [birth-chart/route.ts](app/api/birth-chart/route.ts)** — 1045 lines, multiple concerns
11. **Add composite index on `ai_usage_events(created_at, feature_label)`** — for dashboard queries
12. **Profile prewarm cron for parallelization** — currently sequential

### 🟢 Maintainability

13. **Remove Reddit TODO stub** — [sign-in/page.tsx:202](app/(auth)/sign-in/page.tsx#L202)
14. **Complete or remove TikTok profile scope TODO** — [tiktok.ts:18](lib/oauth/providers/tiktok.ts#L18)
15. **Delete `verification_ai_usage_tracking.sql` from migrations/** — belongs in `verification/`
16. **Add structured logging wrapper** — replace 291 console.warn/error calls
17. **Document "stone tablet" English-only decision** — birth charts, yearly insights
18. **Add CI lint step** — `pnpm lint` not in any workflow
19. **Clean up unused `getDailyUsageSummary` export** — or wire it to an admin dashboard
20. **Add build timestamp to health check** — [health/route.ts](app/api/health/route.ts)

---

## Appendix A: Route Inventory

### API Routes (48 total)

| Category | Count | Examples |
|----------|-------|----------|
| Auth | 12 | `/api/auth/login/*`, `/api/auth/callback` |
| AI/Content | 10 | `/api/insights`, `/api/birth-chart`, `/api/public-*` |
| Stripe | 4 | `/api/stripe/webhook`, `/api/stripe/checkout` |
| Social | 8 | `/api/social/sync`, `/api/social/oauth/*` |
| Account | 4 | `/api/account/delete`, `/api/account/hibernate` |
| Cron | 3 | `/api/cron/prewarm-insights`, `/api/cron/social-sync` |
| Journal | 3 | `/api/journal`, `/api/journal/delete`, `/api/journal/export` |
| Other | 4 | `/api/health`, `/api/locale`, `/api/location/search` |

### Pages (22 total)

| Group | Count | Protected |
|-------|-------|-----------|
| Public | 7 | ❌ |
| Auth | 9 | ❌ (pre-login) |
| Protected | 6 | ✅ |

---

## Appendix B: Migration Timeline

```
20240101 → profiles_baseline
20240102 → profiles_required_columns
20240103 → connections_table
20241215 → public_compatibility
20241221 → social_insights_toggle
20250101 → numerology_schema
20260105 → drop_foundation_gratitude
20260106 → reconcile_public_schema_from_prod
20260107 → archive_unused_tables
20260108 → drop_gratitude_stats + rls_birth_data_versions + lock_down_sensitive_tables
20260109 → fix_rls_gaps
20260110 → fix_rls_grants + complete_rls_hardening + foundation_ledger_stripe + remove_waitlist
20260112 → remove_dangerous_grants (v1, v2)
20260114 → revoke_default_privileges + revoke_storage_privs + enhance_ai_usage + cost_micros ← YOU ARE HERE
```

---

## Appendix C: AI Usage Tracking Schema Conflict

### Problem

Migration `20260114160000` creates:
```sql
CREATE FUNCTION upsert_ai_usage_rollup(p_day, p_feature, p_cost_cents, ...)
INSERT INTO ai_usage_rollup_daily (day, feature, cost_cents, ...)
```

Migration `20260114170000` then:
1. Renames `day` → `usage_date`
2. Renames `feature` → `feature_label`
3. Drops `cost_cents`, adds `cost_micros`
4. Creates NEW function `upsert_ai_usage_rollup_daily` (different name!)

### Code

[trackUsage.ts:164](lib/ai/trackUsage.ts#L164) calls:
```typescript
admin.rpc("upsert_ai_usage_rollup", { p_day, p_feature, p_cost_cents, ... })
```

### Result

**Runtime failure**: The `upsert_ai_usage_rollup` function tries to INSERT into columns that no longer exist.

### Fix

Either:
1. Update `trackUsage.ts` to call `upsert_ai_usage_rollup_daily` with correct params
2. OR drop the v2 migration and fix v1 to use `cost_micros`

---

**End of Audit Report**
