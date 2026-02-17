-- Fix numerology_library schema mismatch
--
-- Problem: The remote DB has an older version of numerology_library with:
--   - a user_id NOT NULL column (from an old per-user design)
--   - missing narrative_json, narrative_prompt_version, narrative_language, narrative_generated_at columns
--   - missing system column
--
-- The recreate migration (20260216142511) used CREATE TABLE IF NOT EXISTS, which
-- silently skipped because the old table already existed.
--
-- This migration uses ALTER TABLE to add missing columns and drop the old user_id
-- constraint, making the table match the intended global library schema.

-- ============================================================================
-- 1. ADD MISSING COLUMNS (safe: IF NOT EXISTS / already-exists guard)
-- ============================================================================

-- Add narrative columns (Book = Math + Narrative)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'numerology_library'
      AND column_name = 'narrative_json'
  ) THEN
    ALTER TABLE public.numerology_library ADD COLUMN narrative_json JSONB;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'numerology_library'
      AND column_name = 'narrative_prompt_version'
  ) THEN
    ALTER TABLE public.numerology_library ADD COLUMN narrative_prompt_version INTEGER;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'numerology_library'
      AND column_name = 'narrative_language'
  ) THEN
    ALTER TABLE public.numerology_library ADD COLUMN narrative_language TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'numerology_library'
      AND column_name = 'narrative_generated_at'
  ) THEN
    ALTER TABLE public.numerology_library ADD COLUMN narrative_generated_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add system column (pythagorean/chaldean)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'numerology_library'
      AND column_name = 'system'
  ) THEN
    ALTER TABLE public.numerology_library ADD COLUMN system TEXT NOT NULL DEFAULT 'pythagorean';
  END IF;
END $$;

-- Add access_count if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'numerology_library'
      AND column_name = 'access_count'
  ) THEN
    ALTER TABLE public.numerology_library ADD COLUMN access_count INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Add last_accessed_at if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'numerology_library'
      AND column_name = 'last_accessed_at'
  ) THEN
    ALTER TABLE public.numerology_library ADD COLUMN last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- 2. DROP user_id NOT NULL CONSTRAINT (old per-user design → global library)
-- ============================================================================

-- Make user_id nullable if it exists (old schema had it as NOT NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'numerology_library'
      AND column_name = 'user_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.numerology_library ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

-- Also make numerology_json nullable for the initial upsert (math stored first, narrative later)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'numerology_library'
      AND column_name = 'numerology_json'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.numerology_library ALTER COLUMN numerology_json DROP NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. INDEXES (idempotent)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_numerology_library_key_system
  ON public.numerology_library(numerology_key, system);

CREATE INDEX IF NOT EXISTS idx_numerology_last_accessed
  ON public.numerology_library(last_accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_numerology_created_at
  ON public.numerology_library(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_numerology_library_missing_narrative
  ON public.numerology_library(numerology_key)
  WHERE narrative_json IS NULL;

CREATE INDEX IF NOT EXISTS idx_numerology_library_narrative_version
  ON public.numerology_library(narrative_prompt_version)
  WHERE narrative_json IS NOT NULL;

-- ============================================================================
-- 4. RLS POLICIES (idempotent)
-- ============================================================================

ALTER TABLE public.numerology_library ENABLE ROW LEVEL SECURITY;

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
-- 5. ACCESS TRACKING FUNCTION (idempotent)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_numerology_access(p_numerology_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.numerology_library
  SET
    last_accessed_at = NOW(),
    access_count = access_count + 1
  WHERE numerology_key = p_numerology_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
