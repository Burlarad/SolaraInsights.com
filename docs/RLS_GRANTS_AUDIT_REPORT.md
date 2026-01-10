# Solara Insights: RLS + GRANT Audit Report

**Generated:** 2026-01-09
**Branch:** `chore/audit-pr2-dead-code`
**Audit Type:** Migration-based (repo inspection)
**Status:** NOT verified against live DB - run SQL queries in production to confirm

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Tables (public schema post-archive) | ~25 active |
| Tables with RLS Enabled | All |
| Critical Issues (Fix Now) | **6** |
| Review Items | **5** |
| Pass | ~14 |

### Verdict: **CONDITIONAL PASS**

The PR3 lock_down migration (`20260108170752`) correctly locks sensitive social/payment tables. However, **6 critical issues** must be fixed before production deployment.

---

## RED FIX NOW - Critical Issues

### Issue 1: `birth_data_versions` Policy Conflict

**Risk:** Migration conflict breaks user access OR leaves data exposed

**Problem:** Two migrations conflict:
- `20260108090000_rls_birth_data_versions.sql` creates user-scoped policies allowing `auth.uid() = user_id`
- `20260108170752_lock_down_sensitive_tables.sql` does `REVOKE ALL FROM anon, authenticated`

The REVOKE removes the underlying GRANTs, making the RLS policies ineffective.

**Fix:** Choose one approach. If users should NOT access birth_data_versions directly:

```sql
-- Option A: Service-role only (remove user policies)
DROP POLICY IF EXISTS "birth_data_versions_select_own" ON public.birth_data_versions;
DROP POLICY IF EXISTS "birth_data_versions_insert_own" ON public.birth_data_versions;
DROP POLICY IF EXISTS "birth_data_versions_update_own" ON public.birth_data_versions;
DROP POLICY IF EXISTS "birth_data_versions_delete_own" ON public.birth_data_versions;

-- Keep service_role policy from earlier migration
```

If users SHOULD access their own birth_data_versions:

```sql
-- Option B: Keep user policies, restore GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.birth_data_versions TO authenticated;
-- Keep user policies + service_role policy
```

---

### Issue 2: `soul_paths` - RLS Enabled, NO Policies Defined

**Risk:** Table is completely inaccessible (RLS blocks all access)

**Problem:** `soul_paths` has `ENABLE ROW LEVEL SECURITY` but no policies in any migration. This blocks all users AND service_role (unless service_role bypasses RLS by default in your Supabase config).

**Fix:**

```sql
-- Add user-owned access policies
CREATE POLICY "soul_paths_select_own" ON public.soul_paths
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "soul_paths_insert_own" ON public.soul_paths
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "soul_paths_update_own" ON public.soul_paths
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "soul_paths_delete_own" ON public.soul_paths
  FOR DELETE USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "soul_paths_service_role_all" ON public.soul_paths
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

---

### Issue 3: `facebook_data_deletion_requests` - Public Read Policy NOT Dropped

**Risk:** Anyone can read ALL deletion requests (PII exposure)

**Problem:** The reconcile migration creates `"Public read by confirmation_code"` with `USING (true)`. The lock_down migration runs `DROP POLICY IF EXISTS` but only if the table exists. The policy name must match exactly.

**Verify:** Run in production:
```sql
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'facebook_data_deletion_requests';
```

If "Public read by confirmation_code" still exists:

```sql
DROP POLICY IF EXISTS "Public read by confirmation_code" ON public.facebook_data_deletion_requests;
```

---

### Issue 4: `social_summaries` - User Policy May Still Exist

**Risk:** Users can still read their own social summaries directly

**Problem:** Reconcile migration creates `"Users can view their own social summaries"`. Lock_down drops it but uses different DROP command syntax.

**Verify:**
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'social_summaries';
```

Should only show: `"Service role can manage social summaries"`

If user policy exists:
```sql
DROP POLICY IF EXISTS "Users can view their own social summaries" ON public.social_summaries;
```

---

### Issue 5: `ai_usage_events` - RLS Enabled, NO Policies

**Risk:** Table inaccessible to all roles

**Problem:** RLS is enabled in reconcile migration but no policies defined anywhere.

**Fix:**
```sql
-- Service role only (logging table)
CREATE POLICY "ai_usage_events_service_role_all" ON public.ai_usage_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.ai_usage_events FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_usage_events TO service_role;
```

---

### Issue 6: `foundation_ledger` - Policy Blocks Everyone

**Risk:** Service role may be blocked too

**Problem:** Has policy `"foundation_ledger_service_rw"` with `USING (false) WITH CHECK (false)` - this blocks ALL access via RLS.

