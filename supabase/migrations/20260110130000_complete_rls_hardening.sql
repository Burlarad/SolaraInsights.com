-- Complete RLS Hardening Migration
-- Addresses all remaining gaps from the comprehensive audit
-- Run AFTER: 20260110124959_fix_rls_grants_remove_gratitude_stats.sql

-- ============================================================================
-- SECTION 1: Fix broken USING(false) policies
-- These policies block ALL access including service_role
-- ============================================================================

-- 1a. ai_invocations: Fix broken policy
DO $$
BEGIN
  IF to_regclass('public.ai_invocations') IS NOT NULL THEN
    -- Drop the broken policy
    DROP POLICY IF EXISTS "ai_invocations_service_rw" ON public.ai_invocations;

    -- Create proper service_role policy
    CREATE POLICY "ai_invocations_service_role_all"
    ON public.ai_invocations
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

    -- Lock down grants
    REVOKE ALL ON TABLE public.ai_invocations FROM anon, authenticated;
    GRANT ALL ON TABLE public.ai_invocations TO service_role;

    RAISE NOTICE 'Fixed ai_invocations policy';
  END IF;
END $$;

-- 1b. cache_events: Fix broken policy
DO $$
BEGIN
  IF to_regclass('public.cache_events') IS NOT NULL THEN
    -- Drop the broken policy
    DROP POLICY IF EXISTS "cache_events_service_rw" ON public.cache_events;

    -- Create proper service_role policy
    CREATE POLICY "cache_events_service_role_all"
    ON public.cache_events
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

    -- Lock down grants
    REVOKE ALL ON TABLE public.cache_events FROM anon, authenticated;
    GRANT ALL ON TABLE public.cache_events TO service_role;

    RAISE NOTICE 'Fixed cache_events policy';
  END IF;
END $$;

-- ============================================================================
-- SECTION 2: Remove admin-select policies from social tables
-- App admins should not be able to read OAuth tokens or raw social data
-- ============================================================================

-- 2a. social_accounts: Remove admin SELECT, keep service_role only
DO $$
BEGIN
  IF to_regclass('public.social_accounts') IS NOT NULL THEN
    -- Drop admin select policy (exposes OAuth tokens to app admins)
    DROP POLICY IF EXISTS "sa_admin_select" ON public.social_accounts;

    -- Drop legacy user-deny policies (superseded by service_role-only)
    DROP POLICY IF EXISTS "Users cannot read social_accounts" ON public.social_accounts;
    DROP POLICY IF EXISTS "Users cannot insert social_accounts" ON public.social_accounts;
    DROP POLICY IF EXISTS "Users cannot update social_accounts" ON public.social_accounts;
    DROP POLICY IF EXISTS "Users cannot delete social_accounts" ON public.social_accounts;

    -- Ensure service_role policy exists
    DROP POLICY IF EXISTS "sa_service_role_all" ON public.social_accounts;
    CREATE POLICY "sa_service_role_all"
    ON public.social_accounts
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

    -- Lock down grants
    REVOKE ALL ON TABLE public.social_accounts FROM anon, authenticated;
    GRANT ALL ON TABLE public.social_accounts TO service_role;

    RAISE NOTICE 'Hardened social_accounts';
  END IF;
END $$;

-- ============================================================================
-- SECTION 3: Lock down unused social tables
-- social_posts and social_profile_summaries are not used in app code
-- ============================================================================

-- 3a. social_posts: Lock to service_role only
DO $$
BEGIN
  IF to_regclass('public.social_posts') IS NOT NULL THEN
    -- Drop all existing policies
    DROP POLICY IF EXISTS "sp_admin_select" ON public.social_posts;
    DROP POLICY IF EXISTS "sp_insert_own" ON public.social_posts;

    -- Create service_role only policy
    CREATE POLICY "social_posts_service_role_all"
    ON public.social_posts
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

    -- Lock down grants
    REVOKE ALL ON TABLE public.social_posts FROM anon, authenticated;
    GRANT ALL ON TABLE public.social_posts TO service_role;

    RAISE NOTICE 'Locked down social_posts';
  END IF;
