-- ============================================================================
-- UNIFIED LIBRARY SYSTEM MIGRATION
-- ============================================================================
-- This migration unifies the astrology and numerology systems into a
-- cohesive "Library of Solara" architecture.
--
-- Key Changes:
-- 1. Rename charts → astrology_library (symmetry with numerology_library)
-- 2. Add AI narrative columns to numerology_library
-- 3. Add name_changed_since_birth flag to profiles
-- 4. Drop soul_paths table (deprecated, replaced by library system)
-- 5. Clean up deprecated columns in profiles
--
-- Date: 2026-02-09
-- Author: Claude Code + Aaron Burlar
-- ============================================================================

-- ============================================================================
-- PART 1: RENAME CHARTS → ASTROLOGY_LIBRARY
-- ============================================================================

-- Check if charts exists first (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'charts'
  ) THEN
    -- Rename the table
    ALTER TABLE public.charts RENAME TO astrology_library;

    -- Rename the primary key constraint
    ALTER TABLE public.astrology_library
      RENAME CONSTRAINT charts_pkey TO astrology_library_pkey;

    -- Rename indexes
    ALTER INDEX IF EXISTS idx_charts_last_accessed
      RENAME TO idx_astrology_library_last_accessed;

    ALTER INDEX IF EXISTS idx_charts_created_at
      RENAME TO idx_astrology_library_created_at;

    ALTER INDEX IF EXISTS idx_charts_missing_narrative
      RENAME TO idx_astrology_library_missing_narrative;

    ALTER INDEX IF EXISTS idx_charts_narrative_version
      RENAME TO idx_astrology_library_narrative_version;

    -- Update table comment
    COMMENT ON TABLE public.astrology_library IS
      'Global library of computed birth charts with AI narratives. Deduplicated by deterministic chart_key. Book = Math (geometry_json) + Narrative (narrative_json) stored together. Part of the unified Library of Solara.';

    RAISE NOTICE 'Renamed charts → astrology_library';
  ELSE
    RAISE NOTICE 'Table charts does not exist, skipping rename';
  END IF;
END $$;

-- ============================================================================
-- PART 2: UPDATE PROFILES - RENAME OFFICIAL_CHART_KEY → OFFICIAL_ASTROLOGY_KEY
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'official_chart_key'
  ) THEN
    ALTER TABLE public.profiles
      RENAME COLUMN official_chart_key TO official_astrology_key;

    -- Rename the index
    ALTER INDEX IF EXISTS idx_profiles_official_chart_key
      RENAME TO idx_profiles_official_astrology_key;

    -- Update column comment
    COMMENT ON COLUMN public.profiles.official_astrology_key IS
      'Reference to users official astrology chart in global library. Only set when Settings has complete birth data. NULL = no official chart.';

    RAISE NOTICE 'Renamed official_chart_key → official_astrology_key in profiles';
  ELSE
    RAISE NOTICE 'Column official_chart_key does not exist, skipping rename';
  END IF;
END $$;

-- ============================================================================
-- PART 3: ADD AI NARRATIVE COLUMNS TO NUMEROLOGY_LIBRARY
-- ============================================================================

-- Add narrative columns to numerology_library (matching astrology_library)
ALTER TABLE public.numerology_library
  ADD COLUMN IF NOT EXISTS narrative_json JSONB,
  ADD COLUMN IF NOT EXISTS narrative_prompt_version INTEGER,
  ADD COLUMN IF NOT EXISTS narrative_language TEXT,
  ADD COLUMN IF NOT EXISTS narrative_generated_at TIMESTAMPTZ;

-- Add system column to track Pythagorean vs Chaldean
ALTER TABLE public.numerology_library
  ADD COLUMN IF NOT EXISTS system TEXT NOT NULL DEFAULT 'pythagorean';

-- Create composite unique constraint: key must include system
-- (same birth data with different systems = different books)
CREATE UNIQUE INDEX IF NOT EXISTS idx_numerology_library_key_system
  ON public.numerology_library(numerology_key, system);

-- Partial index for missing narratives
CREATE INDEX IF NOT EXISTS idx_numerology_library_missing_narrative
  ON public.numerology_library(numerology_key)
  WHERE narrative_json IS NULL;

-- Index for prompt version cache invalidation
CREATE INDEX IF NOT EXISTS idx_numerology_library_narrative_version
  ON public.numerology_library(narrative_prompt_version)
  WHERE narrative_json IS NOT NULL;

-- Update table comment
COMMENT ON TABLE public.numerology_library IS
  'Global library of computed numerology profiles with AI narratives. Deduplicated by deterministic numerology_key + system. Book = Math (numerology_json) + Narrative (narrative_json) stored together. Part of the unified Library of Solara.';

COMMENT ON COLUMN public.numerology_library.narrative_json IS
  'AI-generated numerology soul story. NULL if not yet generated. Cached once generated.';

COMMENT ON COLUMN public.numerology_library.narrative_prompt_version IS
  'Version of the prompt used to generate narrative. Used for cache invalidation when prompts change.';

COMMENT ON COLUMN public.numerology_library.narrative_language IS
  'Language code for narrative (e.g., "en", "es"). Allows multi-language support.';

COMMENT ON COLUMN public.numerology_library.narrative_generated_at IS
  'Timestamp when narrative was generated. NULL if not yet generated.';

