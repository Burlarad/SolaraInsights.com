# SOLARA INSIGHTS - COMPREHENSIVE REPOSITORY AUDIT

**Date:** 2026-01-21
**Auditor:** Claude Opus 4.5
**Scope:** Complete end-to-end repository audit for launch readiness

---

## EXECUTIVE SUMMARY

### Overall Health Score: 7.5/10

The Solara codebase is in **good shape** for a SaaS launch. Core functionality is complete, security is solid, and the architecture is well-documented. However, there are **2 critical RLS blockers** that must be fixed before launch, and significant test coverage gaps.

### Top 5 Critical Issues

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | `soul_paths` table has RLS enabled but NO policies | **BLOCKER** | Soul path data inaccessible to users |
| 2 | `ai_usage_events` has RLS enabled but NO policies | **BLOCKER** | AI usage tracking broken |
| 3 | 231 tests are `test.todo()` - not implemented | HIGH | Core paths untested |
| 4 | Swiss Ephemeris native addon blocks Cloudflare Workers | HIGH | Deployment constraint |
| 5 | STRIPE_SECRET_KEY only warns when missing | HIGH | Silent payment failures |

### Top 5 Quick Wins

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Add RLS policies to `soul_paths` and `ai_usage_events` | 30 min | Unblocks launch |
| 2 | Make STRIPE_SECRET_KEY throw instead of warn | 5 min | Prevents silent failures |
| 3 | Remove Reddit stub from sign-in UI | 10 min | Better UX |
| 4 | Fix 5 React hook dependency warnings | 1 hour | Prevents stale closure bugs |
| 5 | Archive duplicate audit docs | 15 min | Cleaner repo |

### Launch Readiness Assessment

| Area | Status | Notes |
|------|--------|-------|
| Core Features | READY | Birth charts, insights, numerology functional |
| Authentication | READY | Supabase Auth + PKCE working |
| Payments | READY | Stripe integration complete |
| Database | **BLOCKED** | 2 tables missing RLS policies |
| Security | GOOD | Solid threat model, no critical vulns |
| Tests | PARTIAL | 27% coverage, 73% todo |
| i18n | READY | 19 languages, all ~960 lines |
| Performance | GOOD | No major issues identified |

**Verdict:** Fix 2 RLS blockers and you're launch-ready.

---

## SECTION 1: ARCHITECTURE MAP

### Directory Structure

```
solara/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth routes (sign-in, sign-up, etc.)
│   ├── (protected)/        # Authenticated routes
│   │   ├── sanctuary/      # Main user area (4 tabs)
│   │   └── settings/       # User settings
│   ├── api/                # API routes
│   │   ├── auth/           # OAuth callbacks
│   │   ├── birth-chart/    # Birth chart generation
│   │   ├── cron/           # Scheduled jobs
│   │   ├── insights/       # AI insights
│   │   ├── social/         # Social connections
│   │   ├── stripe/         # Payment webhooks
│   │   └── public-*/       # Public endpoints
│   └── auth/               # Auth callback handlers
├── components/             # React components
│   ├── home/               # Public homepage
│   ├── sanctuary/          # Protected area UI
│   ├── shared/             # Reusable components
│   └── ui/                 # Base UI primitives
├── lib/                    # Core business logic
│   ├── ai/                 # AI cost control
│   ├── cache/              # Redis caching
│   ├── ephemeris/          # Swiss Ephemeris engine
│   ├── oauth/              # OAuth providers
│   ├── social/             # Social data fetching
│   ├── stripe/             # Payment processing
│   ├── supabase/           # Database clients
│   └── validation/         # Zod schemas
├── messages/               # i18n translations (19 languages)
├── types/                  # TypeScript types
├── contexts/               # React contexts
├── providers/              # App providers
├── docs/                   # Documentation
├── audits/                 # Audit reports
├── supabase/               # DB migrations
└── __tests__/              # Test suite
```

### Route Map (App Router)

