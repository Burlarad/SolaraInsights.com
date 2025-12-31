-- Migration: Create numerology_profiles table for stone tablet caching
-- Numerology calculations use profiles.first_name, middle_name, last_name
-- This table caches the computed results, invalidating if name/birthdate changes

-- =============================================================================
-- STEP 1: Create numerology_profiles table (stone tablet - computed once)
-- =============================================================================

CREATE TABLE IF NOT EXISTS numerology_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Cache invalidation keys (stores name used for calculation)
  birth_date DATE NOT NULL,                    -- From profile.birth_date
  birth_first_name TEXT NOT NULL,              -- From profile.first_name (stored at calculation time)
  birth_middle_name TEXT,                      -- From profile.middle_name (optional)
  birth_last_name TEXT NOT NULL,               -- From profile.last_name (stored at calculation time)
  system TEXT NOT NULL DEFAULT 'pythagorean',  -- 'pythagorean' | 'chaldean'

  -- Core numbers (computed once, stored forever)
  life_path_number INTEGER NOT NULL,           -- Reduced to 1-9 or master (11,22,33)
  life_path_master INTEGER,                    -- Original master number if reduced (11,22,33)
  birthday_number INTEGER NOT NULL,            -- Day of birth (1-31)
  expression_number INTEGER NOT NULL,          -- Full birth name
  expression_master INTEGER,                   -- Master number if applicable
  soul_urge_number INTEGER NOT NULL,           -- Vowels only
  soul_urge_master INTEGER,                    -- Master number if applicable
  personality_number INTEGER NOT NULL,         -- Consonants only
  personality_master INTEGER,                  -- Master number if applicable
  maturity_number INTEGER NOT NULL,            -- Life Path + Expression
  maturity_master INTEGER,                     -- Master number if applicable

  -- Pinnacles (4 life periods)
  pinnacle_1 INTEGER NOT NULL,
  pinnacle_2 INTEGER NOT NULL,
  pinnacle_3 INTEGER NOT NULL,
  pinnacle_4 INTEGER NOT NULL,

  -- Pinnacle age ranges (depends on Life Path)
  pinnacle_1_end_age INTEGER NOT NULL,         -- First pinnacle ends at this age
  pinnacle_2_end_age INTEGER NOT NULL,         -- Second pinnacle ends at this age
  pinnacle_3_end_age INTEGER NOT NULL,         -- Third pinnacle ends at this age
  -- Fourth pinnacle has no end (rest of life)

  -- Challenges (4 life challenges)
  challenge_1 INTEGER NOT NULL,
  challenge_2 INTEGER NOT NULL,
  challenge_3 INTEGER NOT NULL,
  challenge_4 INTEGER NOT NULL,

  -- Lucky numbers (derived from core numbers)
  lucky_numbers INTEGER[] NOT NULL,            -- Array of 3-5 lucky numbers

  -- Karmic debt indicators
  has_karmic_debt BOOLEAN NOT NULL DEFAULT FALSE,
  karmic_debt_numbers INTEGER[],               -- Array of karmic debt numbers found (13,14,16,19)

  -- Metadata
  prompt_version INTEGER NOT NULL DEFAULT 1,   -- For future cache invalidation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one profile per user per system
CREATE UNIQUE INDEX IF NOT EXISTS idx_numerology_profiles_user_system
  ON numerology_profiles(user_id, system);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_numerology_profiles_user_id
  ON numerology_profiles(user_id);

-- Add comments
COMMENT ON TABLE numerology_profiles IS 'Stone tablet numerology profiles - computed once from birth name + date, stored forever per system';
COMMENT ON COLUMN numerology_profiles.system IS 'Numerology system: pythagorean (default) or chaldean';
COMMENT ON COLUMN numerology_profiles.life_path_master IS 'Original master number (11,22,33) before reduction, if applicable';
COMMENT ON COLUMN numerology_profiles.lucky_numbers IS 'Derived lucky numbers based on core numerology (NOT random)';
COMMENT ON COLUMN numerology_profiles.karmic_debt_numbers IS 'Karmic debt numbers found in calculations (13,14,16,19)';

-- =============================================================================
-- STEP 2: Row Level Security
-- =============================================================================

ALTER TABLE numerology_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own numerology profile
CREATE POLICY "numerology_profiles_select_own" ON numerology_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own numerology profile
CREATE POLICY "numerology_profiles_insert_own" ON numerology_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own numerology profile
CREATE POLICY "numerology_profiles_update_own" ON numerology_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own numerology profile
CREATE POLICY "numerology_profiles_delete_own" ON numerology_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- STEP 3: Auto-update updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_numerology_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_numerology_profiles_updated_at ON numerology_profiles;
CREATE TRIGGER trigger_numerology_profiles_updated_at
  BEFORE UPDATE ON numerology_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_numerology_profiles_updated_at();
