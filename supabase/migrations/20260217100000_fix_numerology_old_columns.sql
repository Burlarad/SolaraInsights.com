-- Fix ALL legacy NOT NULL columns on remote numerology_library
--
-- Problem: The remote table has legacy columns from the old per-user design:
--   id (uuid), user_id (uuid), input_hash (text), profile_json (jsonb), updated_at (timestamptz)
-- These are NOT NULL but the new global library code doesn't populate them.
--
-- This migration makes ALL legacy columns nullable so the new code's upserts succeed.
-- The legacy columns are kept (not dropped) to avoid data loss from old rows.

-- Helper: make a column nullable if it exists and is NOT NULL
-- Covers all 5 legacy columns + numerology_json (which the code populates but might be NOT NULL)

DO $$
DECLARE
  col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY['id', 'user_id', 'input_hash', 'profile_json', 'updated_at', 'numerology_json']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'numerology_library'
        AND column_name = col
        AND is_nullable = 'NO'
    ) THEN
      EXECUTE format('ALTER TABLE public.numerology_library ALTER COLUMN %I DROP NOT NULL', col);
      RAISE NOTICE 'Made column % nullable', col;
    END IF;
  END LOOP;
END $$;

-- Drop the old primary key if it's on the legacy 'id' column (conflicts with numerology_key PK)
-- The correct PK is on numerology_key, which was added by the recreate migration.
DO $$
BEGIN
  -- Check if 'id' has a default (gen_random_uuid) which indicates it was the old PK
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'numerology_library'
      AND column_name = 'id'
      AND column_default LIKE '%gen_random_uuid%'
  ) THEN
    -- Remove the default so it's just a nullable leftover column
    ALTER TABLE public.numerology_library ALTER COLUMN id DROP DEFAULT;
    RAISE NOTICE 'Dropped default on legacy id column';
  END IF;
END $$;
