-- ============================================================================
-- ADD BIRTH CHART CACHE COLUMNS TO PROFILES TABLE
-- ============================================================================
-- This migration adds caching columns for birth chart placements.
-- Birth charts are computed once and stored to avoid redundant Swiss Ephemeris
-- calculations on every request.
--
-- Run this SQL in your Supabase SQL Editor.
-- ============================================================================

-- Add JSONB column to store complete birth chart placements
-- (planets, houses, angles, aspects, etc.)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_chart_placements_json JSONB;

-- Add timestamp column to track when chart was last computed
-- Used for cache invalidation when birth data changes
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_chart_computed_at TIMESTAMPTZ;

-- Optional: Add index on computed_at for faster cache lookups
-- (Uncomment if needed for performance)
-- CREATE INDEX IF NOT EXISTS idx_profiles_birth_chart_computed_at
--   ON public.profiles(birth_chart_computed_at);

-- Optional: Add comment to document the columns
COMMENT ON COLUMN public.profiles.birth_chart_placements_json IS
  'Cached Swiss Ephemeris birth chart placements (planets, houses, angles, aspects)';

COMMENT ON COLUMN public.profiles.birth_chart_computed_at IS
  'Timestamp when birth chart was last computed. Used for cache invalidation.';
