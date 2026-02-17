-- Fix ALL legacy columns on remote numerology_library
--
-- The remote table's PK is 'id' (uuid) from the old per-user design.
-- The new global library design uses 'numerology_key' (text) as PK.
-- Legacy NOT NULL columns: user_id, input_hash, profile_json, updated_at
--
-- Strategy:
-- 1. Drop the old 'id' PK constraint
-- 2. Make 'id' nullable
-- 3. Make all other legacy columns nullable
-- 4. Add 'numerology_key' as the new PK (if not already)

-- ============================================================================
-- Step 1: Switch primary key from legacy 'id' to 'numerology_key'
-- ============================================================================

DO $$
DECLARE
  pk_col TEXT;
  pk_name TEXT;
BEGIN
  -- Find current PK column
  SELECT kcu.column_name, tc.constraint_name
  INTO pk_col, pk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'numerology_library'
    AND tc.constraint_type = 'PRIMARY KEY'
  LIMIT 1;

  IF pk_col = 'id' THEN
    -- Drop the old PK
    EXECUTE format('ALTER TABLE public.numerology_library DROP CONSTRAINT %I', pk_name);
    RAISE NOTICE 'Dropped old PK constraint % on id column', pk_name;

    -- Make id nullable
    ALTER TABLE public.numerology_library ALTER COLUMN id DROP NOT NULL;
    RAISE NOTICE 'Made id column nullable';

    -- Add new PK on numerology_key
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'numerology_library'
        AND column_name = 'numerology_key'
    ) THEN
      ALTER TABLE public.numerology_library ALTER COLUMN numerology_key SET NOT NULL;
      ALTER TABLE public.numerology_library ADD PRIMARY KEY (numerology_key);
      RAISE NOTICE 'Added PK on numerology_key';
    END IF;

  ELSIF pk_col = 'numerology_key' THEN
    RAISE NOTICE 'PK already on numerology_key, no change needed';
  ELSE
    RAISE NOTICE 'Unexpected PK column: %, manual review needed', pk_col;
  END IF;
END $$;

-- ============================================================================
-- Step 2: Make all legacy NOT NULL columns nullable
-- ============================================================================

DO $$
DECLARE
  col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY['user_id', 'input_hash', 'profile_json', 'updated_at', 'numerology_json']
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
