-- ============================================================================
-- CONNECTIONS BIRTH COORDINATES MIGRATION
-- ============================================================================
-- Adds birth_lat, birth_lon, and timezone columns to connections table.
-- These are pre-resolved from PlacePicker and stored directly.
-- Run this migration in Supabase SQL Editor.

-- ============================================================================
-- 1. ADD COORDINATE COLUMNS TO connections TABLE
-- ============================================================================

DO $$
BEGIN
  -- Add birth_lat column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connections' AND column_name = 'birth_lat'
  ) THEN
    ALTER TABLE public.connections ADD COLUMN birth_lat DOUBLE PRECISION;
  END IF;

  -- Add birth_lon column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connections' AND column_name = 'birth_lon'
  ) THEN
    ALTER TABLE public.connections ADD COLUMN birth_lon DOUBLE PRECISION;
  END IF;

  -- Add timezone column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connections' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE public.connections ADD COLUMN timezone TEXT;
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
--
-- Check new columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'connections'
-- ORDER BY ordinal_position;
--
-- Check a connection row:
-- SELECT id, name, birth_city, birth_lat, birth_lon, timezone
-- FROM public.connections
-- LIMIT 5;
--