**Note:** In Supabase, `service_role` typically bypasses RLS. Verify this is working:
```sql
-- Test as service_role
SET ROLE service_role;
SELECT * FROM public.foundation_ledger LIMIT 1;
```

If blocked, fix:
```sql
DROP POLICY IF EXISTS "foundation_ledger_service_rw" ON public.foundation_ledger;

CREATE POLICY "foundation_ledger_service_role_all" ON public.foundation_ledger
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

---

## Full Table Inventory

### Legend
- **RLS:** Y = Enabled, N = Disabled
- **Risk:** OK = pass, REVIEW = check, FIX = critical
- **Policies:** Listed by command type

### Public Schema - Active Tables

| Table | RLS | Policies | Risk | Notes |
|-------|-----|----------|------|-------|
| `profiles` | Y | SELECT/INSERT/UPDATE own (auth.uid()=id), service_role ALL | OK | User-owned, properly scoped |
| `connections` | Y | SELECT/INSERT/UPDATE/DELETE own (auth.uid()=owner_user_id) | OK | User-owned |
| `daily_briefs` | Y | SELECT/INSERT/DELETE own (owner_user_id=auth.uid()) | OK | User-owned via connection |
| `space_between_reports` | Y | SELECT (via unlocked connection check), service_role write | OK | Complex but correct |
| `journal_entries` | Y | SELECT/INSERT/UPDATE/DELETE own (auth.uid()=user_id) | OK | User journals |
| `sanctuary_journal_entries` | Y | SELECT/modify self, service_role full | OK | User journals |
| `numerology_profiles` | Y | SELECT/INSERT/UPDATE/DELETE own | OK | User-owned |
| `social_summaries` | Y | service_role only (after lock_down) | REVIEW | Verify user policy dropped |
| `social_accounts` | Y | service_role only + block policies | OK | Sensitive - locked |
| `social_identities` | Y | service_role only + block policies | OK | Sensitive - locked |
| `social_consents` | Y | SELECT/modify self, service_role full | OK | User manages own consent |
| `facebook_data_deletion_requests` | Y | service_role only (after lock_down) | FIX | Verify public read dropped |
| `sign_daily` | Y | Public SELECT, service_role write | OK | Public horoscope feed |
| `subscriptions` | Y | service_role only (after lock_down) | OK | Payment data locked |
| `birth_data_versions` | Y | User policies + service_role (CONFLICT) | FIX | Grant/policy mismatch |
| `global_astrology_events` | Y | `USING (true)` SELECT | OK | Intentionally public |
| `public_compatibility` | Y | `USING (true)` SELECT | OK | Intentionally public |
| `soul_paths` | Y | **NONE** | FIX | Missing all policies! |
| `settings` | Y | SELECT/upsert self, service_role full | OK | User settings |
| `feedback` | Y | INSERT (user or email match), service_role SELECT | REVIEW | See notes below |
| `waitlist_subscribers` | Y | INSERT `WITH CHECK (true)`, service_role SELECT | REVIEW | See notes below |
| `user_year_insights` | Y | SELECT own | OK | User data |
| `user_year_transit_aspects` | Y | SELECT own | OK | User data |
| `year_prewarm_jobs` | Y | SELECT own | REVIEW | User can see job status |
| `foundation_ledger` | Y | `USING (false)` blocks all | FIX | Service role may be blocked |
| `ai_usage_events` | Y | **NONE** | FIX | Missing policies |

### Archive Schema (Low Priority)

Tables moved to `archive` schema are not directly accessible via Supabase client. Low risk.

| Table | Notes |
|-------|-------|
| ai_invocations | Archived |
| analytics_events | Archived |
| app_admins | Archived |
| birth_charts | Archived |
| birth_charts_cache | Archived |
| cache_events | Archived |
| daily_horoscopes | Archived |
| family_members | Archived |
| social_posts | Archived |
| social_profile_summaries | Archived |
| soul_print_master | Archived |
| soul_print_translations | Archived |
| translation_cache | Archived |
| user_daily | Archived |
| user_learn_progress | Archived |

---

## Leak Test Section

### Tables Where RLS ON But Exploitable

#### 1. `feedback` Table
**Status:** REVIEW

**Current Policies:**
- `"Users can insert feedback"`: `WITH CHECK ((auth.uid() = user_id) OR (auth.email() = email))`
- `"Admins can read everything"`: `USING (auth.role() = 'service_role')`

**Risk:** The email match allows insert if `auth.email()` matches, but:
- What if anon user? `auth.email()` would be null
- Users cannot read their own feedback (no SELECT policy for users)

**Recommendation:** Verify `auth.email()` returns null for anon, or tighten:
```sql
-- If only authenticated users should submit:
DROP POLICY IF EXISTS "Users can insert feedback" ON public.feedback;
CREATE POLICY "Users can insert feedback" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

