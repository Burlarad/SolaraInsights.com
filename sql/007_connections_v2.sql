-- Connections V2: Daily Briefs + Space Between Reports
-- Run this migration in Supabase SQL Editor
--
-- This adds the two-layer Connections system:
-- Layer A: daily_briefs - light daily "weather report" for connections
-- Layer B: space_between_reports - deep "stone tablet" relationship blueprint

-- ============================================================================
-- 1. Add notes column to existing connections table
-- ============================================================================

ALTER TABLE public.connections
ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- 2. Create daily_briefs table
-- ============================================================================
-- Stores immutable daily connection briefs (one per connection per day)
-- Once generated for a specific day, it never changes.

CREATE TABLE IF NOT EXISTS public.daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Cache key components (for uniqueness)
  local_date DATE NOT NULL,              -- User's local date (timezone-aware)
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  prompt_version INTEGER NOT NULL,

  -- Generation metadata
  model_version VARCHAR(50),             -- e.g., "gpt-4o-mini"

  -- Content (immutable once generated)
  title TEXT NOT NULL,                   -- "Today with {Name}"
  shared_vibe TEXT NOT NULL,             -- 2-4 sentences
  ways_to_show_up TEXT[] NOT NULL,       -- Exactly 3 bullets (action verbs)
  nudge TEXT,                            -- Optional small nudge line

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one brief per connection per day per language per prompt version
  CONSTRAINT daily_briefs_unique_per_day
    UNIQUE (connection_id, local_date, language, prompt_version)
);

-- Index for fast lookups by connection + date
CREATE INDEX IF NOT EXISTS idx_daily_briefs_connection_date
ON public.daily_briefs(connection_id, local_date DESC);

-- Index for owner lookups (for cleanup/admin)
CREATE INDEX IF NOT EXISTS idx_daily_briefs_owner
ON public.daily_briefs(owner_user_id);

-- ============================================================================
-- 3. Create space_between_reports table
-- ============================================================================
-- Stores the deep "stone tablet" relationship blueprint.
-- Generated once per connection (first open), never regenerated.

CREATE TABLE IF NOT EXISTS public.space_between_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Cache key components (for uniqueness)
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  prompt_version INTEGER NOT NULL,

  -- Generation metadata
  model_version VARCHAR(50),             -- e.g., "gpt-4o"

  -- Data sources used (for transparency)
  includes_linked_birth_data BOOLEAN NOT NULL DEFAULT FALSE,
  includes_linked_social_data BOOLEAN NOT NULL DEFAULT FALSE,
  linked_profile_id UUID,                -- The linked profile used (if any)

  -- Content sections (stone tablet - never changes)
  relationship_essence TEXT NOT NULL,    -- Core dynamic / soul signature of connection
  emotional_blueprint TEXT NOT NULL,     -- How you feel together, emotional rhythms
  communication_patterns TEXT NOT NULL,  -- How you talk, listen, express
  growth_edges TEXT NOT NULL,            -- Where you stretch each other
  care_guide TEXT NOT NULL,              -- How to show up for each other

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one report per connection per language per prompt version
  CONSTRAINT space_between_unique_per_connection
    UNIQUE (connection_id, language, prompt_version)
);

-- Index for fast lookups by connection
CREATE INDEX IF NOT EXISTS idx_space_between_connection
ON public.space_between_reports(connection_id);

-- Index for owner lookups
CREATE INDEX IF NOT EXISTS idx_space_between_owner
ON public.space_between_reports(owner_user_id);

-- ============================================================================
-- 4. Enable Row Level Security
-- ============================================================================

ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_between_reports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLS Policies for daily_briefs
-- ============================================================================

-- Users can only view their own daily briefs
CREATE POLICY "Users can view their own daily briefs"
  ON public.daily_briefs
  FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Users can insert their own daily briefs
CREATE POLICY "Users can insert their own daily briefs"
  ON public.daily_briefs
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- Users can delete their own daily briefs (cascade from connection delete)
CREATE POLICY "Users can delete their own daily briefs"
  ON public.daily_briefs
  FOR DELETE
  USING (auth.uid() = owner_user_id);

-- No UPDATE policy - briefs are immutable once created

-- ============================================================================
-- 6. RLS Policies for space_between_reports
-- ============================================================================

-- Users can only view their own space between reports
CREATE POLICY "Users can view their own space between reports"
  ON public.space_between_reports
  FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Users can insert their own space between reports
CREATE POLICY "Users can insert their own space between reports"
  ON public.space_between_reports
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- Users can delete their own space between reports
CREATE POLICY "Users can delete their own space between reports"
  ON public.space_between_reports
  FOR DELETE
  USING (auth.uid() = owner_user_id);

-- No UPDATE policy - stone tablet reports are immutable

-- ============================================================================
-- 7. Grant permissions to authenticated users
-- ============================================================================

GRANT SELECT, INSERT, DELETE ON public.daily_briefs TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.space_between_reports TO authenticated;

-- ============================================================================
-- Verification queries (run these after migration to confirm)
-- ============================================================================
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'daily_briefs';
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'space_between_reports';
--
-- SELECT tablename, policyname
-- FROM pg_policies
-- WHERE tablename IN ('daily_briefs', 'space_between_reports');
