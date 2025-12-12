-- ============================================================================
-- CREATE SOUL PATHS TABLE
-- ============================================================================
-- Migration: 002
-- Purpose: Create dedicated table for Soul Path data files (birth chart
--          placements, aspects, derived features, calculated features)
--
-- This decouples Soul Path storage from the profiles table for scalability
-- at 1M DAU. Each user has exactly ONE Soul Path record (no history tracking).
--
-- SECURITY MODEL:
-- - Soul Paths are NOT directly accessible from browser/client code
-- - RLS is enabled but has NO policies for authenticated users
-- - All access goes through server-side API routes (using service role key)
-- - This prevents direct querying of Soul Path data from client
--
-- Design:
-- - One record per user (user_id is PRIMARY KEY)
-- - Schema versioning for automatic cache invalidation
-- - Birth input hash for detecting when birth data changes
-- - Full Soul Path data stored in JSONB
--
-- Run this SQL in your Supabase SQL Editor.
-- ============================================================================

-- Create the soul_paths table
CREATE TABLE IF NOT EXISTS public.soul_paths (
  -- Primary key: one Soul Path per user
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Schema version for cache invalidation
  -- When SOUL_PATH_SCHEMA_VERSION bumps in code, old caches are invalidated
  schema_version INTEGER NOT NULL,

  -- Timestamp of last computation
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Hash of birth input data (birth_date + birth_time + lat + lon + timezone)
  -- Used to detect when birth data changes without comparing profile.updated_at
  -- This allows precise invalidation (ignores changes to name, email, etc.)
  birth_input_hash TEXT NOT NULL,

  -- The complete Soul Path data file
  -- Contains: planets, houses, angles, aspects, derived, calculated
  -- (SwissPlacements type from lib/ephemeris/swissEngine.ts)
  soul_path_json JSONB NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary key index on user_id is created automatically

-- Optional: Index on schema_version for auditing/monitoring
-- Useful for queries like "how many users have outdated Soul Paths?"
CREATE INDEX IF NOT EXISTS idx_soul_paths_schema_version
  ON public.soul_paths(schema_version);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on the table
ALTER TABLE public.soul_paths ENABLE ROW LEVEL SECURITY;

-- IMPORTANT: NO policies for authenticated users
-- This means users CANNOT directly query soul_paths from browser/client code
-- All access must go through server-side API routes using service role key
-- (Service role key bypasses RLS in Supabase)

-- This prevents:
-- - Direct SELECT queries from browser (e.g., supabase.from('soul_paths').select('*'))
-- - Unauthorized access to Soul Path data
-- - Bypassing API logic/validation

-- Note: If you need to query soul_paths in Supabase Studio or psql,
-- use the service role key or postgres role (which bypass RLS)

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.soul_paths IS
  'Canonical Soul Path data files for users. One record per user containing complete astrological placements (planets, houses, angles, aspects, derived features, calculated features). Computed once and cached with schema versioning for automatic invalidation. NOT directly accessible from browser - access only via server-side API routes.';

COMMENT ON COLUMN public.soul_paths.user_id IS
  'Foreign key to auth.users. Primary key ensures one Soul Path per user.';

COMMENT ON COLUMN public.soul_paths.schema_version IS
  'Schema version at time of computation. Matches SOUL_PATH_SCHEMA_VERSION in lib/soulMap/storage.ts (or lib/birthChart/storage.ts). Used for automatic cache invalidation when Soul Path structure changes.';

COMMENT ON COLUMN public.soul_paths.computed_at IS
  'Timestamp when this Soul Path was last computed. Updated on regeneration.';

COMMENT ON COLUMN public.soul_paths.birth_input_hash IS
  'SHA-256 hash of birth input data: birth_date || birth_time || birth_lat || birth_lon || timezone. Used to detect when birth data changes, triggering recomputation. More precise than comparing profile.updated_at (which changes on any profile update).';

COMMENT ON COLUMN public.soul_paths.soul_path_json IS
  'Complete Soul Path data file (SwissPlacements type). Contains: system, planets (with longitude/retrograde), houses (with cuspLongitude), angles (with longitude), aspects, derived summary (element/modality balance, dominant signs/planets, chart ruler), calculated features (South Node, Part of Fortune, chart type, stelliums, patterns). Approximately 15-25KB per user.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'soul_paths'
ORDER BY ordinal_position;

-- Verify indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'soul_paths'
  AND schemaname = 'public';

-- Verify RLS is enabled
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'soul_paths'
  AND schemaname = 'public';

-- Verify NO policies exist (should return 0 rows)
-- This confirms that authenticated users CANNOT access the table
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'soul_paths'
  AND schemaname = 'public';