#### 2. `waitlist_subscribers` Table
**Status:** REVIEW

**Current Policies:**
- `"Users can insert themselves into waitlist"`: `WITH CHECK (true)` - **ANYONE can insert!**
- `"Only admins can view waitlist"`: service_role SELECT only

**Risk:** This allows unauthenticated spam to waitlist table.

**If intentional:** Document it. Otherwise:
```sql
-- Rate-limit or require email verification at app layer
-- Or require authenticated:
DROP POLICY IF EXISTS "Users can insert themselves into waitlist" ON public.waitlist_subscribers;
CREATE POLICY "waitlist_insert_authenticated" ON public.waitlist_subscribers
  FOR INSERT TO authenticated
  WITH CHECK (true);
```

#### 3. `global_astrology_events` - Public Read
**Status:** OK (intentional)

Policy `"global_events_read_all"` with `USING (true)` allows anyone to read. This is public content - correct.

#### 4. `public_compatibility` - Public Read
**Status:** OK (intentional)

Policy `"public_compatibility_select"` with `USING (true)` allows public read. Correct for public zodiac compatibility.

### Sensitive Tables - Verification Checklist

Run these queries in production to verify lock_down migration worked:

```sql
-- Verify social_summaries is service_role only
SELECT policyname, roles, qual FROM pg_policies
WHERE tablename = 'social_summaries';
-- Expected: Only "Service role can manage social summaries"

-- Verify social_accounts is locked
SELECT policyname, roles, qual FROM pg_policies
WHERE tablename = 'social_accounts';
-- Expected: sa_service_role_all + block policies

-- Verify social_identities is locked
SELECT policyname, roles, qual FROM pg_policies
WHERE tablename = 'social_identities';
-- Expected: social_identities_service_role_all + block policies

-- Verify facebook_data_deletion_requests
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'facebook_data_deletion_requests';
-- Expected: Only "Service role manages facebook deletion requests"
-- NOT "Public read by confirmation_code"

-- Verify subscriptions is locked
SELECT policyname FROM pg_policies
WHERE tablename = 'subscriptions';
-- Expected: Only "Admins can read subscriptions" (service_role)

-- Verify birth_data_versions (check for conflicts)
SELECT policyname, roles, cmd FROM pg_policies
WHERE tablename = 'birth_data_versions';
-- Check if user policies exist alongside service_role

-- Check grants on sensitive tables
SELECT table_name, grantee, string_agg(privilege_type, ', ') as privs
FROM information_schema.role_table_grants
WHERE table_name IN ('social_summaries', 'social_accounts', 'social_identities',
                     'facebook_data_deletion_requests', 'subscriptions')
  AND grantee IN ('anon', 'authenticated')
GROUP BY 1, 2;
-- Expected: NO rows (all revoked)
```

---

## Break Test Section - App Compatibility

### Tables Client May Read/Write Directly

