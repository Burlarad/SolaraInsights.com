# CLEAN YOUR ROOM AUDIT
> Generated: 2025-12-23
> Mode: AUDIT ONLY - No code changes

---

## 1) Executive Summary

### Top 10 Messes (Ranked)

| # | Issue | Priority | Impact |
|---|-------|----------|--------|
| 1 | **`social_connections` table is DEAD** | P0 | 100% unused, still has SQL migrations, RLS policies, docs referencing it |
| 2 | **`social_connect_prompt_dismissed_at` is DEAD** | P0 | Profile field never checked, API payload never called, bloats types |
| 3 | **Documentation rot** - 7 markdown files reference `/connect-social` (deleted) | P1 | Confuses future devs, stale audits |
| 4 | **3 URL env vars** - `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `APP_URL` | P1 | Drift risk, inconsistent usage across codebase |
| 5 | **"Coming soon" buttons** in auth pages are error stubs | P1 | Bad UX - X/Reddit buttons exist but show error on click |
| 6 | **`SOCIAL_PROVIDERS` config duplicated** inline in Settings | P2 | Should be shared constant |
| 7 | **SocialConnectModal** may be redundant with Settings toggles | P2 | Sanctuary modal still exists, now Settings has full connect/disconnect |
| 8 | **~8000 lines of markdown audits** in repo root | P2 | Many are stale, clutter git history |
| 9 | **`last_collected_at` vs `last_fetched_at`** naming inconsistency | P2 | DB says one, code says another |
| 10 | **Timezone fallback scattered** across 10+ files | P2 | Same pattern repeated, could be one helper |

### If We Do Nothing, What Breaks?

**Nothing breaks today.** But:
- New devs will waste hours reading stale docs
- `social_connections` table wastes DB space and confuses schema
- `dismissPrompt` API payload is dead code that suggests a feature exists
- "Coming soon" buttons suggest X/Reddit are almost ready (they're not)

---

## 2) Single Source of Truth Map

| Domain | Canonical Location | Notes |
|--------|-------------------|-------|
| **OAuth Tokens** | `social_accounts` table | Service-role only, AES-256-GCM encrypted |
| **Token Storage Route** | `app/api/social/oauth/[provider]/callback/route.ts` | Upserts on successful OAuth |
| **Social Summaries** | `social_summaries` table | User-readable, service-writable |
| **Summary Generation** | `app/api/social/sync/route.ts` | OpenAI summarization |
| **Birth Data** | `profiles` table | `birth_date`, `birth_time`, `birth_city`, `birth_lat`, `birth_lon`, `timezone` |
| **Birth Location UI** | `components/shared/PlacePicker.tsx` | Mapbox-powered autocomplete |
| **Birth Chart Cache** | `soul_paths.blueprint` JSONB | Persisted, no Redis |
| **Insights Cache** | Redis: `insights:{userId}:{sign}:{timeframe}:{periodKey}` | 48h TTL |
| **Connections** | `connections` table | `owner_id` + `linked_profile_id` |
| **Social Enabled Flag** | `profiles.social_insights_enabled` | Derived from first connection, toggleable |

---

## 3) Delete List

### DELETE NOW (Safe, No Dependencies)

| Path | Why | Evidence | Risk | Rollback |
|------|-----|----------|------|----------|
| `sql/social_tables_rls.sql` | References `social_connections` which is dead | `rg social_connections sql/` shows only this + 011/012 | None | Git revert |
| Profile field `social_connect_prompt_dismissed_at` | Never checked anywhere | `rg "social_connect_prompt_dismissed_at" app lib` = 0 hits in runtime code | None | DB migration to drop column |
| API payload `dismissPrompt` in `social-insights/route.ts:66-69` | Never called | `rg "dismissPrompt" app` = only the handler, no callers | None | Git revert |
| Types entry `social_connect_prompt_dismissed_at` in `types/index.ts:55` | Dead field | See above | None | Edit file |

### DELETE AFTER VERIFICATION

| Path | Why | Evidence | Verification SQL | Risk |
|------|-----|----------|------------------|------|
| `social_connections` table | Entirely unused in code | `rg "social_connections" app lib` = 0 hits | `SELECT COUNT(*) FROM social_connections;` - expect 0 rows | Low - check row count first |
| Migration `sql/011_social_insights_pipeline.sql` sections for `social_connections` | Table is dead | See above | Same | Keep file, remove social_connections sections |
| Migration `sql/012_social_oauth_tokens.sql` | All about `social_connections` tokens | Table replaced by `social_accounts` | Verify `social_accounts` has all data | Low |

### VERIFY THEN DELETE (Documentation)

| Path | Why | Status |
|------|-----|--------|
| `SOLARA_STATUS_AUDIT.md` refs to `/connect-social` | Page deleted | Update or delete file |
| `REPO_WIDE_AUDIT.md` refs to `/connect-social` | Page deleted | Update or delete file |
| `NEXT_ACTIONS.md` refs to `/connect-social` | Page deleted | Update or delete file |
| `FEATURE_PROGRESS_MATRIX.md` refs to `/connect-social` | Page deleted | Update or delete file |
| `REPO_AUDIT.md` refs to `/connect-social` | Page deleted | Update or delete file |

---

## 4) Coherence Plan

### A) Remove Duplicate Flows

**Problem:** Provider card UI rendered in 3 places with different implementations
- `app/(protected)/settings/page.tsx` - `SOCIAL_PROVIDERS` array, inline cards
- `components/sanctuary/SocialConnectModal.tsx` - fetches status, renders cards
- ~~`app/(auth)/connect-social/page.tsx`~~ - DELETED

**Fix:**
1. Extract `SOCIAL_PROVIDERS` to `lib/social/config.ts`
2. Create `components/social/ProviderCard.tsx` reusable component
3. Both Settings and SocialConnectModal import from shared config

### B) Unify Naming Conventions

| Current | Should Be | Files Affected |
|---------|-----------|----------------|
| `last_collected_at` (DB migration) | `last_fetched_at` | `sql/011_social_insights_pipeline.sql` |
| `NEXT_PUBLIC_APP_URL` vs `APP_URL` | Pick ONE for auth redirects | 5+ files |
| `NEXT_PUBLIC_SITE_URL` | Keep for OAuth (already canonical) | N/A |

**Recommendation:**
- `NEXT_PUBLIC_SITE_URL` = OAuth callbacks (keep)
- `NEXT_PUBLIC_APP_URL` = Client-side redirects (keep)
- `APP_URL` = DELETE, use `NEXT_PUBLIC_APP_URL` everywhere

### C) Unify Response Formats

All social API responses should follow:
```typescript
{ success: boolean, provider?: string, error?: string, message?: string }
```

Current inconsistencies:
- `revoke` returns `{ success, provider, status, remainingConnectedCount }`
- `status` returns `{ connections: [...] }`
- `social-insights` returns `{ success }` only

**Fix:** Document expected response shapes in `types/index.ts`

### D) Unify OAuth Redirects

**Current state (GOOD after this PR):**
- All OAuth callbacks default to `/settings` if no `return_to`
- Success: `?social=connected&provider=X`
- Error: `?error=X&provider=Y`

**No changes needed** - already unified.

### E) "Coming Soon" Button Cleanup

**Problem:** Auth pages have X/Reddit buttons that show error toasts on click

**Files:**
- `app/(auth)/sign-in/page.tsx:134,144`
- `app/(auth)/welcome/page.tsx:160,169`
- `app/(auth)/join/page.tsx:243,253`

**Options:**
1. **HIDE** disabled providers entirely (recommended)
2. Show disabled state with no click handler
3. Remove the buttons

---

## 5) Dead Ends & Drift

### State Drift Risks

| Risk | Current State | Should Be |
|------|---------------|-----------|
| `social_insights_enabled` can be `true` with 0 connected accounts | Possible after manual toggle | FIXED - revoke API now sets `enabled=false` when last account disconnected |
| `social_connect_prompt_dismissed_at` vs `social_insights_activated_at` | Both exist, one never used | DELETE `dismissed_at`, keep `activated_at` |
| `social_connections` table exists but unused | 0 code references | DROP TABLE after verification |

### Pages No Longer in Product Flow

| Path | Status | Action |
|------|--------|--------|
| `/connect-social` | DELETED | Done |
| `/welcome` | Still exists, used for email signup | KEEP |
| `/onboarding` | Still exists, always routes to `/sanctuary` | KEEP |

### Old Tables Still Referenced in Docs

| Table | Status | Docs Referencing |
|-------|--------|------------------|
| `social_connections` | DEAD | `REPO_AUDIT.md`, `sql/*.sql` |
| `practice_entries` | VERIFY | May be legacy |

---

## 6) Security & Abuse Surface

### Public Endpoints

| Endpoint | Rate Limited | Auth | Risk |
|----------|--------------|------|------|
| `/api/public-horoscope` | YES (30/min) | None | Low - rate limited |
| `/api/public-tarot` | YES (30/min) | None | Low - rate limited |
| `/api/public-compatibility` | YES (30/min) | None | Low - rate limited |

### Cron Secret Handling

| Endpoint | Auth Method | Status |
|----------|-------------|--------|
| `/api/cron/prewarm-insights` | `x-cron-secret` header | OK |
| `/api/cron/social-sync` | `Authorization: Bearer` | OK |
| `/api/social/sync` | `Authorization: Bearer` | OK |
| `/api/social/sync-user` | Session OR `Authorization: Bearer` | OK |

**P0 Risks:** None identified. All sensitive endpoints properly protected.

### RLS Alignment

| Table | RLS Enabled | Policy |
|-------|-------------|--------|
| `social_accounts` | YES | Service-role only (users blocked) |
| `social_summaries` | YES | User can read own, linked profiles can read if Space Between unlocked |
| `profiles` | YES | User can read/write own |
| `connections` | YES | User can manage where owner_id = self |

**Status:** RLS is correctly configured.

---

## 7) Supabase Cleanup Plan

### Schema Verification SQL

```sql
-- Check social_accounts structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'social_accounts'
ORDER BY ordinal_position;

-- Check social_connections exists and row count
SELECT COUNT(*) as row_count FROM social_connections;

-- List all RLS policies on social tables
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('social_accounts', 'social_summaries', 'social_connections');

-- Check indexes on social tables
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename IN ('social_accounts', 'social_summaries', 'social_connections');
```

### Unused Column Detection

```sql
-- Check if social_connect_prompt_dismissed_at has any non-null values
SELECT COUNT(*) as non_null_count
FROM profiles
WHERE social_connect_prompt_dismissed_at IS NOT NULL;
-- Expected: 0 (safe to drop)
```

### Optional Drops (COMMENTED - NEVER AUTO-RUN)

```sql
-- DANGER: Only run after verification
-- DROP TABLE IF EXISTS social_connections CASCADE;

-- DANGER: Only run after verification
-- ALTER TABLE profiles DROP COLUMN IF EXISTS social_connect_prompt_dismissed_at;
```

---

## 8) PR Plan

### PR 1: Dead Code Removal (Low Risk)

**Goal:** Remove unused code paths and types

**Files to change:**
- `types/index.ts` - Remove `social_connect_prompt_dismissed_at` from Profile interface
- `app/api/user/social-insights/route.ts` - Remove `dismissPrompt` handler (lines 66-69)
- `supabase/migrations/` - Add migration to drop `social_connect_prompt_dismissed_at` column

**Verification:**
- [ ] `npm run build` passes
- [ ] `rg "dismissPrompt" app lib` returns 0 hits
- [ ] Run: `SELECT COUNT(*) FROM profiles WHERE social_connect_prompt_dismissed_at IS NOT NULL;` - expect 0

**Rollback:** Git revert + DB: `ALTER TABLE profiles ADD COLUMN social_connect_prompt_dismissed_at TIMESTAMPTZ;`

---

### PR 2: Documentation Cleanup

**Goal:** Remove stale documentation references

**Files to delete (consider):**
- `PRACTICE_REMOVAL_AUDIT.md` - If practice feature is gone
- `TODAY_AUDIT.md` - If one-time audit

**Files to update:**
- `REPO_AUDIT.md` - Remove `/connect-social` references
- `SOLARA_STATUS_AUDIT.md` - Remove `/connect-social` references
- `NEXT_ACTIONS.md` - Remove `/connect-social` references
- `FEATURE_PROGRESS_MATRIX.md` - Remove `/connect-social` references

**Verification:**
- [ ] `rg "connect-social" *.md` returns 0 hits

---

### PR 3: Database Table Cleanup

**Goal:** Drop `social_connections` table

**Prerequisites:**
- Verify 0 rows: `SELECT COUNT(*) FROM social_connections;`
- Verify 0 code references: `rg "social_connections" app lib` = 0

**SQL Migration:**
```sql
-- Drop RLS policies first
DROP POLICY IF EXISTS "Users can view their own social connections" ON public.social_connections;
DROP POLICY IF EXISTS "Users can insert their own social connections" ON public.social_connections;
DROP POLICY IF EXISTS "Users can update their own social connections" ON public.social_connections;
DROP POLICY IF EXISTS "Users can delete their own social connections" ON public.social_connections;

-- Drop indexes
DROP INDEX IF EXISTS idx_social_connections_user_provider;
DROP INDEX IF EXISTS idx_social_connections_token_expiry;

-- Drop table
DROP TABLE IF EXISTS public.social_connections;
```

**Verification:**
- [ ] Table no longer exists
- [ ] `social_accounts` still works (run `/api/social/status`)
- [ ] OAuth flow still works (connect TikTok from Settings)

**Rollback:** Restore from `sql/011_social_insights_pipeline.sql`

---

### PR 4: "Coming Soon" Button Cleanup

**Goal:** Hide disabled provider buttons instead of showing error

**Files to change:**
- `app/(auth)/sign-in/page.tsx` - Remove X/Reddit buttons or hide when disabled
- `app/(auth)/welcome/page.tsx` - Same
- `app/(auth)/join/page.tsx` - Same

**Verification:**
- [ ] Sign-in page shows only Facebook + TikTok (enabled providers)
- [ ] No "coming soon" error toasts appear

---

### PR 5: Extract Shared Social Config (Optional)

**Goal:** DRY up provider configuration

**Changes:**
- Create `lib/social/config.ts` with `SOCIAL_PROVIDERS` constant
- Update `app/(protected)/settings/page.tsx` to import from config
- Update `components/sanctuary/SocialConnectModal.tsx` to import from config

**Verification:**
- [ ] Both Settings and Sanctuary modal render same provider list
- [ ] Adding a new provider requires change in one place

---

## Verification Checklist (Final)

After all PRs merged:

- [ ] `npm run build` passes
- [ ] `rg "social_connections" .` returns only SQL history files
- [ ] `rg "connect-social" app components lib` returns 0 hits
- [ ] `rg "dismissPrompt" app lib` returns 0 hits
- [ ] OAuth connect from Settings works (TikTok/Facebook)
- [ ] OAuth connect from Sanctuary modal works
- [ ] Disconnect from Settings works
- [ ] Disconnecting last provider sets `social_insights_enabled=false`
- [ ] `/connect-social` returns 404
- [ ] All public endpoints respond with rate limit headers

---

## Summary

**Total deletions identified:**
- 1 table (`social_connections`)
- 1 profile column (`social_connect_prompt_dismissed_at`)
- 1 API payload (`dismissPrompt`)
- 5+ markdown files with stale references
- 6 "coming soon" error buttons

**Risk level:** LOW - All deletions are for unused code/data

**Estimated effort:** 4-6 hours across 5 PRs

**Biggest wins:**
1. Cleaner schema (no dead table)
2. Cleaner types (no dead fields)
3. Cleaner UX (no fake buttons)
4. Cleaner docs (no stale references)
