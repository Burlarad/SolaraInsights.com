-- Recreate numerology_library table
--
-- Root cause: Created in 20260125000000_library_book_model.sql, then dropped by
-- 20260126030132_remote_schema.sql (auto-generated remote sync). All subsequent
-- migrations guarded with IF EXISTS and silently skipped.
--
-- This migration recreates the table with the full intended schema:
-- base columns (from 20260125) + narrative/system columns (from 20260209).

-- ============================================================================
-- 1. CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.numerology_library (
  -- Deterministic key: hash(first_name, middle_name, last_name, birth_date, config_version)
  numerology_key TEXT PRIMARY KEY,

  -- Normalized input data (name components + birth_date)
  input_json JSONB NOT NULL,

  -- Computed numerology data (core numbers, cycles, etc.)
  numerology_json JSONB NOT NULL,

  -- Algorithm configuration version
  config_version INTEGER NOT NULL,

  -- AI narrative (Book = Math + Narrative)
  narrative_json JSONB,
  narrative_prompt_version INTEGER,
  narrative_language TEXT,
  narrative_generated_at TIMESTAMPTZ,

  -- Numerology system: "pythagorean" or "chaldean"
  system TEXT NOT NULL DEFAULT 'pythagorean',

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INTEGER NOT NULL DEFAULT 1
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Composite unique: same birth data with different systems = different books
CREATE UNIQUE INDEX IF NOT EXISTS idx_numerology_library_key_system
  ON public.numerology_library(numerology_key, system);

-- Access pattern monitoring
CREATE INDEX IF NOT EXISTS idx_numerology_last_accessed
  ON public.numerology_library(last_accessed_at DESC);

-- Cleanup queries
CREATE INDEX IF NOT EXISTS idx_numerology_created_at
  ON public.numerology_library(created_at DESC);

-- Partial index for books missing narratives (prewarm targets)
CREATE INDEX IF NOT EXISTS idx_numerology_library_missing_narrative
  ON public.numerology_library(numerology_key)
  WHERE narrative_json IS NULL;

-- Prompt version for cache invalidation
CREATE INDEX IF NOT EXISTS idx_numerology_library_narrative_version
  ON public.numerology_library(narrative_prompt_version)
  WHERE narrative_json IS NOT NULL;

-- Recreate profiles index on official_numerology_key (dropped by remote_schema)
CREATE INDEX IF NOT EXISTS idx_profiles_official_numerology_key
  ON public.profiles(official_numerology_key);

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.numerology_library ENABLE ROW LEVEL SECURITY;

-- Service role: full access for all operations (API server writes via admin client)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'numerology_library'
      AND policyname = 'numerology_library_service_role_all'
  ) THEN
    CREATE POLICY "numerology_library_service_role_all"
      ON public.numerology_library
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Authenticated users: SELECT only their own official book
-- Tight by design: users cannot enumerate the global library.
-- The API server (service_role) fetches on behalf of users after auth checks.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'numerology_library'
      AND policyname = 'numerology_library_select_own_book'
  ) THEN
    CREATE POLICY "numerology_library_select_own_book"
      ON public.numerology_library
      FOR SELECT
      TO authenticated
      USING (
        numerology_key = (
          SELECT official_numerology_key
          FROM public.profiles
          WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 4. ACCESS TRACKING FUNCTION
-- ============================================================================
-- Recreates the function dropped by remote_schema.sql.
-- Called from application layer (via admin client) to track book access.

CREATE OR REPLACE FUNCTION public.update_numerology_access(p_numerology_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.numerology_library
  SET
    last_accessed_at = NOW(),
    access_count = access_count + 1
  WHERE numerology_key = p_numerology_key;
  -- No-op if row doesn't exist (safe)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE public.numerology_library IS
  'Global library of computed numerology profiles with AI narratives. Deduplicated by deterministic numerology_key + system. Book = Math (numerology_json) + Narrative (narrative_json). Part of the unified Library of Solara.';

COMMENT ON COLUMN public.numerology_library.numerology_key IS
  'SHA-256 hash of normalized name + birth_date + config version. Ensures deterministic deduplication.';

COMMENT ON COLUMN public.numerology_library.system IS
  'Numerology system used: "pythagorean" or "chaldean". Part of the deterministic key.';

COMMENT ON COLUMN public.numerology_library.narrative_json IS
  'AI-generated numerology soul story. NULL if not yet generated. Cached once generated.';
