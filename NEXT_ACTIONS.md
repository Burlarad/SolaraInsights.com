# Next Actions

**Last Updated**: 2025-12-13

Prioritized work items for Solara development. Items ordered by priority within each tier.

---

## Priority Legend

| Priority | Meaning | Timeline |
|----------|---------|----------|
| **P0** | Critical - do immediately | Today |
| **P1** | Important - this sprint | This week |
| **P2** | Should do - next sprint | Next 2 weeks |
| **P3** | Nice to have - backlog | When time permits |

## Effort Legend

| Size | Meaning | Time Estimate |
|------|---------|---------------|
| **S** | Small | < 1 hour |
| **M** | Medium | 1-4 hours |
| **L** | Large | 4-16 hours |
| **XL** | Extra Large | > 16 hours |

---

## P0 - Critical (Do Today)

| # | Task | Effort | Files | Notes |
|---|------|--------|-------|-------|
| 1 | **Fix npm vulnerability** | S | `package.json` | Run `npm audit fix` to patch Next.js high severity DoS vulnerability |
| 2 | **Remove dev endpoint** | S | `app/api/dev/test-birth-chart/route.ts` | Delete or add auth guard - exposes birth chart generation |

---

## P1 - Important (This Week)

| # | Task | Effort | Files | Notes |
|---|------|--------|-------|-------|
| 3 | **Configure ESLint** | S | `.eslintrc.json`, `package.json` | Set up ESLint CLI (next lint deprecated in v16) |
| 4 | **Add rate limiting to public endpoints** | M | `app/api/public-horoscope/route.ts`, `middleware.ts` | Prevent abuse of public horoscope endpoint |
| 5 | **Add Zod validation to API routes** | M | All `app/api/*/route.ts` | Type-safe request validation |
| 6 | **Create Render cron job** | S | Render dashboard | Schedule prewarm-insights every 30 min with x-cron-secret header |
| 7 | **Add index on profiles.last_seen_at** | S | `sql/005_add_indexes.sql` | Improve cron query performance |
| 8 | **Verify Stripe webhook in production** | S | Render logs | Confirm webhook receives events, emails send |

---

## P2 - Should Do (Next Sprint)

| # | Task | Effort | Files | Notes |
|---|------|--------|-------|-------|
| 9 | **Complete Facebook personalization** | M | `app/api/insights/route.ts`, `lib/social.ts` | Wire social_summaries into insight prompts |
| 10 | **Add error boundary components** | M | `app/(protected)/layout.tsx`, `components/error/*` | Graceful error handling in UI |
| 11 | **Implement onboarding reminder emails** | M | `app/api/stripe/webhook/route.ts`, new cron | Day 3, 5, 10 reminders for incomplete onboarding |
| 12 | **Add telemetry dashboard query** | S | `sql/telemetry_queries.sql` | SQL queries for cost monitoring |
| 13 | **Create health check endpoint** | S | `app/api/health/route.ts` | For Render health checks |
| 14 | **Add structured logging** | M | `lib/logger.ts`, all routes | Replace console.* with structured logger |
| 15 | **Document API endpoints** | M | `docs/API.md` | OpenAPI spec or markdown docs |

---

## P3 - Nice to Have (Backlog)

| # | Task | Effort | Files | Notes |
|---|------|--------|-------|-------|
| 16 | **Implement Compatibility feature** | XL | New page, API, types | Compare two birth charts |
| 17 | **Build standalone Tarot feature** | L | `app/(protected)/tarot/*`, `app/api/tarot/*` | Daily card draw, interpretations |
| 18 | **Add push notifications** | L | Service worker, new API | Daily insight reminders |
| 19 | **Implement Reddit OAuth** | M | `app/(auth)/connect-social/*`, env vars | Social personalization source |
| 20 | **Build admin dashboard** | XL | `app/(admin)/*` | User management, telemetry viz |

---

## Quick Reference: File Targets

### Security Fixes
```
app/api/dev/test-birth-chart/route.ts  # Delete or protect
package.json                            # npm audit fix
```

### Code Quality
```
.eslintrc.json                          # Create
tsconfig.json                           # Update strict mode
```

### Performance
```
sql/005_add_indexes.sql                 # Create with:
  - CREATE INDEX idx_profiles_last_seen ON profiles(last_seen_at);
  - CREATE INDEX idx_ai_usage_route ON ai_usage_events(route, created_at);
```

### New Features
```
app/(protected)/tarot/page.tsx          # Tarot standalone
app/(protected)/compatibility/page.tsx   # Compatibility feature
app/api/tarot/route.ts                  # Tarot API
app/api/compatibility/route.ts          # Compatibility API
```

---

## Completed Recently

| Task | Date | Notes |
|------|------|-------|
| Add locking to connection-insight | 2025-12-13 | Prevents stampede |
| Remove cron debug responses | 2025-12-13 | Auth verified working |
| Complete caching perfection audit | 2025-12-13 | All AI routes verified |
| Implement cron prewarm | 2025-12-13 | Pre-warms tomorrow's insights |
| Add TTL alignment | 2025-12-13 | Timeframe-specific TTLs |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-13 | Keep social_summaries unused for now | Facebook OAuth works but personalization pipeline needs design |
| 2025-12-13 | No locking on birth-chart | Stone tablet caching means duplicate calls update same row |
| 2025-12-13 | 500 user cap on cron | Sufficient for current scale, prevents timeouts |

---

## Blockers / Dependencies

| Blocker | Blocks | Resolution |
|---------|--------|------------|
| None identified | - | - |

---

## Notes for Next Developer

1. **Caching is complete** - All AI routes have proper caching, locking, and telemetry
2. **Stripe is production-ready** - Webhook handles all subscription lifecycle events
3. **Cron needs scheduling** - Create Render cron job to call prewarm endpoint
4. **Social connect is half-done** - OAuth works, but summaries aren't used in prompts yet
5. **Types are in `/types/index.ts`** - All shared TypeScript types centralized
