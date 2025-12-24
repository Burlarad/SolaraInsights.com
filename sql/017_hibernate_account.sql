-- ============================================================================
-- HIBERNATE ACCOUNT MIGRATION
-- ============================================================================
-- Adds columns to support account hibernation (pause billing + lock access)
-- Run this migration in Supabase SQL Editor.

-- ============================================================================
-- 1. ADD HIBERNATE COLUMNS TO PROFILES
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_hibernated BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS hibernated_at TIMESTAMPTZ NULL;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ NULL;

-- ============================================================================
-- 2. CREATE INDEX FOR HIBERNATION QUERIES
-- ============================================================================
-- Useful for admin queries like "how many users are hibernated?"

CREATE INDEX IF NOT EXISTS idx_profiles_is_hibernated
  ON public.profiles(is_hibernated)
  WHERE is_hibernated = TRUE;

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
--
-- Check columns exist:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'profiles'
--   AND column_name IN ('is_hibernated', 'hibernated_at', 'reactivated_at')
-- ORDER BY column_name;
--
-- Check index exists:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'profiles' AND indexname = 'idx_profiles_is_hibernated';
--
