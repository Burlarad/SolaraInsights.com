-- Revoke default privileges for anon/authenticated in public + archive
-- so new tables/functions/sequences don't silently become accessible.
-- Then grant defaults to service_role only.
--
-- NOTE: `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ...` requires the
-- migration runner user to be `supabase_admin` or a member of that role.
-- In some environments (local/prod), migrations run as `postgres` without that membership.
-- We therefore apply supabase_admin default-privilege hardening only when allowed.

BEGIN;

-- =========================
-- public schema
-- =========================

-- Objects created by postgres in public
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- Ensure service_role retains expected access for future objects (belt + suspenders)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO service_role;

-- Objects created by supabase_admin in public (best-effort)
DO $$
BEGIN
  IF current_user = 'supabase_admin'
     OR pg_has_role(current_user, 'supabase_admin', 'member')
  THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
      REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
      REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
      REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
      GRANT ALL ON TABLES TO service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
      GRANT ALL ON SEQUENCES TO service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
      GRANT ALL ON FUNCTIONS TO service_role;
  ELSE
    RAISE NOTICE 'Skipping supabase_admin default-privilege hardening for public schema (not running as or member of supabase_admin).';
  END IF;
END $$;

-- =========================
-- archive schema
-- =========================
-- Same policy: archive is not user-facing, so no default access for anon/authenticated.

-- Objects created by postgres in archive
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA archive
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA archive
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA archive
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA archive
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA archive
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA archive
  GRANT ALL ON FUNCTIONS TO service_role;

-- Objects created by supabase_admin in archive (best-effort)
DO $$
BEGIN
  IF current_user = 'supabase_admin'
     OR pg_has_role(current_user, 'supabase_admin', 'member')
  THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA archive
      REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA archive
      REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA archive
      REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA archive
      GRANT ALL ON TABLES TO service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA archive
      GRANT ALL ON SEQUENCES TO service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA archive
      GRANT ALL ON FUNCTIONS TO service_role;
  ELSE
    RAISE NOTICE 'Skipping supabase_admin default-privilege hardening for archive schema (not running as or member of supabase_admin).';
  END IF;
END $$;

COMMIT;