| Table | Client Usage | Break Risk | Recommendation |
|-------|--------------|------------|----------------|
| `profiles` | Direct read/write via Supabase client | None | Properly protected |
| `connections` | Direct CRUD via client | None | Properly protected |
| `journal_entries` | Direct CRUD via client | None | Properly protected |
| `sanctuary_journal_entries` | Direct CRUD via client | None | Properly protected |
| `settings` | Direct read/upsert via client | None | Properly protected |
| `numerology_profiles` | Direct CRUD via client | None | Properly protected |
| `social_consents` | Direct read/write via client | None | User can manage consent |
| `soul_paths` | Direct read via client | **WILL BREAK** | Add policies (Issue #2) |
| `birth_data_versions` | Direct read via client? | **MAY BREAK** | Resolve conflict (Issue #1) |
| `daily_briefs` | Direct read via client | None | Properly protected |
| `user_year_insights` | Direct read via client | None | Read-only policies OK |

### Tables That Should Be Server-Route Only

| Table | Current Access | Correct Pattern |
|-------|---------------|-----------------|
| `social_summaries` | service_role only | Server route with service_role |
| `social_accounts` | service_role only | Server route with service_role |
| `social_identities` | service_role only | Server route with service_role |
| `subscriptions` | service_role only | Server route with service_role |
| `facebook_data_deletion_requests` | service_role only | Server route with service_role |
| `foundation_ledger` | service_role only | Server route with service_role |
| `ai_usage_events` | service_role only | Server route with service_role |

---

## PR3 Migration Review

### Migration: `20260108090000_rls_birth_data_versions.sql`

**Analysis:**
```sql
alter table public.birth_data_versions enable row level security;

-- Creates user-scoped policies
create policy "birth_data_versions_select_own" ... USING (auth.uid() = user_id);
create policy "birth_data_versions_insert_own" ... WITH CHECK (auth.uid() = user_id);
create policy "birth_data_versions_update_own" ... USING/WITH CHECK (auth.uid() = user_id);
create policy "birth_data_versions_delete_own" ... USING (auth.uid() = user_id);

-- Service role policy
create policy "birth_data_versions_service_role_all" ...
  to service_role USING (true) WITH CHECK (true);
```

**Issues:**
1. Creates user-owned access policies
2. BUT later migration revokes GRANTs
3. No explicit GRANT statements in this migration

**Missing:**
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.birth_data_versions TO authenticated;
```

### Migration: `20260108170752_lock_down_sensitive_tables.sql`

**Analysis:**

| Table | RLS Enable | Drop Old Policies | New Policy | REVOKE | GRANT service_role |
|-------|------------|-------------------|------------|--------|-------------------|
| social_summaries | Y | Y | service_role ALL | Y | Y |
| social_accounts | Y | Y | sa_service_role_all | Y | Y |
| social_identities | Y | Y | service_role_all | Y | Y |
| facebook_data_deletion_requests | Y | Y | service_role | Y | Y |
| sign_daily | Y | N | N/A | Y | SELECT to anon/auth, ALL to service |
| birth_data_versions | Y | N | N/A | Y | service_role only |
| subscriptions | Y | N | N/A | Y | service_role only |
| gratitude_stats | Y (if exists) | N | N/A | Y | service_role only |

**Issues Found:**

1. **birth_data_versions conflict:** REVOKEs grants but earlier migration created user policies. Policies without grants = broken.

2. **sign_daily missing policy creation:** Has public read policy from reconcile, but lock_down doesn't create new policies, only adjusts grants. This is OK if existing policies are correct.

3. **No policies for subscriptions:** Only has "Admins can read subscriptions" from reconcile. After REVOKE, only service_role can access. Correct if intended.

**Correct Patterns Used:**
- `IF to_regclass('public.tablename') IS NOT NULL` guards - excellent
- DROP POLICY IF EXISTS before CREATE - correct
- REVOKE before GRANT - correct order
- Using dynamic SQL in DO blocks - necessary for idempotency

**Missing from lock_down migration:**

1. `soul_paths` - not addressed (needs policies)
2. `ai_usage_events` - not addressed (needs policies)
3. `foundation_ledger` - not addressed (has broken policy)

---

## Recommended Fix Migration

Create new migration: `20260109000000_fix_rls_gaps.sql`

```sql
-- Migration: Fix RLS gaps identified in audit
-- PR3 supplemental fixes

BEGIN;

-- ============================================================
-- FIX 1: soul_paths - Add missing policies
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.soul_paths') IS NOT NULL THEN
    -- User-owned access
    EXECUTE $pol$
      CREATE POLICY "soul_paths_select_own" ON public.soul_paths
        FOR SELECT USING (auth.uid() = user_id)
    $pol$;

    EXECUTE $pol$
      CREATE POLICY "soul_paths_insert_own" ON public.soul_paths
        FOR INSERT WITH CHECK (auth.uid() = user_id)
    $pol$;

    EXECUTE $pol$
      CREATE POLICY "soul_paths_update_own" ON public.soul_paths
        FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
    $pol$;

    EXECUTE $pol$
      CREATE POLICY "soul_paths_delete_own" ON public.soul_paths
        FOR DELETE USING (auth.uid() = user_id)
    $pol$;

    -- Service role
    EXECUTE $pol$
      CREATE POLICY "soul_paths_service_role_all" ON public.soul_paths
        FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role')
    $pol$;
  END IF;
END $$;

-- ============================================================
-- FIX 2: ai_usage_events - Service role only
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.ai_usage_events') IS NOT NULL THEN
    EXECUTE $pol$
      CREATE POLICY "ai_usage_events_service_role_all" ON public.ai_usage_events
        FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role')
    $pol$;

    EXECUTE 'REVOKE ALL ON TABLE public.ai_usage_events FROM anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.ai_usage_events TO service_role';
  END IF;
END $$;

-- ============================================================
-- FIX 3: foundation_ledger - Replace broken policy
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.foundation_ledger') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "foundation_ledger_service_rw" ON public.foundation_ledger';

    EXECUTE $pol$
      CREATE POLICY "foundation_ledger_service_role_all" ON public.foundation_ledger
        FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role')
    $pol$;

    EXECUTE 'REVOKE ALL ON TABLE public.foundation_ledger FROM anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.foundation_ledger TO service_role';
  END IF;
END $$;

-- ============================================================
-- FIX 4: birth_data_versions - Resolve conflict
-- Option A: Service role only (recommended if users don't need direct access)
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.birth_data_versions') IS NOT NULL THEN
    -- Remove user policies (they conflict with REVOKE in lock_down)
    EXECUTE 'DROP POLICY IF EXISTS "birth_data_versions_select_own" ON public.birth_data_versions';
    EXECUTE 'DROP POLICY IF EXISTS "birth_data_versions_insert_own" ON public.birth_data_versions';
    EXECUTE 'DROP POLICY IF EXISTS "birth_data_versions_update_own" ON public.birth_data_versions';
    EXECUTE 'DROP POLICY IF EXISTS "birth_data_versions_delete_own" ON public.birth_data_versions';

    -- Service role policy should already exist, but ensure it does
    EXECUTE 'DROP POLICY IF EXISTS "birth_data_versions_service_role_all" ON public.birth_data_versions';
    EXECUTE $pol$
      CREATE POLICY "birth_data_versions_service_role_all" ON public.birth_data_versions
        FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role')
    $pol$;
  END IF;
END $$;

-- ============================================================
-- FIX 5: Verify facebook_data_deletion_requests public policy dropped
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.facebook_data_deletion_requests') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Public read by confirmation_code" ON public.facebook_data_deletion_requests';
  END IF;
END $$;

-- ============================================================
-- FIX 6: Verify social_summaries user policy dropped
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.social_summaries') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own social summaries" ON public.social_summaries';
  END IF;
END $$;

COMMIT;
```

---

## SECURITY DEFINER Functions Review

| Function | Purpose | Risk | Notes |
|----------|---------|------|-------|
| `handle_new_user()` | Creates profile on signup | LOW | Only inserts to profiles, runs as trigger |
| `connections_maintain_flags()` | Updates mutual flags | LOW | Only updates connections table |
| `maintain_mutual_flag()` | Updates is_mutual | LOW | Only updates connections |
| `recompute_mutual_and_unlock()` | Recomputes connection flags | LOW | Only updates connections |
| `recompute_mutual_for_pair()` | Helper for mutual flag | LOW | Only updates connections |
| `set_soul_path_interpretation()` | Sets interpretation cache | MEDIUM | Updates soul_paths by user_id - verify caller validation |

**Recommendation:** All functions have `SET search_path TO 'public'` which is good. They're trigger functions or helper functions that only modify their intended tables. No RLS bypass concerns identified.

---

## Verification SQL Queries

Run these in production to generate a complete picture:

### Query 1: All Tables + RLS Status
```sql
SELECT
  n.nspname AS schema,
  c.relname AS table,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p')
  AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
ORDER BY 1, 2;
```

### Query 2: All Policies
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, tablename, policyname;
```

### Query 3: All Grants
```sql
SELECT
  table_schema,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema NOT IN ('pg_catalog','information_schema')
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
```

### Query 4: Functions with SECURITY DEFINER
```sql
SELECT
  n.nspname AS schema,
  p.proname AS function,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true
  AND n.nspname = 'public';
```

---

## Summary Checklist

- [ ] Run fix migration `20260109000000_fix_rls_gaps.sql`
- [ ] Verify in production with Query 2 (policies)
- [ ] Verify in production with Query 3 (grants)
- [ ] Test `soul_paths` access from authenticated client
- [ ] Test `social_summaries` is blocked from client
- [ ] Test `subscriptions` is blocked from client
- [ ] Document `waitlist_subscribers` open insert policy (intentional or fix)
- [ ] Document `feedback` email-match insert policy (intentional or fix)

---

## Appendix: Tables by Category

### User-Owned Data (auth.uid() scoped)
- profiles, connections, journal_entries, sanctuary_journal_entries
- daily_briefs, numerology_profiles, settings, social_consents
- soul_paths (after fix), user_year_insights, user_year_transit_aspects

### Public Content (USING true)
- sign_daily (SELECT only), global_astrology_events, public_compatibility

### Service Role Only (sensitive)
- social_summaries, social_accounts, social_identities
- facebook_data_deletion_requests, subscriptions, birth_data_versions
- foundation_ledger, ai_usage_events

### Review Needed
- feedback, waitlist_subscribers, year_prewarm_jobs
