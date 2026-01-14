-- Revoke storage permissions from public roles (unused feature)
-- Goal: reduce attack surface. Solara currently does not use Supabase Storage.
-- Note: we are NOT dropping the storage schema; just removing public grants.

BEGIN;

-- Schema-level revoke
REVOKE ALL ON SCHEMA storage FROM anon, authenticated;

-- Object-level revokes (tables, sequences, functions)
REVOKE ALL ON ALL TABLES IN SCHEMA storage FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA storage FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA storage FROM anon, authenticated;

-- Also revoke future default privileges (so new storage objects don’t auto-grant later)
ALTER DEFAULT PRIVILEGES IN SCHEMA storage REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

COMMIT;
