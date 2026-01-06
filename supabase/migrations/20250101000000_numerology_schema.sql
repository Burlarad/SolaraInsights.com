-- Migration: Create numerology_profiles table (matches production schema)
-- Stores computed numerology data with hash-based cache invalidation

CREATE TABLE IF NOT EXISTS numerology_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  system TEXT NOT NULL DEFAULT 'pythagorean',
  input_hash TEXT NOT NULL,
  profile_json JSONB NOT NULL,
  prompt_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one profile per user per system per hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_numerology_profiles_user_system_hash
  ON numerology_profiles(user_id, system, input_hash);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_numerology_profiles_user_id
  ON numerology_profiles(user_id);

-- RLS
ALTER TABLE numerology_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='numerology_profiles' AND policyname='numerology_profiles_select_own') THEN
    CREATE POLICY "numerology_profiles_select_own" ON numerology_profiles
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='numerology_profiles' AND policyname='numerology_profiles_insert_own') THEN
    CREATE POLICY "numerology_profiles_insert_own" ON numerology_profiles
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='numerology_profiles' AND policyname='numerology_profiles_update_own') THEN
    CREATE POLICY "numerology_profiles_update_own" ON numerology_profiles
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='numerology_profiles' AND policyname='numerology_profiles_delete_own') THEN
    CREATE POLICY "numerology_profiles_delete_own" ON numerology_profiles
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- FK constraint (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'numerology_profiles_user_id_fkey') THEN
    ALTER TABLE numerology_profiles
      ADD CONSTRAINT numerology_profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
