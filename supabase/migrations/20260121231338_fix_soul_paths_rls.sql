

-- Migration: Fix RLS for soul_paths (launch blocker)
-- Date: 2026-01-21
-- Goal:
-- - Keep service_role full access
-- - Allow authenticated users to SELECT/INSERT/UPDATE only their own rows
-- - Keep DELETE disabled by default

BEGIN;

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.soul_paths
  ENABLE ROW LEVEL SECURITY;

-- ---
-- Policies
-- ---

-- service_role: full access
DROP POLICY IF EXISTS "soul_paths_service_role_all" ON public.soul_paths;
CREATE POLICY "soul_paths_service_role_all"
  ON public.soul_paths
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- authenticated: read own rows
DROP POLICY IF EXISTS "soul_paths_authenticated_select_own" ON public.soul_paths;
CREATE POLICY "soul_paths_authenticated_select_own"
  ON public.soul_paths
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- authenticated: insert own rows
DROP POLICY IF EXISTS "soul_paths_authenticated_insert_own" ON public.soul_paths;
CREATE POLICY "soul_paths_authenticated_insert_own"
  ON public.soul_paths
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- authenticated: update own rows
DROP POLICY IF EXISTS "soul_paths_authenticated_update_own" ON public.soul_paths;
CREATE POLICY "soul_paths_authenticated_update_own"
  ON public.soul_paths
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- NOTE: No DELETE policy for authenticated by design.

-- ---
-- Privileges
-- ---

REVOKE ALL ON TABLE public.soul_paths FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.soul_paths TO authenticated;
GRANT ALL ON TABLE public.soul_paths TO service_role;

COMMIT;