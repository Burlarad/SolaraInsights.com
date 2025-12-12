-- ============================================================================
-- BACKFILL SOUL PATHS FROM PROFILES
-- ============================================================================
-- Migration: 003
-- Purpose: Migrate existing birth chart data from profiles.birth_chart_placements_json
--          to the new soul_paths table
--
-- This script:
-- 1. Enables pgcrypto extension for SHA-256 hashing
-- 2. Reads all profiles with cached birth chart data
-- 3. Extracts schema version from JSONB
-- 4. Computes birth input hash from birth data fields
-- 5. Inserts/updates soul_paths table with upsert logic
-- 6. Verifies migration success
--
-- SECURITY NOTE:
-- This migration runs server-side (Supabase SQL Editor or service role)
-- The soul_paths table has RLS enabled but NO user policies,
-- so only server-side code can access it (this script bypasses RLS)
--
-- Run this SQL in your Supabase SQL Editor AFTER running 002_create_soul_paths_table.sql
-- ============================================================================

-- ============================================================================
-- STEP 1: ENABLE PGCRYPTO EXTENSION
-- ============================================================================

-- Enable pgcrypto for digest() and encode() functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- STEP 2: BACKFILL SOUL PATHS
-- ============================================================================

INSERT INTO public.soul_paths (
  user_id,
  schema_version,
  computed_at,
  birth_input_hash,
  soul_path_json
)
SELECT
  -- user_id: profile ID
  p.id AS user_id,

  -- schema_version: extract from JSONB, default to 0 if missing
  COALESCE(
    (p.birth_chart_placements_json->>'schemaVersion')::INTEGER,
    0
  ) AS schema_version,

  -- computed_at: use existing timestamp, or NOW() if missing
  COALESCE(
    p.birth_chart_computed_at,
    NOW()
  ) AS computed_at,

  -- birth_input_hash: SHA-256 hash of birth input fields
  -- Concatenate: birth_date || birth_time || birth_lat || birth_lon || timezone
  -- Convert nulls to empty strings for consistent hashing
  encode(
    digest(
      COALESCE(p.birth_date, '') ||
      COALESCE(p.birth_time, '') ||
      COALESCE(p.birth_lat::TEXT, '') ||
      COALESCE(p.birth_lon::TEXT, '') ||
      COALESCE(p.timezone, ''),
      'sha256'
    ),
    'hex'
  ) AS birth_input_hash,

  -- soul_path_json: remove schemaVersion from JSONB (now stored in column)
  -- The '-' operator removes a key from JSONB
  (p.birth_chart_placements_json - 'schemaVersion') AS soul_path_json

FROM public.profiles p
WHERE
  -- Only migrate profiles that have cached birth chart data
  p.birth_chart_placements_json IS NOT NULL
  AND p.birth_chart_computed_at IS NOT NULL

-- Upsert logic: if user_id already exists, update all fields
ON CONFLICT (user_id) DO UPDATE SET
  schema_version = EXCLUDED.schema_version,
  computed_at = EXCLUDED.computed_at,
  birth_input_hash = EXCLUDED.birth_input_hash,
  soul_path_json = EXCLUDED.soul_path_json;

-- ============================================================================
-- STEP 3: VERIFICATION QUERIES
-- ============================================================================

-- Count total rows migrated
SELECT
  COUNT(*) AS total_soul_paths_migrated
FROM public.soul_paths;

-- Count by schema version
SELECT
  schema_version,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM public.soul_paths
GROUP BY schema_version
ORDER BY schema_version DESC;

-- Compare counts: profiles with birth charts vs soul_paths
SELECT
  (SELECT COUNT(*) FROM public.profiles WHERE birth_chart_placements_json IS NOT NULL) AS profiles_with_charts,
  (SELECT COUNT(*) FROM public.soul_paths) AS soul_paths_migrated,
  (SELECT COUNT(*) FROM public.profiles WHERE birth_chart_placements_json IS NOT NULL) -
  (SELECT COUNT(*) FROM public.soul_paths) AS difference;

-- Sample 5 migrated rows (verify data structure)
SELECT
  user_id,
  schema_version,
  computed_at,
  LEFT(birth_input_hash, 16) || '...' AS birth_input_hash_preview,
  jsonb_typeof(soul_path_json) AS json_type,
  soul_path_json->>'system' AS system,
  jsonb_array_length(soul_path_json->'planets') AS planet_count,
  jsonb_array_length(soul_path_json->'houses') AS house_count,
  (soul_path_json->'angles'->>'ascendant') IS NOT NULL AS has_ascendant,
  (soul_path_json->'aspects') IS NOT NULL AS has_aspects,
  (soul_path_json->'derived') IS NOT NULL AS has_derived,
  (soul_path_json->'calculated') IS NOT NULL AS has_calculated
FROM public.soul_paths
ORDER BY computed_at DESC
LIMIT 5;

-- Verify birth_input_hash consistency
-- (Check that no two users have same hash unless they truly have identical birth data)
SELECT
  birth_input_hash,
  COUNT(*) AS user_count,
  array_agg(user_id) AS user_ids
FROM public.soul_paths
GROUP BY birth_input_hash
HAVING COUNT(*) > 1
ORDER BY user_count DESC
LIMIT 10;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Success message
DO $$
DECLARE
  migrated_count INTEGER;
  profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM public.soul_paths;
  SELECT COUNT(*) INTO profile_count FROM public.profiles WHERE birth_chart_placements_json IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Soul Paths Migration Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Profiles with birth charts: %', profile_count;
  RAISE NOTICE 'Soul Paths migrated:        %', migrated_count;
  RAISE NOTICE 'Difference:                 %', profile_count - migrated_count;
  RAISE NOTICE '========================================';

  IF migrated_count = profile_count THEN
    RAISE NOTICE 'SUCCESS: All birth charts migrated to soul_paths table';
  ELSIF migrated_count > 0 THEN
    RAISE WARNING 'PARTIAL SUCCESS: Some birth charts migrated, but counts do not match';
  ELSE
    RAISE WARNING 'WARNING: No soul_paths created. Check if profiles have birth_chart_placements_json data';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'SECURITY REMINDER:';
  RAISE NOTICE 'The soul_paths table has RLS enabled with NO user policies.';
  RAISE NOTICE 'Users cannot directly query this table from browser/client code.';
  RAISE NOTICE 'All access must go through server-side API routes.';
  RAISE NOTICE '========================================';
END $$;
