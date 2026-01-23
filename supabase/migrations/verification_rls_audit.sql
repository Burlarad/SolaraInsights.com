-- ============================================================================
-- RLS AUDIT VERIFICATION SQL
-- Run this after applying migrations to verify security posture
-- ============================================================================

-- ============================================================================
-- SECTION 1: List all tables and their RLS status
-- ============================================================================

SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- SECTION 2: List all policies by table
-- ============================================================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- SECTION 3: List all grants by table
-- ============================================================================

SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- ============================================================================
-- SECTION 4: Security Verification Queries
-- ============================================================================

-- 4a. Tables that SHOULD have RLS but don't
SELECT tablename, 'MISSING RLS' as issue
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT IN ('schema_migrations') -- Supabase internal
ORDER BY tablename;

-- 4b. Sensitive tables that should be service_role only
-- Check for any non-service_role policies
SELECT tablename, policyname, roles, 'NON-SERVICE-ROLE POLICY' as issue
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'social_summaries',
    'social_accounts',
    'social_identities',
    'social_posts',
    'social_profile_summaries',
    'facebook_data_deletion_requests',
    'ai_usage_events',
    'ai_invocations',
    'cache_events',
    'foundation_ledger',
    'soul_paths',
    'birth_data_versions',
    'subscriptions',
    'translation_cache',
    'app_admins',
    'birth_charts'
  )
  AND NOT (qual LIKE '%service_role%' OR qual IS NULL)
ORDER BY tablename;

-- 4c. Tables with GRANT ALL to anon (should be empty or only public content)
SELECT table_name, grantee, string_agg(privilege_type, ', ') as privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee = 'anon'
  AND table_name IN (
    'social_summaries',
    'social_accounts',
    'social_identities',
    'facebook_data_deletion_requests',
    'ai_usage_events',
    'foundation_ledger',
    'soul_paths',
    'subscriptions',
    'app_admins'
  )
GROUP BY table_name, grantee
ORDER BY table_name;

-- 4d. Policies that use USING(false) which may be broken
SELECT tablename, policyname, qual, 'USING(false) - MAY BE BROKEN' as issue
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'false'
ORDER BY tablename;

-- ============================================================================
-- SECTION 5: Expected Policy State After Migration
-- ============================================================================

-- This query should return EMPTY after migration if all is correct:
-- (Tables that should be service_role only but have user-accessible policies)

SELECT tablename, policyname, roles, qual as issue_detail
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'social_summaries',
    'social_accounts',
    'social_identities',
    'social_posts',
    'social_profile_summaries',
    'facebook_data_deletion_requests',
    'ai_usage_events',
    'ai_invocations',
    'cache_events',
    'foundation_ledger',
    'soul_paths',
    'birth_data_versions',
    'app_admins',
    'birth_charts'
  )
  AND qual NOT LIKE '%service_role%'
ORDER BY tablename, policyname;

-- ============================================================================
-- SECTION 6: Confirm Expected Behavior
-- ============================================================================

-- Run these as authenticated user to verify access is blocked:
-- (These should all return 0 rows or permission denied)

-- Should return 0 rows (service_role only):
-- SELECT * FROM social_summaries LIMIT 1;
-- SELECT * FROM social_accounts LIMIT 1;
-- SELECT * FROM social_identities LIMIT 1;
-- SELECT * FROM facebook_data_deletion_requests LIMIT 1;
-- SELECT * FROM ai_usage_events LIMIT 1;
-- SELECT * FROM foundation_ledger LIMIT 1;
-- SELECT * FROM soul_paths LIMIT 1;

-- Should return rows (user can access own):
-- SELECT * FROM profiles WHERE id = auth.uid() LIMIT 1;
-- SELECT * FROM journal_entries WHERE user_id = auth.uid() LIMIT 1;
-- SELECT * FROM connections WHERE owner_user_id = auth.uid() LIMIT 1;

-- Should return rows (public content):
-- SELECT * FROM sign_daily LIMIT 1;
-- SELECT * FROM global_astrology_events LIMIT 1;
-- SELECT * FROM public_compatibility LIMIT 1;

-- ============================================================================
-- SECTION 7: Summary Counts
-- ============================================================================

-- Count of tables by RLS status
SELECT
  CASE WHEN rowsecurity THEN 'RLS Enabled' ELSE 'RLS Disabled' END as status,
  COUNT(*) as table_count
FROM pg_tables
WHERE schemaname = 'public'
GROUP BY rowsecurity;

-- Count of policies by type
SELECT
  CASE
    WHEN qual LIKE '%service_role%' THEN 'service_role'
    WHEN qual LIKE '%auth.uid%' THEN 'user-owned'
    WHEN qual = 'true' THEN 'public'
    WHEN qual = 'false' THEN 'deny-all'
    ELSE 'other'
  END as policy_type,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY policy_type
ORDER BY policy_count DESC;

-- ============================================================================
-- SECTION 8: Foundation Ledger Specific Verification
-- ============================================================================

-- 8a. Verify foundation_ledger schema (new columns added)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'foundation_ledger'
ORDER BY ordinal_position;

-- 8b. Verify foundation_ledger indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'foundation_ledger';

-- 8c. Verify foundation_ledger RLS is enabled
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'foundation_ledger';

-- 8d. Verify foundation_ledger has ONLY service_role policy
-- This should return exactly 1 row with service_role policy
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'foundation_ledger';

-- 8e. Verify NO grants to anon/authenticated on foundation_ledger
-- This should return 0 rows (empty result)
SELECT
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'foundation_ledger'
  AND grantee IN ('anon', 'authenticated');

-- 8f. Verify stripe_event_id unique index exists
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'foundation_ledger'
  AND indexname = 'idx_foundation_ledger_stripe_event_id';

-- ============================================================================
-- SECTION 9: Foundation Ledger Access Tests
-- ============================================================================

-- These queries should be run as different roles to verify access:

-- As anon (should fail with permission denied or return 0 rows):
-- SET ROLE anon;
-- SELECT * FROM foundation_ledger LIMIT 1;
-- INSERT INTO foundation_ledger (entry_type, amount_cents, source, meta) VALUES ('accrual', 100, 'test', '{}');

-- As authenticated (should fail with permission denied or return 0 rows):
-- SET ROLE authenticated;
-- SELECT * FROM foundation_ledger LIMIT 1;
-- INSERT INTO foundation_ledger (entry_type, amount_cents, source, meta) VALUES ('accrual', 100, 'test', '{}');

-- As service_role (should succeed):
-- SET ROLE service_role;
-- SELECT * FROM foundation_ledger LIMIT 1;
-- INSERT INTO foundation_ledger (entry_type, amount_cents, source, stripe_event_id, meta)
--   VALUES ('accrual', 100, 'test', 'evt_test_123', '{}');
-- DELETE FROM foundation_ledger WHERE stripe_event_id = 'evt_test_123';

-- Reset role:
-- RESET ROLE;