END $$;

-- 3b. social_profile_summaries: Lock to service_role only
DO $$
BEGIN
  IF to_regclass('public.social_profile_summaries') IS NOT NULL THEN
    -- Drop all existing policies (expose social data to users)
    DROP POLICY IF EXISTS "sps_select_admin" ON public.social_profile_summaries;
    DROP POLICY IF EXISTS "sps_select_self" ON public.social_profile_summaries;
    DROP POLICY IF EXISTS "sps_update_self" ON public.social_profile_summaries;
    DROP POLICY IF EXISTS "sps_upsert_self" ON public.social_profile_summaries;

    -- Create service_role only policy
    CREATE POLICY "social_profile_summaries_service_role_all"
    ON public.social_profile_summaries
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

    -- Lock down grants
    REVOKE ALL ON TABLE public.social_profile_summaries FROM anon, authenticated;
    GRANT ALL ON TABLE public.social_profile_summaries TO service_role;

    RAISE NOTICE 'Locked down social_profile_summaries';
  END IF;
END $$;

-- ============================================================================
-- SECTION 4: Enable RLS on tables missing it
-- app_admins and birth_charts have NO RLS enabled
-- ============================================================================

-- 4a. app_admins: Enable RLS, service_role only
DO $$
BEGIN
  IF to_regclass('public.app_admins') IS NOT NULL THEN
    ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

    -- Create service_role only policy
    -- Note: Other policies use subqueries against app_admins, but those run with
    -- the invoking user's privileges, so they still work.
    CREATE POLICY "app_admins_service_role_all"
    ON public.app_admins
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

    -- Lock down grants
    REVOKE ALL ON TABLE public.app_admins FROM anon, authenticated;
    GRANT ALL ON TABLE public.app_admins TO service_role;
    -- Note: Authenticated users can still use EXISTS(SELECT 1 FROM app_admins WHERE ...)
    -- in other policies because those subqueries run with elevated privileges in RLS context

    RAISE NOTICE 'Enabled RLS on app_admins';
  END IF;
END $$;

-- 4b. birth_charts: Enable RLS, service_role only
-- This appears to be a legacy table not actively used
DO $$
BEGIN
  IF to_regclass('public.birth_charts') IS NOT NULL THEN
    ALTER TABLE public.birth_charts ENABLE ROW LEVEL SECURITY;

    -- Create service_role only policy
    CREATE POLICY "birth_charts_service_role_all"
    ON public.birth_charts
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

    -- Lock down grants
    REVOKE ALL ON TABLE public.birth_charts FROM anon, authenticated;
    GRANT ALL ON TABLE public.birth_charts TO service_role;

    RAISE NOTICE 'Enabled RLS on birth_charts';
  END IF;
END $$;

-- ============================================================================
-- SECTION 5: Clean up legacy/redundant policies on social_identities
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.social_identities') IS NOT NULL THEN
    -- Drop legacy user-deny policies (superseded by service_role-only)
    DROP POLICY IF EXISTS "Users cannot read social_identities" ON public.social_identities;
    DROP POLICY IF EXISTS "Users cannot insert social_identities" ON public.social_identities;
    DROP POLICY IF EXISTS "Users cannot update social_identities" ON public.social_identities;
    DROP POLICY IF EXISTS "Users cannot delete social_identities" ON public.social_identities;

    -- Ensure service_role policy exists
    DROP POLICY IF EXISTS "social_identities_service_role_all" ON public.social_identities;
    CREATE POLICY "social_identities_service_role_all"
    ON public.social_identities
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

    -- Lock down grants
    REVOKE ALL ON TABLE public.social_identities FROM anon, authenticated;
    GRANT ALL ON TABLE public.social_identities TO service_role;

    RAISE NOTICE 'Cleaned up social_identities policies';
  END IF;
