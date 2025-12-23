-- ============================================================================
-- DROP social_connections TABLE (ALREADY DONE IN PRODUCTION)
-- ============================================================================
-- This migration documents the manual drop performed on 2025-12-23.
-- The social_connections table was replaced by social_accounts.
-- Running this ensures new/dev databases don't recreate the dead table.
--
-- PRODUCTION STATUS: Table already dropped via Supabase SQL Editor.
-- PostgREST schema cache was reloaded.

-- Drop RLS policies first (if table still exists)
DROP POLICY IF EXISTS "Users can view their own social connections" ON public.social_connections;
DROP POLICY IF EXISTS "Users can insert their own social connections" ON public.social_connections;
DROP POLICY IF EXISTS "Users can update their own social connections" ON public.social_connections;
DROP POLICY IF EXISTS "Users can delete their own social connections" ON public.social_connections;

-- Drop indexes
DROP INDEX IF EXISTS idx_social_connections_user_provider;
DROP INDEX IF EXISTS idx_social_connections_token_expiry;

-- Drop the table
DROP TABLE IF EXISTS public.social_connections CASCADE;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running, confirm with:
-- SELECT to_regclass('public.social_connections'); -- Should return NULL
