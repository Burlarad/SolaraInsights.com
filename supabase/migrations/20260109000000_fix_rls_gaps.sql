-- Fix RLS policy gaps + lock down sensitive tables (PR3)
-- Goals:
-- - Users can read their own soul_paths (read-only)
-- - social_* tables remain service_role only
-- - ai_usage_events, foundation_ledger, birth_data_versions are service_role only
-- - facebook_data_deletion_requests is service_role only (no public reads)

-- -----------------------------
-- SOUL PATHS: user can SELECT own; writes service_role only
-- -----------------------------
ALTER TABLE IF EXISTS public.soul_paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "soul_paths_select_own" ON public.soul_paths;
DROP POLICY IF EXISTS "soul_paths_service_role_all" ON public.soul_paths;

CREATE POLICY "soul_paths_select_own"
ON public.soul_paths
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "soul_paths_service_role_all"
ON public.soul_paths
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.soul_paths FROM anon, authenticated;
GRANT SELECT ON TABLE public.soul_paths TO authenticated;
GRANT ALL ON TABLE public.soul_paths TO service_role;


-- -----------------------------
-- AI USAGE EVENTS: service_role only
-- -----------------------------
ALTER TABLE IF EXISTS public.ai_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_events_service_role_all" ON public.ai_usage_events;

CREATE POLICY "ai_usage_events_service_role_all"
ON public.ai_usage_events
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.ai_usage_events FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_usage_events TO service_role;


-- -----------------------------
-- FOUNDATION LEDGER: service_role only (fix broken USING(false) policy)
-- -----------------------------
ALTER TABLE IF EXISTS public.foundation_ledger ENABLE ROW LEVEL SECURITY;

-- Drop any known/unknown policies that could block access
DROP POLICY IF EXISTS "foundation_ledger_deny_all" ON public.foundation_ledger;
DROP POLICY IF EXISTS "foundation_ledger_select_own" ON public.foundation_ledger;
DROP POLICY IF EXISTS "foundation_ledger_service_role_all" ON public.foundation_ledger;

CREATE POLICY "foundation_ledger_service_role_all"
ON public.foundation_ledger
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.foundation_ledger FROM anon, authenticated;
GRANT ALL ON TABLE public.foundation_ledger TO service_role;


-- -----------------------------
-- FACEBOOK DATA DELETION REQUESTS: service_role only (no public read)
-- -----------------------------
ALTER TABLE IF EXISTS public.facebook_data_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read by confirmation_code" ON public.facebook_data_deletion_requests;
DROP POLICY IF EXISTS "Users cannot write deletion_requests" ON public.facebook_data_deletion_requests;
DROP POLICY IF EXISTS "Service role manages facebook deletion requests" ON public.facebook_data_deletion_requests;
DROP POLICY IF EXISTS "facebook_data_deletion_requests_service_role_all" ON public.facebook_data_deletion_requests;

CREATE POLICY "facebook_data_deletion_requests_service_role_all"
ON public.facebook_data_deletion_requests
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.facebook_data_deletion_requests FROM anon, authenticated;
GRANT ALL ON TABLE public.facebook_data_deletion_requests TO service_role;


-- -----------------------------
-- SOCIAL SUMMARIES: enforce service_role only (drop any user select policy)
-- -----------------------------
ALTER TABLE IF EXISTS public.social_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own social summaries" ON public.social_summaries;
DROP POLICY IF EXISTS "sa_service_role_all" ON public.social_summaries;
DROP POLICY IF EXISTS "Service role can manage social summaries" ON public.social_summaries;
DROP POLICY IF EXISTS "social_summaries_service_role_all" ON public.social_summaries;

CREATE POLICY "social_summaries_service_role_all"
ON public.social_summaries
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.social_summaries FROM anon, authenticated;
GRANT ALL ON TABLE public.social_summaries TO service_role;


-- -----------------------------
-- BIRTH DATA VERSIONS: service_role only (resolve migration conflict)
-- -----------------------------
ALTER TABLE IF EXISTS public.birth_data_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "birth_data_versions_select_own" ON public.birth_data_versions;
DROP POLICY IF EXISTS "birth_data_versions_insert_own" ON public.birth_data_versions;
DROP POLICY IF EXISTS "birth_data_versions_update_own" ON public.birth_data_versions;
DROP POLICY IF EXISTS "birth_data_versions_delete_own" ON public.birth_data_versions;
DROP POLICY IF EXISTS "birth_data_versions_service_role_all" ON public.birth_data_versions;

CREATE POLICY "birth_data_versions_service_role_all"
ON public.birth_data_versions
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.birth_data_versions FROM anon, authenticated;
GRANT ALL ON TABLE public.birth_data_versions TO service_role;