END $$;

-- ============================================================================
-- SECTION 6: Ensure social_summaries is fully locked (belt and suspenders)
-- The staged migration should handle this, but let's make sure
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.social_summaries') IS NOT NULL THEN
    -- Drop ALL user-accessible policies
    DROP POLICY IF EXISTS "Users can view their own social summaries" ON public.social_summaries;
    DROP POLICY IF EXISTS "Users can insert their own social summaries" ON public.social_summaries;
    DROP POLICY IF EXISTS "Users can update their own social summaries" ON public.social_summaries;
    DROP POLICY IF EXISTS "Users can delete their own social summaries" ON public.social_summaries;
    DROP POLICY IF EXISTS "Users can view linked profile social summaries" ON public.social_summaries;

    -- Ensure only service_role policy exists
    DROP POLICY IF EXISTS "Service role can manage social summaries" ON public.social_summaries;
    DROP POLICY IF EXISTS "social_summaries_service_role_all" ON public.social_summaries;
    CREATE POLICY "social_summaries_service_role_all"
    ON public.social_summaries
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

    -- Lock down grants
    REVOKE ALL ON TABLE public.social_summaries FROM anon, authenticated;
    GRANT ALL ON TABLE public.social_summaries TO service_role;

    RAISE NOTICE 'Ensured social_summaries is service_role only';
  END IF;
END $$;

-- ============================================================================
-- SECTION 7: Revoke unnecessary grants from other sensitive tables
-- Even with RLS, grants should match intended access level
-- ============================================================================

-- subscriptions: should be service_role only
DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.subscriptions FROM anon, authenticated;
    GRANT ALL ON TABLE public.subscriptions TO service_role;
    RAISE NOTICE 'Locked down subscriptions grants';
  END IF;
END $$;

-- translation_cache: should be service_role only
DO $$
BEGIN
  IF to_regclass('public.translation_cache') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.translation_cache FROM anon, authenticated;
    GRANT ALL ON TABLE public.translation_cache TO service_role;
    RAISE NOTICE 'Locked down translation_cache grants';
  END IF;
END $$;

-- year_prewarm_jobs: users only need SELECT, not ALL
DO $$
BEGIN
  IF to_regclass('public.year_prewarm_jobs') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.year_prewarm_jobs FROM anon;
    REVOKE INSERT, UPDATE, DELETE ON TABLE public.year_prewarm_jobs FROM authenticated;
    GRANT SELECT ON TABLE public.year_prewarm_jobs TO authenticated;
    GRANT ALL ON TABLE public.year_prewarm_jobs TO service_role;
    RAISE NOTICE 'Restricted year_prewarm_jobs grants';
  END IF;
END $$;

-- user_year_insights: users only need SELECT
DO $$
BEGIN
  IF to_regclass('public.user_year_insights') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.user_year_insights FROM anon;
    REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_year_insights FROM authenticated;
    GRANT SELECT ON TABLE public.user_year_insights TO authenticated;
    GRANT ALL ON TABLE public.user_year_insights TO service_role;
    RAISE NOTICE 'Restricted user_year_insights grants';
  END IF;
END $$;

-- user_year_transit_aspects: users only need SELECT
DO $$
BEGIN
  IF to_regclass('public.user_year_transit_aspects') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.user_year_transit_aspects FROM anon;
    REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_year_transit_aspects FROM authenticated;
    GRANT SELECT ON TABLE public.user_year_transit_aspects TO authenticated;
    GRANT ALL ON TABLE public.user_year_transit_aspects TO service_role;
    RAISE NOTICE 'Restricted user_year_transit_aspects grants';
  END IF;
END $$;

-- ============================================================================
-- SECTION 8: Final confirmation
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'RLS HARDENING COMPLETE';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Run verification SQL to confirm all policies are correct.';
END $$;
