-- Lock down sensitive tables (Solara PR2 prep)
-- Goal:
-- - Users can use app features
-- - Users CANNOT access raw social data/summaries, deletion requests, subscriptions,
--   or birth version history directly
-- - Public CAN read sign_daily (horoscope feed), but cannot write

-- NOTE:
-- Some tables may not exist in all environments (archived/dropped).
-- This migration uses guards so "supabase db reset" won't fail if a table is missing.

-- ------------------------------------------------------------
-- 1) SOCIAL SUMMARIES: service_role only
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.social_summaries') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.social_summaries ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own social summaries" ON public.social_summaries';
    EXECUTE 'DROP POLICY IF EXISTS "sa_service_role_all" ON public.social_summaries';
    EXECUTE 'DROP POLICY IF EXISTS "Service role can manage social summaries" ON public.social_summaries';

    EXECUTE $pol$
      CREATE POLICY "Service role can manage social summaries"
      ON public.social_summaries
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role')
    $pol$;

    EXECUTE 'REVOKE ALL ON TABLE public.social_summaries FROM anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.social_summaries TO service_role';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 2) SOCIAL ACCOUNTS / IDENTITIES: service_role only
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.social_accounts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "sa_service_role_all" ON public.social_accounts';

    EXECUTE $pol$
      CREATE POLICY "sa_service_role_all"
      ON public.social_accounts
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role')
    $pol$;

    EXECUTE 'REVOKE ALL ON TABLE public.social_accounts FROM anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.social_accounts TO service_role';
  END IF;

  IF to_regclass('public.social_identities') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.social_identities ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "social_identities_service_role_all" ON public.social_identities';

    EXECUTE $pol$
      CREATE POLICY "social_identities_service_role_all"
      ON public.social_identities
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role')
    $pol$;

    EXECUTE 'REVOKE ALL ON TABLE public.social_identities FROM anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.social_identities TO service_role';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 3) FACEBOOK DATA DELETION REQUESTS: service_role only
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.facebook_data_deletion_requests') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.facebook_data_deletion_requests ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Public read by confirmation_code" ON public.facebook_data_deletion_requests';
    EXECUTE 'DROP POLICY IF EXISTS "Users cannot write deletion_requests" ON public.facebook_data_deletion_requests';
    EXECUTE 'DROP POLICY IF EXISTS "Service role manages facebook deletion requests" ON public.facebook_data_deletion_requests';

    EXECUTE $pol$
      CREATE POLICY "Service role manages facebook deletion requests"
      ON public.facebook_data_deletion_requests
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role')
    $pol$;

    EXECUTE 'REVOKE ALL ON TABLE public.facebook_data_deletion_requests FROM anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.facebook_data_deletion_requests TO service_role';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 4) SIGN DAILY: public read ok, writes only service_role
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.sign_daily') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.sign_daily ENABLE ROW LEVEL SECURITY';

    EXECUTE 'REVOKE ALL ON TABLE public.sign_daily FROM anon, authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.sign_daily TO anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.sign_daily TO service_role';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 5) BIRTH DATA VERSIONS: service_role only
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.birth_data_versions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.birth_data_versions ENABLE ROW LEVEL SECURITY';

    EXECUTE 'REVOKE ALL ON TABLE public.birth_data_versions FROM anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.birth_data_versions TO service_role';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 6) SUBSCRIPTIONS: service_role only
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY';

    EXECUTE 'REVOKE ALL ON TABLE public.subscriptions FROM anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.subscriptions TO service_role';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 7) GRATITUDE STATS: removed/guarded
-- ------------------------------------------------------------
-- gratitude_stats was dropped earlier in your migrations.
-- If it ever comes back, lock it down here safely.
DO $$
BEGIN
  IF to_regclass('public.gratitude_stats') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.gratitude_stats ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.gratitude_stats FROM anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.gratitude_stats TO service_role';
  END IF;
END
$$;