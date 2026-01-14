-- Migration: remove dangerous grants from anon/authenticated (v2)
-- Goal:
-- 1) Remove DDL-adjacent privileges (TRIGGER/TRUNCATE/REFERENCES) from anon/authenticated everywhere
-- 2) Hard-lock archive schema (no client access)
-- 3) Belt-and-suspenders lock for known sensitive tables (service_role only)
-- 4) Make intent explicit for public content tables (sign_daily)

-- =============================
-- 1) Remove dangerous table privileges everywhere (public + archive)
-- =============================
-- Covers tables, partitioned tables, views, materialized views, and foreign tables.
REVOKE TRIGGER, TRUNCATE, REFERENCES ON ALL TABLES IN SCHEMA public  FROM anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'archive') THEN
    EXECUTE 'REVOKE TRIGGER, TRUNCATE, REFERENCES ON ALL TABLES IN SCHEMA archive FROM anon, authenticated';
  END IF;
END $$;

-- Prevent future objects from inheriting these dangerous privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRIGGER, TRUNCATE, REFERENCES ON TABLES FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'archive') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA archive REVOKE TRIGGER, TRUNCATE, REFERENCES ON TABLES FROM anon, authenticated';
  END IF;
END $$;

-- =============================
-- 2) Archive schema must be backend-only
-- =============================
-- Even if anything accidentally has grants, wipe them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'archive') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA archive FROM anon, authenticated';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA archive FROM anon, authenticated';
  END IF;
END $$;

-- Prevent future grants in archive from leaking to client roles.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'archive') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA archive REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA archive REVOKE ALL ON SEQUENCES FROM anon, authenticated';
  END IF;
END $$;

-- =============================
-- 3) Belt-and-suspenders for known sensitive tables (service_role only)
-- =============================
DO $$
BEGIN
  -- social_summaries
  IF to_regclass('public.social_summaries') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.social_summaries FROM anon, authenticated;
    GRANT  ALL ON TABLE public.social_summaries TO service_role;
  END IF;

  -- social_accounts
  IF to_regclass('public.social_accounts') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.social_accounts FROM anon, authenticated;
    GRANT  ALL ON TABLE public.social_accounts TO service_role;
  END IF;

  -- social_identities
  IF to_regclass('public.social_identities') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.social_identities FROM anon, authenticated;
    GRANT  ALL ON TABLE public.social_identities TO service_role;
  END IF;

  -- social_posts
  IF to_regclass('public.social_posts') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.social_posts FROM anon, authenticated;
    GRANT  ALL ON TABLE public.social_posts TO service_role;
  END IF;

  -- social_profile_summaries
  IF to_regclass('public.social_profile_summaries') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.social_profile_summaries FROM anon, authenticated;
    GRANT  ALL ON TABLE public.social_profile_summaries TO service_role;
  END IF;

  -- facebook_data_deletion_requests
  IF to_regclass('public.facebook_data_deletion_requests') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.facebook_data_deletion_requests FROM anon, authenticated;
    GRANT  ALL ON TABLE public.facebook_data_deletion_requests TO service_role;
  END IF;

  -- subscriptions
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.subscriptions FROM anon, authenticated;
    GRANT  ALL ON TABLE public.subscriptions TO service_role;
  END IF;

  -- birth_data_versions
  IF to_regclass('public.birth_data_versions') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.birth_data_versions FROM anon, authenticated;
    GRANT  ALL ON TABLE public.birth_data_versions TO service_role;
  END IF;

  -- foundation_ledger
  IF to_regclass('public.foundation_ledger') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.foundation_ledger FROM anon, authenticated;
    GRANT  ALL ON TABLE public.foundation_ledger TO service_role;
  END IF;
END $$;

-- =============================
-- 4) Public content tables: make intent explicit
-- =============================
-- sign_daily: public read, backend writes.
DO $$
BEGIN
  IF to_regclass('public.sign_daily') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.sign_daily FROM anon, authenticated;
    GRANT SELECT ON TABLE public.sign_daily TO anon, authenticated;
    GRANT ALL   ON TABLE public.sign_daily TO service_role;
  END IF;
END $$;