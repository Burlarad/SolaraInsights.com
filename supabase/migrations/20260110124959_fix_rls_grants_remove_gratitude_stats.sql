-- Fix RLS + GRANTS gaps and remove deprecated gratitude_stats
-- PR3 / Security hardening: lock sensitive tables to service_role only
-- and delete junk table gratitude_stats.

-- ============================
-- Helper: drop ALL policies for a table (if any)
-- pg_policies column is: policyname (NOT polname)
-- ============================
DO $$
DECLARE r RECORD;
BEGIN
  -- ai_usage_events
  IF to_regclass('public.ai_usage_events') IS NOT NULL THEN
    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'ai_usage_events'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_usage_events;', r.policyname);
    END LOOP;
  END IF;

  -- birth_data_versions
  IF to_regclass('public.birth_data_versions') IS NOT NULL THEN
    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'birth_data_versions'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.birth_data_versions;', r.policyname);
    END LOOP;
  END IF;

  -- facebook_data_deletion_requests
  IF to_regclass('public.facebook_data_deletion_requests') IS NOT NULL THEN
    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'facebook_data_deletion_requests'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.facebook_data_deletion_requests;', r.policyname);
    END LOOP;
  END IF;

  -- foundation_ledger
  IF to_regclass('public.foundation_ledger') IS NOT NULL THEN
    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'foundation_ledger'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.foundation_ledger;', r.policyname);
    END LOOP;
  END IF;

  -- soul_paths (if it exists)
  IF to_regclass('public.soul_paths') IS NOT NULL THEN
    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'soul_paths'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.soul_paths;', r.policyname);
    END LOOP;
  END IF;

  -- social_summaries (if it exists)
  IF to_regclass('public.social_summaries') IS NOT NULL THEN
    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'social_summaries'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.social_summaries;', r.policyname);
    END LOOP;
  END IF;

  -- gratitude_stats (if it still exists anywhere)
  IF to_regclass('public.gratitude_stats') IS NOT NULL THEN
    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'gratitude_stats'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.gratitude_stats;', r.policyname);
    END LOOP;
  END IF;
END $$;

-- ============================
-- Re-apply intended security posture
-- ============================

-- ai_usage_events: service_role only
ALTER TABLE IF EXISTS public.ai_usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_usage_events_service_role_all" ON public.ai_usage_events;
CREATE POLICY "ai_usage_events_service_role_all"
ON public.ai_usage_events
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
REVOKE ALL ON TABLE public.ai_usage_events FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_usage_events TO service_role;

-- birth_data_versions: service_role only
ALTER TABLE IF EXISTS public.birth_data_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "birth_data_versions_service_role_all" ON public.birth_data_versions;
CREATE POLICY "birth_data_versions_service_role_all"
ON public.birth_data_versions
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
REVOKE ALL ON TABLE public.birth_data_versions FROM anon, authenticated;
GRANT ALL ON TABLE public.birth_data_versions TO service_role;

-- facebook_data_deletion_requests: service_role only
ALTER TABLE IF EXISTS public.facebook_data_deletion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "facebook_data_deletion_requests_service_role_all" ON public.facebook_data_deletion_requests;
CREATE POLICY "facebook_data_deletion_requests_service_role_all"
ON public.facebook_data_deletion_requests
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
REVOKE ALL ON TABLE public.facebook_data_deletion_requests FROM anon, authenticated;
GRANT ALL ON TABLE public.facebook_data_deletion_requests TO service_role;

-- foundation_ledger: service_role only (this table should not be user-readable)
ALTER TABLE IF EXISTS public.foundation_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "foundation_ledger_service_role_all" ON public.foundation_ledger;
CREATE POLICY "foundation_ledger_service_role_all"
ON public.foundation_ledger
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
REVOKE ALL ON TABLE public.foundation_ledger FROM anon, authenticated;
GRANT ALL ON TABLE public.foundation_ledger TO service_role;

-- soul_paths: (depends on how you use it)
-- If users should read their computed soul_path via app features,
-- you should expose it through a controlled RPC/view instead of raw table access.
-- For now: lock to service_role only (safe default).
ALTER TABLE IF EXISTS public.soul_paths ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "soul_paths_service_role_all" ON public.soul_paths;
CREATE POLICY "soul_paths_service_role_all"
ON public.soul_paths
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
REVOKE ALL ON TABLE public.soul_paths FROM anon, authenticated;
GRANT ALL ON TABLE public.soul_paths TO service_role;

-- social_summaries: service_role only
ALTER TABLE IF EXISTS public.social_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_summaries_service_role_all" ON public.social_summaries;
CREATE POLICY "social_summaries_service_role_all"
ON public.social_summaries
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
REVOKE ALL ON TABLE public.social_summaries FROM anon, authenticated;
GRANT ALL ON TABLE public.social_summaries TO service_role;

-- ============================
-- Finish the cleaning: gratitude_stats must be gone
-- ============================
DROP TABLE IF EXISTS public.gratitude_stats CASCADE;
