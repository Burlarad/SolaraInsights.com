-- ============================================================================
-- LIBRARY BOOK MODEL MIGRATION
-- ============================================================================
-- Implements global library tables for charts and numerology profiles
-- with deterministic keys for deduplication.
--
-- Core Principles:
-- 1. Settings is source of truth for user's "official" chart/numerology
-- 2. Global library deduplicates computations by deterministic key
-- 3. Preview mode generates to global library without user persistence
-- 4. NO noon defaulting - incomplete inputs = no official chart
--
-- Date: 2026-01-25
-- ============================================================================

-- ============================================================================
-- 1. GLOBAL CHARTS LIBRARY
-- ============================================================================
-- Stores all computed birth charts, deduplicated by chart_key
-- Multiple users with same birth inputs share the same chart record

CREATE TABLE IF NOT EXISTS public.charts (
  -- Deterministic key: hash(birth_date, birth_time, birth_lat, birth_lon, timezone, engine_config)
  chart_key TEXT PRIMARY KEY,

  -- Normalized input data (for reference and debugging)
  input_json JSONB NOT NULL,

  -- Computed astrological geometry (SwissPlacements)
  geometry_json JSONB NOT NULL,

  -- Engine configuration version (house system, zodiac mode, schema version)
  engine_config JSONB NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INTEGER NOT NULL DEFAULT 1
);

-- Ensure required metadata columns exist even if table pre-existed
ALTER TABLE public.charts
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS access_count INTEGER NOT NULL DEFAULT 1;

-- Index for access pattern monitoring
CREATE INDEX IF NOT EXISTS idx_charts_last_accessed
  ON public.charts(last_accessed_at DESC);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_charts_created_at
  ON public.charts(created_at DESC);

COMMENT ON TABLE public.charts IS
  'Global library of computed birth charts. Deduplicated by deterministic chart_key. Shared across users.';

COMMENT ON COLUMN public.charts.chart_key IS
  'SHA-256 hash of normalized birth inputs + engine config. Ensures deterministic deduplication.';

COMMENT ON COLUMN public.charts.input_json IS
  'Normalized birth inputs: {birth_date, birth_time, birth_lat, birth_lon, timezone}. All fields MUST be non-null for houses.';

COMMENT ON COLUMN public.charts.geometry_json IS
  'SwissPlacements object: planets, houses, angles, aspects, derived, calculated. NO noon defaulting.';

COMMENT ON COLUMN public.charts.engine_config IS
  'Engine version info: {house_system: "placidus", zodiac: "tropical", schema_version: 8}. Allows cache invalidation.';

-- ============================================================================
-- 2. GLOBAL NUMEROLOGY LIBRARY
-- ============================================================================
-- Stores all computed numerology profiles, deduplicated by numerology_key

CREATE TABLE IF NOT EXISTS public.numerology_library (
  -- Deterministic key: hash(first_name, middle_name, last_name, birth_date, algorithm_version)
  numerology_key TEXT PRIMARY KEY,

  -- Normalized input data
  input_json JSONB NOT NULL,

  -- Computed numerology data
  numerology_json JSONB NOT NULL,

  -- Algorithm configuration version
  config_version INTEGER NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INTEGER NOT NULL DEFAULT 1
);

-- Ensure required metadata columns exist even if table pre-existed
ALTER TABLE public.numerology_library
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS access_count INTEGER NOT NULL DEFAULT 1;

-- Index for access pattern monitoring
CREATE INDEX IF NOT EXISTS idx_numerology_last_accessed
  ON public.numerology_library(last_accessed_at DESC);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_numerology_created_at
  ON public.numerology_library(created_at DESC);

COMMENT ON TABLE public.numerology_library IS
  'Global library of computed numerology profiles. Deduplicated by deterministic numerology_key. Shared across users.';

COMMENT ON COLUMN public.numerology_library.numerology_key IS
  'SHA-256 hash of normalized name + birth_date + config version. Ensures deterministic deduplication.';

-- ============================================================================
-- 3. ADD OFFICIAL KEYS TO PROFILES
-- ============================================================================
-- Links users to their "official" chart/numerology from Settings

DO $$
BEGIN
  -- Add official_chart_key column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'official_chart_key'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN official_chart_key TEXT;
  END IF;

  -- Add official_numerology_key column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'official_numerology_key'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN official_numerology_key TEXT;
  END IF;
END $$;

-- Foreign key constraints (soft - allows orphaned keys during transitions)
-- We don't enforce FK because:
-- 1. User may have official_*_key set but library entry deleted (cleanup)
-- 2. We want to be able to drop library entries without cascade deletes

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_profiles_official_chart_key
  ON public.profiles(official_chart_key) WHERE official_chart_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_official_numerology_key
  ON public.profiles(official_numerology_key) WHERE official_numerology_key IS NOT NULL;

COMMENT ON COLUMN public.profiles.official_chart_key IS
  'Reference to users official chart in global library. Only set when Settings has complete birth data. NULL = no official chart.';

COMMENT ON COLUMN public.profiles.official_numerology_key IS
  'Reference to users official numerology profile in global library. Only set when Settings has complete name data.';

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- Charts table: Read-only for authenticated users (global library)
ALTER TABLE public.charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read charts"
  ON public.charts FOR SELECT
  TO authenticated
  USING (true);

-- Only backend can write (via service role)
CREATE POLICY "Service role can write charts"
  ON public.charts FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update charts"
  ON public.charts FOR UPDATE
  TO service_role
  USING (true);

-- Numerology table: Same pattern
ALTER TABLE public.numerology_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read numerology"
  ON public.numerology_library FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can write numerology"
  ON public.numerology_library FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update numerology"
  ON public.numerology_library FOR UPDATE
  TO service_role
  USING (true);

-- ============================================================================
-- 5. UPDATE ACCESS TRACKING FUNCTION
-- ============================================================================
-- Automatically update last_accessed_at and increment access_count

CREATE OR REPLACE FUNCTION update_chart_access()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.charts
  SET
    last_accessed_at = NOW(),
    access_count = access_count + 1
  WHERE chart_key = NEW.chart_key;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_numerology_access()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.numerology_library
  SET
    last_accessed_at = NOW(),
    access_count = access_count + 1
  WHERE numerology_key = NEW.numerology_key;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: These triggers would fire on INSERT, but we'll handle access tracking
-- in the application layer for better control

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
--
-- Check new tables exist:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('charts', 'numerology_library');
--
-- Check profiles columns added:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'profiles'
-- AND column_name IN ('official_chart_key', 'official_numerology_key');
--
-- Check RLS enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE tablename IN ('charts', 'numerology_library');
