# SOLARA FULL-REPO CLEANUP AUDIT

**Generated:** 2025-12-24
**Auditor:** Claude (Principal Engineer)
**Mode:** AUDIT ONLY - No code changes implemented

---

## A. Executive Summary (Top 10 Findings)

| # | Finding | Impact | Priority |
|---|---------|--------|----------|
| 1 | **Duplicate cache implementations** - `lib/cache.ts` and `lib/cache/redis.ts` have overlapping code | Code bloat, maintenance burden | P1 |
| 2 | **`lib/social.ts` is 100% unused** - Dead file with 2 functions never imported anywhere | Dead code | P0 |
| 3 | **25 markdown audit files** in repo root (~200KB) - Many are stale/completed | Repo clutter, confuses new devs | P1 |
| 4 | **TikTok verification files in public/** - 3 `.txt` files for domain verification | Should be in .gitignore after use | P2 |
| 5 | **`public/images/` is empty** - Directory created but never used | Dead directory | P2 |
| 6 | **Deprecated types exist** - `JoyDeepDive`, `joyDeepDiveSchema`, `validateJoyDeepDive` marked deprecated | Tech debt | P2 |
| 7 | **"Coming soon" stubs** in auth pages - X/Reddit buttons show error toasts | Poor UX | P1 |
| 8 | **1281-line connections page** - Largest UI file, could be split | Maintainability | P2 |
| 9 | **1155-line settings page** - Second largest UI file, lots of modal code | Maintainability | P2 |
| 10 | **Missing migration 012/016** - SQL folder jumps from 011 to 013 to 015 to 017 | Confusing history | P3 |

---

## B. Repo Map

### Core Modules (CRITICAL - Touch Last)

| Path | Purpose | Risk Level |
|------|---------|------------|
| `app/auth/callback/route.ts` | Supabase OAuth callback | HIGH |
| `app/api/stripe/webhook/route.ts` | Stripe billing events | HIGH |
| `app/api/stripe/checkout/route.ts` | Payment initiation | HIGH |
| `app/api/account/delete/route.ts` | Account deletion | HIGH |
| `app/api/account/hibernate/route.ts` | Subscription pause | HIGH |
| `app/api/account/reactivate/route.ts` | Subscription resume | HIGH |
| `app/(protected)/layout.tsx` | Auth + payment gates | HIGH |
| `lib/supabase/server.ts` | Server-side Supabase client | HIGH |
| `lib/supabase/service.ts` | Admin Supabase client | HIGH |
| `providers/SettingsProvider.tsx` | Global auth/profile state | HIGH |

### Feature Modules (Safe to Refactor)

| Path | Purpose |
|------|---------|
| `app/(protected)/sanctuary/*` | Main app experience (insights, birth chart, connections) |
| `app/(protected)/settings/*` | User settings, social connections |
| `app/(public)/*` | Public pages (home, learn, about, privacy, terms) |
| `app/api/insights/*` | AI insight generation |
| `app/api/birth-chart/*` | Astrology calculations |
| `app/api/connections/*` | Relationship management |
| `app/api/social/*` | OAuth token management, sync |
| `app/api/public-*` | Rate-limited public features |

### Support Modules (Library Code)

| Path | Purpose |
|------|---------|
| `lib/cache.ts` + `lib/cache/*` | Redis caching & rate limiting |
| `lib/ephemeris/*` | Swiss Ephemeris calculations |
| `lib/ai/*` | OpenAI cost control & voice |
| `lib/oauth/*` | OAuth provider configurations |
| `lib/social/*` | Social sync & encryption |
| `lib/validation/*` | Zod schemas |
| `components/*` | Reusable UI components |

---

## C. Findings Table

### UI Findings

| Finding | Evidence | Impact | Confidence | Action | Verification |
|---------|----------|--------|------------|--------|--------------|
| `lib/social.ts` is unused | `rg "getPrimaryFacebookIdentity\|getIdentityDisplayName"` = 1 file (self) | None if deleted | HIGH | Delete | `npm run build` |
| `public/images/` empty directory | `ls public/images/` = empty | None | HIGH | Delete | `ls public/images/` |
| TikTok verification .txt files | `ls public/api/social/oauth/tiktok/*.txt` = 3 files | Minor clutter | MEDIUM | Add to .gitignore or delete | Manual check if TikTok verified |
| `SolaraLogo` component used in 1 place | `rg SolaraLogo` = 2 files (def + HeroSection) | Low | MEDIUM | Keep - used correctly | N/A |

### API Findings

| Finding | Evidence | Impact | Confidence | Action | Verification |
|---------|----------|--------|------------|--------|--------------|
| Duplicate cache code | `lib/cache.ts` and `lib/cache/redis.ts` both have `getCache`/`setCache` | Confusion | HIGH | Consolidate to `lib/cache/redis.ts` | `rg "from \"@/lib/cache\""` |
| `getDayKey`/`getWeekKey` in wrong file | Period keys in `lib/cache.ts` but most imports from `lib/cache/redis.ts` | Confusion | HIGH | Move to `lib/cache/redis.ts` or create `lib/cache/periodKeys.ts` | N/A |

### Lib Findings

| Finding | Evidence | Impact | Confidence | Action | Verification |
|---------|----------|--------|------------|--------|--------------|
| `lib/social.ts` dead code | 0 imports outside self | None | HIGH | Delete | `npm run build` |
| `lib/timezone/periodKeys.ts` exists | Already has period key logic | Duplication | HIGH | Use this instead of `lib/cache.ts` period keys | Check imports |
| Deprecated types in `types/natalAI.ts` | `@deprecated` on `JoyDeepDive` line 121 | Tech debt | MEDIUM | Keep deprecated, remove in future | N/A |
| Deprecated schemas in `lib/validation/schemas.ts` | `@deprecated` on lines 137, 142, 180 | Tech debt | MEDIUM | Keep for now | N/A |

### Config Findings

| Finding | Evidence | Impact | Confidence | Action | Verification |
|---------|----------|--------|------------|--------|--------------|
| Missing SQL migrations 012, 016 | `ls sql/` shows gap | Confusion | LOW | Document or add placeholder | N/A |
| 25 markdown audit files | `ls *.md \| wc -l` = 25 | Clutter | MEDIUM | Archive to docs/audits/ | N/A |

### Deps Findings

| Finding | Evidence | Impact | Confidence | Action | Verification |
|---------|----------|--------|------------|--------|--------------|
| All dependencies appear used | Manual review | N/A | HIGH | No action | `npm run build` |
| `tsx` dev dep used only by scripts | `scripts/ai-usage-report.ts` | Low | LOW | Keep - useful for scripts | N/A |

---

## D. Safe Delete List (HIGH Confidence)

### 1. `lib/social.ts`

**Files:** `lib/social.ts`
**Why Safe:** Zero imports outside the file itself. Functions `getPrimaryFacebookIdentity` and `getIdentityDisplayName` are never called.
**Verification:**
```bash
rg "getPrimaryFacebookIdentity|getIdentityDisplayName" --type ts --type-add 'tsx:*.tsx' -t tsx
# Should return only lib/social.ts
npm run build
# Should pass
```

### 2. `public/images/` (empty directory)

**Files:** `public/images/`
**Why Safe:** Directory is empty (contains no files).
**Verification:**
```bash
ls public/images/
# Should be empty or only .keep file
```

### 3. TikTok Verification Files (after TikTok approval)

**Files:**
- `public/api/social/oauth/tiktok/tiktok0Lu4Y1zeobcEx5TkorpcZx5AbGZIeC1h.txt`
- `public/api/social/oauth/tiktok/tiktokCfbvACM7G2xMSSmxzZxL5pr76DJhTDm4.txt`
- `public/api/social/oauth/tiktok/tiktokSUpKeFR9GaHASFVRMSiQJaJSXCFwnBs6.txt`
- `public/api/social/oauth/tiktok/callback/tiktokCfbvACM7G2xMSSmxzZxL5pr76DJhTDm4.txt`

**Why Safe:** Domain verification files only needed once during TikTok app setup.
**Verification:**
1. Confirm TikTok OAuth is fully working in production
2. Delete files
3. Test TikTok OAuth still works

---

## E. Quarantine List (Move to /graveyard First)

### 1. Stale Audit Markdown Files

**Files to quarantine:**
- `PRACTICE_REMOVAL_AUDIT.md` - If practice feature is removed
- `TODAY_AUDIT.md` - One-time audit, now stale
- `CACHING_AUDIT.md` - Superseded by CACHING_PROGRESS_AUDIT.md
- `CACHING_PROGRESS_AUDIT.md` - If caching is stable
- `CONNECTIONS_AUDIT.md` - If connections are stable

**Why Questionable:** May contain historical context needed later, but clutters repo root.
**Validation:** Review each file for relevance before final deletion.

### 2. Deprecated Type Aliases

**Files:**
- `types/natalAI.ts` lines 121-123 (`JoyDeepDive`)
- `lib/validation/schemas.ts` lines 137-144 (`joyDeepDiveSchema`, `ValidatedJoyDeepDive`, `validateJoyDeepDive`)

**Why Questionable:** Marked deprecated but may still have runtime usage via dynamic imports or tests.
**Validation:**
```bash
rg "JoyDeepDive|joyDeepDiveSchema|validateJoyDeepDive" --type ts --type-add 'tsx:*.tsx' -t tsx
```

---

## F. Refactor Targets (Top 10)

### 1. `app/(protected)/sanctuary/connections/page.tsx` (1281 lines)

**Why Bloated:** All connection management UI in one file - list, forms, modals, briefs, space-between.
**Suggested Refactor:**
- Extract `ConnectionsList.tsx` component
- Extract `ConnectionForm.tsx` component
- Extract `SpaceBetweenModal.tsx` component
- Keep page.tsx as orchestrator (<200 lines)

**Acceptance Criteria:**
- [ ] Page file under 300 lines
- [ ] Components in `components/sanctuary/connections/`
- [ ] `npm run build` passes
- [ ] All features still work

### 2. `app/(protected)/settings/page.tsx` (1155 lines)

**Why Bloated:** Profile form, social connections, notifications, journal export, hibernate/delete modals all inline.
**Suggested Refactor:**
- Extract `ProfileForm.tsx`
- Extract `SocialConnectionsSection.tsx`
- Extract `DangerZoneSection.tsx` (hibernate + delete)
- Modals already exist but inline - extract to separate files

**Acceptance Criteria:**
- [ ] Page file under 400 lines
- [ ] Components in `components/settings/`
- [ ] `npm run build` passes

### 3. `app/(protected)/sanctuary/birth-chart/page.tsx` (927 lines)

**Why Bloated:** Multiple tabs with deep interpretation UI all in one file.
**Suggested Refactor:**
- Extract tab content components
- Keep page as tab orchestrator

**Acceptance Criteria:**
- [ ] Page file under 300 lines
- [ ] Tab components in `components/sanctuary/birth-chart/`

### 4. `app/api/birth-chart/route.ts` (1041 lines)

**Why Bloated:** Swiss ephemeris calculation + OpenAI interpretation + caching all in one file.
**Suggested Refactor:**
- Move AI interpretation logic to `lib/ai/birthChart.ts`
- Keep route.ts as thin HTTP handler
- Swiss ephemeris already in `lib/ephemeris/`

**Acceptance Criteria:**
- [ ] Route file under 300 lines
- [ ] AI logic in dedicated module

### 5. Consolidate `lib/cache.ts` + `lib/cache/redis.ts`

**Why Bloated:** Duplicate `getCache`/`setCache` implementations.
**Suggested Refactor:**
- Delete `lib/cache.ts`
- Move period key functions (`getDayKey`, etc.) to `lib/cache/periodKeys.ts` or `lib/cache/redis.ts`
- Update all imports

**Acceptance Criteria:**
- [ ] Single source of truth for cache functions
- [ ] All imports updated
- [ ] `npm run build` passes

### 6. `app/api/connection-space-between/route.ts` (627 lines)

**Why Bloated:** Complex AI prompt building inline.
**Suggested Refactor:**
- Extract prompt building to `lib/ai/spaceBetween.ts`

### 7. `app/api/insights/route.ts` (654 lines)

**Why Bloated:** Multiple timeframes, social enhancement, caching all inline.
**Suggested Refactor:**
- Extract insight generation to `lib/ai/insights.ts`

### 8. `app/api/connections/route.ts` (556 lines)

**Why Bloated:** Full CRUD + connection matching in one file.
**Suggested Refactor:**
- Extract connection matching logic to existing `lib/connections/profileMatch.ts`

### 9. `components/home/TarotArena.tsx` (394 lines) + `CompatibilityArena.tsx` (399 lines)

**Why Bloated:** Complex interactive components with inline state management.
**Suggested Refactor:**
- Extract shared patterns
- Consider using custom hooks for state

### 10. "Coming Soon" Button Cleanup

**Files:**
- `app/(auth)/sign-in/page.tsx` lines 131-151
- `app/(auth)/welcome/page.tsx` lines 249-270

**Why Bloated:** X/Reddit buttons exist but just show error toasts.
**Suggested Refactor:**
- Remove buttons entirely
- OR conditionally render based on `isProviderEnabled()`

**Acceptance Criteria:**
- [ ] No "coming soon" error toasts
- [ ] Clean auth pages

---

## G. Dependency Cleanup

### Likely Unused Dependencies

| Package | Status | Evidence |
|---------|--------|----------|
| All deps used | KEEP | Manual review confirms usage |

### Redundant Libraries

| Area | Current | Issue |
|------|---------|-------|
| Cache | `lib/cache.ts` + `lib/cache/redis.ts` | Duplicate implementations |

### Heavy Dependencies Worth Monitoring

| Package | Size | Usage | Alternative |
|---------|------|-------|-------------|
| `swisseph` | ~5MB | Core ephemeris | None - required |
| `ioredis` | ~200KB | Caching | None - required |
| `openai` | ~1MB | AI features | None - required |

---

## H. Risk Zones / Do-Not-Touch-Yet

### CRITICAL - Never Modify Without Full Testing

| Path | Why Sensitive |
|------|---------------|
| `app/auth/callback/route.ts` | OAuth session establishment |
| `app/api/stripe/webhook/route.ts` | Billing event handler - data integrity |
| `app/api/stripe/checkout/route.ts` | Payment initiation |
| `app/(protected)/layout.tsx` | Auth + payment + hibernation gates |
| `lib/supabase/server.ts` | SSR cookie handling |
| `lib/supabase/service.ts` | Admin bypass - security critical |
| `providers/SettingsProvider.tsx` | Global auth state |
| `sql/*.sql` | Database migrations - production data |

### HIGH RISK - Test Thoroughly

| Path | Why Sensitive |
|------|---------------|
| `app/api/account/delete/route.ts` | Permanent data deletion |
| `app/api/account/hibernate/route.ts` | Stripe pause_collection |
| `app/api/account/reactivate/route.ts` | Stripe resume_collection |
| `app/api/social/oauth/[provider]/callback/route.ts` | Token storage |
| `lib/social/crypto.ts` | Token encryption/decryption |
| `lib/cache/rateLimit.ts` | Abuse prevention |

### MEDIUM RISK - Standard Testing

| Path | Why |
|------|-----|
| `app/api/insights/route.ts` | Revenue-generating feature |
| `app/api/birth-chart/route.ts` | Core product feature |
| `app/api/connections/*` | User data management |

---

## Verification Commands Summary

```bash
# Full build check
npm run build

# Lint check (if available)
npm run lint

# Search for unused exports
rg "export (const|function)" lib/ --type ts | while read line; do
  export_name=$(echo "$line" | grep -oP "export (const|function) \K\w+")
  count=$(rg -l "$export_name" --type ts --type-add 'tsx:*.tsx' -t tsx | wc -l)
  if [ "$count" -eq 1 ]; then
    echo "POSSIBLY UNUSED: $export_name in $line"
  fi
done

# Check for dead files
rg "from \"@/lib/social\"" --type ts --type-add 'tsx:*.tsx' -t tsx
# Should return 0 results

# Verify deprecated types usage
rg "JoyDeepDive" --type ts --type-add 'tsx:*.tsx' -t tsx
```

---

*End of AUDIT_REPORT.md*
