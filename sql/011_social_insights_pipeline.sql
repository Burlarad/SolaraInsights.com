-- ============================================================================
-- SOCIAL INSIGHTS PIPELINE - Complete Schema
-- ============================================================================
-- Run this migration in Supabase SQL Editor.
-- This creates/updates social_connections and social_summaries tables
-- with full schema for the Social Insights pipeline.

-- ============================================================================
-- 1. CREATE social_connections TABLE (IF NOT EXISTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  handle TEXT,
  provider_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_ingested_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one connection per user per provider
  CONSTRAINT social_connections_user_provider_unique UNIQUE (user_id, provider),

  -- Status must be one of the allowed values
  CONSTRAINT social_connections_status_check CHECK (
    status IN ('disconnected', 'connected', 'processing', 'ready', 'failed')
  ),

  -- Provider must be one of the allowed values
  CONSTRAINT social_connections_provider_check CHECK (
    provider IN ('facebook', 'instagram', 'tiktok', 'x', 'youtube', 'linkedin', 'reddit')
  )
);

-- Add columns if they don't exist (for existing tables)
DO $$
BEGIN
  -- Add status column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_connections' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.social_connections ADD COLUMN status TEXT NOT NULL DEFAULT 'disconnected';
    ALTER TABLE public.social_connections ADD CONSTRAINT social_connections_status_check CHECK (
      status IN ('disconnected', 'connected', 'processing', 'ready', 'failed')
    );
  END IF;

  -- Add last_ingested_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_connections' AND column_name = 'last_ingested_at'
  ) THEN
    ALTER TABLE public.social_connections ADD COLUMN last_ingested_at TIMESTAMPTZ;
  END IF;

  -- Add last_error column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_connections' AND column_name = 'last_error'
  ) THEN
    ALTER TABLE public.social_connections ADD COLUMN last_error TEXT;
  END IF;
END $$;

-- ============================================================================
-- 2. CREATE social_summaries TABLE (IF NOT EXISTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.social_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  summary TEXT NOT NULL,
  prompt_version INT NOT NULL DEFAULT 1,
  model_version TEXT,
  last_collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one summary per user per provider
  CONSTRAINT social_summaries_user_provider_unique UNIQUE (user_id, provider),

  -- Provider must be one of the allowed values
  CONSTRAINT social_summaries_provider_check CHECK (
    provider IN ('facebook', 'instagram', 'tiktok', 'x', 'youtube', 'linkedin', 'reddit')
  )
);

-- Add columns if they don't exist (for existing tables)
DO $$
BEGIN
  -- Add prompt_version column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_summaries' AND column_name = 'prompt_version'
  ) THEN
    ALTER TABLE public.social_summaries ADD COLUMN prompt_version INT NOT NULL DEFAULT 1;
  END IF;

  -- Add model_version column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_summaries' AND column_name = 'model_version'
  ) THEN
    ALTER TABLE public.social_summaries ADD COLUMN model_version TEXT;
  END IF;

  -- Add created_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_summaries' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.social_summaries ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_social_connections_user_provider
  ON public.social_connections(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_social_summaries_user_provider
  ON public.social_summaries(user_id, provider);

-- ============================================================================
-- 4. ENABLE RLS
-- ============================================================================

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_summaries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLS POLICIES FOR social_connections
-- ============================================================================

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can view their own social connections" ON public.social_connections;
DROP POLICY IF EXISTS "Users can insert their own social connections" ON public.social_connections;
DROP POLICY IF EXISTS "Users can update their own social connections" ON public.social_connections;
DROP POLICY IF EXISTS "Users can delete their own social connections" ON public.social_connections;

CREATE POLICY "Users can view their own social connections"
  ON public.social_connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social connections"
  ON public.social_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social connections"
  ON public.social_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social connections"
  ON public.social_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 6. RLS POLICIES FOR social_summaries
-- ============================================================================

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can view their own social summaries" ON public.social_summaries;
DROP POLICY IF EXISTS "Users can insert their own social summaries" ON public.social_summaries;
DROP POLICY IF EXISTS "Users can update their own social summaries" ON public.social_summaries;
DROP POLICY IF EXISTS "Users can delete their own social summaries" ON public.social_summaries;

-- Users can SELECT their own summaries
CREATE POLICY "Users can view their own social summaries"
  ON public.social_summaries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can INSERT their own summaries
CREATE POLICY "Users can insert their own social summaries"
  ON public.social_summaries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own summaries
CREATE POLICY "Users can update their own social summaries"
  ON public.social_summaries
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can DELETE their own summaries
CREATE POLICY "Users can delete their own social summaries"
  ON public.social_summaries
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 7. LINKED PROFILE ACCESS POLICY FOR social_summaries
-- ============================================================================
-- Allow users to view social summaries of their linked connections
-- (for Space Between feature)

DROP POLICY IF EXISTS "Users can view linked profile social summaries" ON public.social_summaries;

CREATE POLICY "Users can view linked profile social summaries"
  ON public.social_summaries
  FOR SELECT
  USING (
    -- Own summaries
    auth.uid() = user_id
    OR
    -- Summaries of linked profiles where Space Between is unlocked
    EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.owner_user_id = auth.uid()
        AND c.linked_profile_id = social_summaries.user_id
        AND c.is_space_between_unlocked = TRUE
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES (run after migration to confirm)
-- ============================================================================
--
-- Check social_connections table:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'social_connections'
-- ORDER BY ordinal_position;
--
-- Check social_summaries table:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'social_summaries'
-- ORDER BY ordinal_position;
--
-- Check indexes:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename IN ('social_connections', 'social_summaries');
--
-- Check policies:
-- SELECT policyname, tablename FROM pg_policies
-- WHERE tablename IN ('social_connections', 'social_summaries');
--