COMMENT ON COLUMN public.numerology_library.system IS
  'Numerology system used: "pythagorean" or "chaldean". Part of the deterministic key.';

-- ============================================================================
-- PART 4: ADD NAME_CHANGED_SINCE_BIRTH FLAG TO PROFILES
-- ============================================================================

-- Add flag to indicate if user changed their name
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name_changed_since_birth BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.name_changed_since_birth IS
  'Indicates if user has changed their name since birth (marriage, legal change, etc.). If true, preferred_name should be set to current name, while first_name/middle_name/last_name remain as BIRTH names for numerology calculations.';

COMMENT ON COLUMN public.profiles.first_name IS
  'Birth first name (legal first name at birth). Used for numerology calculations. If name_changed_since_birth is false, this is also the current first name.';

COMMENT ON COLUMN public.profiles.middle_name IS
  'Birth middle name (legal middle name at birth). Used for numerology calculations. Can be NULL if no middle name.';

COMMENT ON COLUMN public.profiles.last_name IS
  'Birth last name (legal last name at birth). Used for numerology calculations. If name_changed_since_birth is false, this is also the current last name.';

COMMENT ON COLUMN public.profiles.preferred_name IS
  'Current display name if different from birth name. Used for greetings and UI. If NULL, use first_name for display. Set this when name_changed_since_birth is true.';

-- ============================================================================
-- PART 5: DROP SOUL_PATHS TABLE (DEPRECATED)
-- ============================================================================

-- Drop soul_paths table if it exists (replaced by astrology_library)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'soul_paths'
  ) THEN
    -- Drop all policies first
    DROP POLICY IF EXISTS "soul_paths_select_own" ON public.soul_paths;
    DROP POLICY IF EXISTS "soul_paths_insert_own" ON public.soul_paths;
    DROP POLICY IF EXISTS "soul_paths_update_own" ON public.soul_paths;
    DROP POLICY IF EXISTS "soul_paths_delete_own" ON public.soul_paths;
    DROP POLICY IF EXISTS "soul_paths_service_role_all" ON public.soul_paths;

    -- Drop the table
    DROP TABLE public.soul_paths;

    RAISE NOTICE 'Dropped soul_paths table (deprecated)';
  ELSE
    RAISE NOTICE 'Table soul_paths does not exist, skipping drop';
  END IF;
END $$;

-- ============================================================================
-- PART 6: CLEAN UP DEPRECATED COLUMNS IN PROFILES
-- ============================================================================

-- Remove columns that are no longer used
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS birth_chart_placements_json,
  DROP COLUMN IF EXISTS birth_chart_computed_at,
  DROP COLUMN IF EXISTS current_birth_version_id,
  DROP COLUMN IF EXISTS sign; -- Duplicate of zodiac_sign

-- ============================================================================
-- PART 7: UPDATE RLS POLICIES
-- ============================================================================

-- RLS policies for astrology_library (renamed from charts)
-- Note: Policies are automatically transferred during ALTER TABLE RENAME

-- Verify and recreate if needed
DO $$
BEGIN
  -- Drop old policy names if they still exist
  DROP POLICY IF EXISTS "Anyone can read charts" ON public.astrology_library;
  DROP POLICY IF EXISTS "Service role can write charts" ON public.astrology_library;
  DROP POLICY IF EXISTS "Service role can update charts" ON public.astrology_library;

  -- Create new policies with updated names
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'astrology_library'
    AND policyname = 'Anyone can read astrology_library'
  ) THEN
    CREATE POLICY "Anyone can read astrology_library"
      ON public.astrology_library FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'astrology_library'
    AND policyname = 'Service role can write astrology_library'
  ) THEN
    CREATE POLICY "Service role can write astrology_library"
      ON public.astrology_library FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'astrology_library'
    AND policyname = 'Service role can update astrology_library'
  ) THEN
    CREATE POLICY "Service role can update astrology_library"
      ON public.astrology_library FOR UPDATE
      TO service_role
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- PART 8: VERIFICATION QUERIES
-- ============================================================================

-- Uncomment these queries to verify the migration:

-- Check astrology_library exists:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'astrology_library';

-- Check numerology_library has narrative columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'numerology_library'
-- AND column_name LIKE 'narrative%';

-- Check profiles has name_changed_since_birth:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'profiles'
-- AND column_name = 'name_changed_since_birth';

-- Check soul_paths is dropped:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'soul_paths';
-- (Should return 0 rows)

-- Check deprecated columns are removed:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'profiles'
-- AND column_name IN ('birth_chart_placements_json', 'birth_chart_computed_at', 'current_birth_version_id', 'sign');
-- (Should return 0 rows)

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary of changes:
-- ✅ Renamed charts → astrology_library
-- ✅ Renamed official_chart_key → official_astrology_key
-- ✅ Added AI narrative columns to numerology_library
-- ✅ Added system column to numerology_library
-- ✅ Added name_changed_since_birth flag to profiles
-- ✅ Dropped soul_paths table (deprecated)
-- ✅ Cleaned up deprecated profiles columns
-- ✅ Updated RLS policies
--
-- Next steps (code changes):
-- 1. Update all code references from "charts" → "astrology_library"
-- 2. Update all code references from "official_chart_key" → "official_astrology_key"
-- 3. Delete lib/soulPath/ directory
-- 4. Delete app/api/birth-chart/route.ts
-- 5. Build book checkout system
-- 6. Add numerology AI narrative generation
-- ============================================================================