| Route | Type | Auth | Purpose |
|-------|------|------|---------|
| `/` | Page | No | Homepage |
| `/sign-in` | Page | No | Login |
| `/sign-up` | Page | No | Registration |
| `/join` | Page | No | Pricing/signup |
| `/onboarding` | Page | Yes | Profile setup |
| `/sanctuary` | Page | Yes | Main dashboard |
| `/sanctuary/birth-chart` | Page | Yes | Birth chart view |
| `/sanctuary/numerology` | Page | Yes | Numerology view |
| `/sanctuary/connections` | Page | Yes | Relationships |
| `/settings` | Page | Yes | User settings |

### API Endpoint Map

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/birth-chart` | GET/POST | Yes | Generate birth chart |
| `/api/insights` | POST | Yes | Generate AI insights |
| `/api/social/status` | GET | Yes | Social connection status |
| `/api/social/oauth/*/callback` | GET | No | OAuth callbacks |
| `/api/stripe/webhook` | POST | Sig | Payment webhooks |
| `/api/cron/prewarm-insights` | GET | CRON_SECRET | Pregenerate insights |
| `/api/public-horoscope` | GET | No | Public horoscopes |
| `/api/public-tarot` | POST | No | Public tarot |
| `/api/public-compatibility` | GET | No | Public compatibility |

---

## SECTION 2: FEATURE COMPLETENESS MATRIX

| Feature | Status | Location | Launch Critical | Notes |
|---------|--------|----------|-----------------|-------|
| Birth chart calculations | COMPLETE | `lib/ephemeris/swissEngine.ts` | Yes | Swiss Ephemeris |
| Natal wheel visualization | COMPLETE | `components/sanctuary/NatalWheel.tsx` | Yes | SVG-based |
| Aspect grid | COMPLETE | `lib/ephemeris/aspects.ts` | Yes | Major aspects |
| Numerology (Pythagorean) | COMPLETE | `lib/numerology/` | Yes | Full calculation |
| Numerology (Chaldean) | COMPLETE | `lib/numerology/` | No | Secondary method |
| Daily insights | COMPLETE | `app/api/insights/route.ts` | Yes | AI-generated |
| Yearly insights | COMPLETE | `app/api/insights/route.ts` | No | AI-generated |
| Solar theme system | COMPLETE | Multiple files | Yes | 8 daily phases |
| Emotional Cadence timeline | COMPLETE | `components/sanctuary/EmotionalCadenceTimeline.tsx` | No | SVG visualization |
| Weather integration | COMPLETE | `lib/weather.ts` | No | Open-Meteo API |
| Geolocation timing | COMPLETE | `contexts/GeolocationContext.tsx` | Yes | suncalc library |
| i18n (19 languages) | COMPLETE | `messages/*.json` | Yes | next-intl |
| RTL Arabic support | COMPLETE | `i18n.ts` | No | Single RTL locale |
| User authentication | COMPLETE | Supabase Auth | Yes | Email + OAuth |
| Stripe payments | COMPLETE | `lib/stripe/` | Yes | Subscriptions |
| Profile management | COMPLETE | `app/(protected)/settings/` | Yes | Full CRUD |
| Social OAuth (Meta/TikTok) | COMPLETE | `lib/oauth/providers/` | No | Feature-flagged |
| X/Twitter OAuth | DISABLED | `lib/oauth/providers/x.ts` | No | $100/mo barrier |
| Reddit OAuth | STUB | `lib/oauth/providers/reddit.ts` | No | UI shows "coming soon" |
| Numerology AI interpretations | TODO | - | No | Not implemented |
| Tarot for zodiac signs | TODO | - | No | "Coming soon" in UI |
| Compatibility for zodiac | TODO | - | No | "Coming soon" in UI |

---

## SECTION 3: SWISS EPHEMERIS DEEP DIVE

### Licensing Analysis

| Aspect | Details |
|--------|---------|
| **Package** | `swisseph` v0.5.17 (npm) |
| **Binding Author** | mivion (Node.js binding) |
| **Underlying Library** | Swiss Ephemeris by Astrodienst |
| **Package License** | GPL-2.0 |
| **Upstream License** | Dual: GPL or Commercial |

### License Implications for SaaS

**Critical Question:** Does GPL require open-sourcing Solara?

**Answer: NO** - GPL's "distribution" clause does not apply to SaaS:
- Users access Solara via web browser
- No software is "distributed" to users
- This is the "SaaS loophole" in GPL (closed by AGPL, but Swiss Ephemeris uses GPL, not AGPL)

**Recommendation:** You can use the GPL-licensed Swiss Ephemeris for commercial SaaS without open-sourcing. However, if you ever distribute the application (desktop app, self-hosted version), you'd need to either:
1. Open-source the entire application, OR
2. Purchase a commercial license from Astrodienst

### Implementation Analysis

**Current Implementation:**
```typescript
// lib/ephemeris/swissEngine.ts
import swisseph from "swisseph";  // Native Node.js addon

// Uses native C library compiled for current platform
const ephePath = path.join(process.cwd(), "node_modules", "swisseph", "ephe");
swisseph.swe_set_ephe_path(ephePath);
```

**Key Findings:**

1. **No Time Bombs:** The `swisseph` npm package contains no license detection, payment verification, or expiration code. It's a straightforward Node.js binding.

2. **No Embedded Detection:** Searched all files - no phone-home, no license checking, no usage tracking.

3. **Cloudflare Workers Incompatibility:** Current implementation uses native addon (`node-gyp`), which is incompatible with Cloudflare Workers' WASM-only environment.

4. **WASM Migration Status:** NOT DONE. The code still uses the native addon. For Cloudflare Workers deployment, you'd need to migrate to a WASM-based ephemeris library.

### WASM Migration Options

| Option | Effort | Notes |
|--------|--------|-------|
| `@nicholasa/swiss-ephemeris-wasm` | Medium | Community WASM build |
| `astronomia` | High | Pure JS, less accurate |
| Keep on Node.js runtime | None | Works on Vercel, Render |

**Recommendation:** If targeting Cloudflare Workers is important, allocate 2-3 days for WASM migration. Otherwise, deploy to Vercel/Render where Node.js native addons work.

---

## SECTION 4: INTEGRATION STATUS REPORT

### Third-Party Services

| Service | Purpose | Status | Cost | Launch Critical |
|---------|---------|--------|------|-----------------|
| **Supabase** | Database + Auth | ACTIVE | Free tier | YES |
| **OpenAI** | AI insights | ACTIVE | Usage-based | YES |
| **Stripe** | Payments | ACTIVE | 2.9% + 30c | YES |
| **Redis/Valkey** | Caching + rate limiting | OPTIONAL | Free tier | NO |
| **Resend** | Email | ACTIVE | Free tier | NO |
| **Open-Meteo** | Weather | ACTIVE | Free | NO |
| **suncalc** | Sun/moon times | ACTIVE | Free (npm) | YES |
| **Swiss Ephemeris** | Astro calculations | ACTIVE | Free (GPL) | YES |

### API Key Status

| Variable | Validated | Behavior if Missing |
|----------|-----------|---------------------|
| `OPENAI_API_KEY` | YES (throws) | App won't start |
| `STRIPE_SECRET_KEY` | PARTIAL (warns) | **Silent failures** |
| `STRIPE_WEBHOOK_SECRET` | YES (500 error) | Webhooks rejected |
| `SUPABASE_SERVICE_ROLE_KEY` | PARTIAL (warns) | Admin features fail |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | YES (throws) | App won't start |
| `CRON_SECRET` | YES (401) | Cron jobs unauthorized |
| `REDIS_URL` | OPTIONAL | Caching disabled |
| `RESEND_API_KEY` | PARTIAL (warns) | Emails fail silently |

### Integration Health

| Integration | Health | Notes |
|-------------|--------|-------|
| Supabase Auth | GOOD | PKCE flow, secure cookies |
| Supabase DB | GOOD | RLS enforced (except 2 tables) |
| Stripe Payments | GOOD | Webhook signature verified |
| Stripe Pricing Table | GOOD | Embedded component |
| OpenAI | GOOD | Cost control circuit breaker |
| Meta OAuth | GOOD | PKCE + state validation |
| TikTok OAuth | GOOD | Waiting portal approval |
| X OAuth | DISABLED | $100/mo API tier required |
| Reddit OAuth | STUB | Not implemented |

---

## SECTION 5: PAIN POINTS & WACKY CODE

### Identified Issues

#### 1. RLS Policy Gaps (CRITICAL)

```sql
-- These tables have RLS enabled but NO policies
-- Users cannot access their own data!
soul_paths
ai_usage_events
```

**Impact:** Core features silently broken for non-service-role queries.

#### 2. Large Page Files

| File | Lines | Assessment |
|------|-------|------------|
| `settings/page.tsx` | 1,771 | Large but functional |
| `connections/page.tsx` | 1,292 | Could be split |
| `birth-chart/page.tsx` | 901 | Acceptable |
| `sanctuary/page.tsx` | 786 | Acceptable |

**Assessment:** These are at the upper limit but not "wacky". The settings page handles 12+ sections which justifies the size.

#### 3. Circular Dependencies (Ephemeris)

```
aspects.ts ←→ swissEngine.ts ←→ derived.ts ←→ calculated.ts
```

**Impact:** Not causing runtime issues currently, but could cause problems with bundlers. Low priority fix.

#### 4. Console Log Spam

```bash
# Found 945 console.* statements
grep -r "console\." | wc -l  # → 945
```

**Impact:** Production log noise. Add structured logging post-launch.

#### 5. Translation File Inconsistency

```bash
# zh.json is 179 lines shorter than others
zh.json:  781 lines
en.json:  960 lines
```

**Impact:** Simplified Chinese (`zh.json`) exists but isn't in the locale list. Only `zh-TW` (Traditional) is used. Consider removing `zh.json` if unused.

#### 6. React Hook Dependency Warnings (6)

| File | Issue |
|------|-------|
| `onboarding/page.tsx` | Missing `saveProfile` dep |
| `birth-chart/page.tsx` | Missing `fetchBirthChart` dep |
| `connections/page.tsx` | Missing `generateBriefForConnection` dep |
| `sanctuary/page.tsx` | Missing `loadJournalEntry` dep |
| `PlacePicker.tsx` | Missing `query` dep |

**Impact:** Potential stale closure bugs in critical user flows.

---

## SECTION 6: QUICK WINS LIST

### Immediate Fixes (Pre-Launch)

| # | Action | File | Effort |
|---|--------|------|--------|
| 1 | Add RLS policies to `soul_paths` | `supabase/migrations/` | 15 min |
| 2 | Add RLS policies to `ai_usage_events` | `supabase/migrations/` | 15 min |
| 3 | Make `STRIPE_SECRET_KEY` throw | `lib/stripe/client.ts` | 5 min |
| 4 | Make `SUPABASE_SERVICE_ROLE_KEY` throw | `lib/supabase/server.ts` | 5 min |
| 5 | Remove Reddit stub from sign-in | `app/(auth)/sign-in/page.tsx` | 10 min |

### Post-Launch Cleanup

| # | Action | File | Effort |
|---|--------|------|--------|
| 6 | Delete `zh.json` (unused) | `messages/zh.json` | 1 min |
| 7 | Archive duplicate audit docs | `docs/archive/` | 15 min |
| 8 | Fix React hook warnings | Multiple | 1 hour |
| 9 | Add `VALKEY_URL` to `.env.example` | `.env.example` | 2 min |
| 10 | Remove `AUTH_SECRET` from `.env.example` | `.env.example` | 2 min |

### Files Confirmed Safe to Delete

| File | Reason |
|------|--------|
| `messages/zh.json` | Not in locale list, unused |
| `docs/ARCHITECTURE_MAP.md` | Duplicate of `docs/audit/` version |
| `docs/DATA_FLOW_FLOWS.md` | Duplicate of `docs/audit/` version |
| `docs/CLEANUP_CHECKLIST.md` | Duplicate of `docs/audit/` version |
| `docs/TESTING_STRATEGY.md` | Duplicate of `docs/audit/` version |

---

## SECTION 7: LAUNCH BLOCKERS

### BLOCKER 1: `soul_paths` Missing RLS Policies

**Severity:** CRITICAL
**Impact:** Users cannot read/write their soul path data via client
**Fix:**
```sql
-- Add to new migration
ALTER TABLE soul_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own soul paths"
  ON soul_paths FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own soul paths"
  ON soul_paths FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own soul paths"
  ON soul_paths FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### BLOCKER 2: `ai_usage_events` Missing RLS Policies

**Severity:** CRITICAL
**Impact:** AI usage tracking broken
**Fix:** Either add user-owns-own policy OR disable RLS if internal-only table.

### Near-Blockers (Should Fix)

| Issue | Severity | Recommendation |
|-------|----------|----------------|
| `STRIPE_SECRET_KEY` silent failure | HIGH | Make it throw |
| 8 skipped test files | HIGH | Un-skip critical paths |
| `birth_data_versions` RLS disabled | HIGH | Enable if contains user data |

---

## SECTION 8: TECHNICAL DEBT INVENTORY

### High Priority (Fix Soon)

| Category | Item | Location | Effort |
|----------|------|----------|--------|
| Tests | 231 todo tests | `__tests__/` | 2-3 weeks |
| Tests | 8 skipped test files | `__tests__/` | 1 week |
| Security | React hook stale closures | Multiple pages | 1 day |
| Code | Circular deps in ephemeris | `lib/ephemeris/` | 1 day |

### Medium Priority (Next Quarter)

| Category | Item | Location | Effort |
|----------|------|----------|--------|
| Logging | Replace 945 console.* with structured logging | Global | 1 week |
| i18n | Review auto-generated translations | `messages/` | 1 week |
| Performance | Replace `<img>` with `<Image>` | `sanctuary/page.tsx` | 1 hour |
| Types | Migrate 5 deprecated types | `lib/validation/` | 1 day |

### Low Priority (Tech Debt Backlog)

| Category | Item | Notes |
|----------|------|-------|
| Docs | 17 unused exported types | Prune with knip |
| Docs | Duplicate RLS policies on profiles | Consolidate |
| DB | Placeholder migration files | Clean up history |

---

## SECTION 9: RECOMMENDATIONS

### Week 1 (Pre-Launch)

| Day | Task | Owner |
|-----|------|-------|
| 1 | Fix 2 RLS blockers | Backend |
| 1 | Make STRIPE_SECRET_KEY throw | Backend |
| 2 | Fix 5 React hook warnings | Frontend |
| 2 | Remove Reddit stub from UI | Frontend |
| 3 | Manual QA on core flows | QA |
| 4 | Un-skip stripe-webhook tests | Backend |
| 5 | Buffer / bug fixes | All |

### Week 2 (Launch Week)

| Day | Task | Owner |
|-----|------|-------|
| 1-2 | Final QA pass | QA |
| 3 | Production deploy | DevOps |
| 4 | Monitor errors/logs | All |
| 5 | Launch! | All |

### Post-Launch Priorities

1. **Testing Sprint:** Implement 231 todo tests over 2-3 weeks
2. **Logging:** Add structured logging (Axiom, Logtail, etc.)
3. **WASM Migration:** If Cloudflare Workers needed
4. **X/Twitter:** Enable when budget allows ($100/mo)
5. **Reddit:** Implement OAuth flow

---

## APPENDIX A: File Statistics

| Metric | Value |
|--------|-------|
| Total TypeScript/TSX files | ~250 |
| Total lines of code | ~45,000 |
| Translation files | 20 (19 used) |
| Test files | 13 |
| Tests passing | 84 |
| Tests todo | 231 |
| API routes | 25+ |
| React components | 50+ |
| Supabase tables | 15+ |

---

## APPENDIX B: Existing Documentation Index

| Document | Location | Purpose |
|----------|----------|---------|
| Architecture Map | `docs/SOLARA_ARCHITECTURE_MAP.md` | System overview |
| Route Inventory | `docs/ROUTE_INVENTORY.md` | All routes |
| DB Schema | `docs/DB_SCHEMA_AUDIT.md` | Table structure |
| Env Variables | `docs/ENV_VAR_MATRIX.md` | Config inventory |
| Security | `docs/SECURITY_THREAT_MODEL.md` | Threat model |
| RLS Audit | `docs/RLS_GRANTS_AUDIT_REPORT.md` | RLS policies |
| Social Systems | `docs/AUDIT_SOCIAL_SYSTEMS_CANONICAL.md` | OAuth flows |
| Unfinished Items | `audits/UNFINISHED_INVENTORY.md` | TODO tracking |
| Warnings | `audits/WARNING_INVENTORY.md` | Lint warnings |

---

**End of Audit Report**

*Generated by Claude Opus 4.5 on 2026-01-21*
