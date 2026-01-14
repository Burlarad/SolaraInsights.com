-- Migration: Revoke all Supabase Storage schema privileges from public roles
-- Purpose: Solara does not use Supabase Storage today. This hardens the DB by
-- removing unnecessary privileges from `anon` + `authenticated` while keeping
-- the Storage schema available for potential future use.

begin;

-- Remove schema access
revoke all on schema storage from anon, authenticated;

-- Remove access to existing objects
revoke all privileges on all tables in schema storage from anon, authenticated;
revoke all privileges on all sequences in schema storage from anon, authenticated;
revoke all privileges on all functions in schema storage from anon, authenticated;

-- Prevent future grants via default privileges (best-effort).
-- NOTE: On local dev, the role running migrations may not have permission to alter
-- default privileges for `postgres` / `supabase_admin`. We swallow that error so
-- the migration can still succeed.
do $$
begin
  -- postgres always exists in Supabase projects
  begin
    execute 'alter default privileges for role postgres in schema storage revoke all on tables from anon, authenticated';
    execute 'alter default privileges for role postgres in schema storage revoke all on sequences from anon, authenticated';
    execute 'alter default privileges for role postgres in schema storage revoke all on functions from anon, authenticated';
  exception when insufficient_privilege then
    raise notice 'Skipping alter default privileges for role postgres (insufficient_privilege).';
  end;

  -- supabase_admin exists in Supabase-managed Postgres; guard just in case
  if exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    begin
      execute 'alter default privileges for role supabase_admin in schema storage revoke all on tables from anon, authenticated';
      execute 'alter default privileges for role supabase_admin in schema storage revoke all on sequences from anon, authenticated';
      execute 'alter default privileges for role supabase_admin in schema storage revoke all on functions from anon, authenticated';
    exception when insufficient_privilege then
      raise notice 'Skipping alter default privileges for role supabase_admin (insufficient_privilege).';
    end;
  end if;
end
$$;

commit;