-- ============================================================================
-- SOCIAL OAUTH TOKENS MIGRATION
-- ============================================================================
-- Adds OAuth token storage and updates status enum for OAuth-based auto-fetch.
-- Tokens are stored encrypted - encryption/decryption happens in application code.
-- Run this migration in Supabase SQL Editor.

-- ============================================================================
-- 1. ADD TOKEN COLUMNS TO social_connections
-- ============================================================================

DO $$
BEGIN
  -- Add access_token_encrypted column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_connections' AND column_name = 'access_token_encrypted'
  ) THEN
    ALTER TABLE public.social_connections ADD COLUMN access_token_encrypted TEXT;
  END IF;

  -- Add refresh_token_encrypted column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_connections' AND column_name = 'refresh_token_encrypted'
  ) THEN
    ALTER TABLE public.social_connections ADD COLUMN refresh_token_encrypted TEXT;
  END IF;

  -- Add token_expires_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_connections' AND column_name = 'token_expires_at'
  ) THEN
    ALTER TABLE public.social_connections ADD COLUMN token_expires_at TIMESTAMPTZ;
  END IF;

  -- Add scopes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_connections' AND column_name = 'scopes'
  ) THEN
    ALTER TABLE public.social_connections ADD COLUMN scopes TEXT;
  END IF;

  -- Rename last_ingested_at to last_synced_at if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_connections' AND column_name = 'last_ingested_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_connections' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE public.social_connections RENAME COLUMN last_ingested_at TO last_synced_at;
  END IF;

  -- Add last_synced_at if neither exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_connections' AND column_name = 'last_synced_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_connections' AND column_name = 'last_ingested_at'
  ) THEN
    ALTER TABLE public.social_connections ADD COLUMN last_synced_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- 2. UPDATE STATUS CHECK CONSTRAINT
-- ============================================================================
-- New statuses: disconnected, connected, syncing, ready, needs_reauth

-- Drop old constraint
ALTER TABLE public.social_connections
  DROP CONSTRAINT IF EXISTS social_connections_status_check;

-- Add new constraint with updated statuses
ALTER TABLE public.social_connections
  ADD CONSTRAINT social_connections_status_check CHECK (
    status IN ('disconnected', 'connected', 'syncing', 'ready', 'needs_reauth')
  );

-- Migrate existing statuses
UPDATE public.social_connections
  SET status = 'needs_reauth'
  WHERE status = 'failed';

UPDATE public.social_connections
  SET status = 'syncing'
  WHERE status = 'processing';

-- ============================================================================
-- 3. UPDATE PROVIDER CHECK CONSTRAINT
-- ============================================================================
-- Remove youtube and linkedin from allowed providers

-- Drop old constraint
ALTER TABLE public.social_connections
  DROP CONSTRAINT IF EXISTS social_connections_provider_check;

-- Add new constraint with only 5 providers
ALTER TABLE public.social_connections
  ADD CONSTRAINT social_connections_provider_check CHECK (
    provider IN ('facebook', 'instagram', 'tiktok', 'x', 'reddit')
  );

-- Drop old constraint on social_summaries
ALTER TABLE public.social_summaries
  DROP CONSTRAINT IF EXISTS social_summaries_provider_check;

-- Add new constraint with only 5 providers
ALTER TABLE public.social_summaries
  ADD CONSTRAINT social_summaries_provider_check CHECK (
    provider IN ('facebook', 'instagram', 'tiktok', 'x', 'reddit')
  );

-- ============================================================================
-- 4. CREATE INDEX FOR TOKEN EXPIRY (for cron refresh)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_social_connections_token_expiry
  ON public.social_connections(token_expires_at)
  WHERE status = 'ready' AND token_expires_at IS NOT NULL;

-- ============================================================================
-- 5. UPDATE RLS - Tokens should NEVER be exposed to client
-- ============================================================================
-- Token columns should only be readable via service role.
-- The existing policies already use auth.uid() = user_id for SELECT,
-- which is fine because we simply won't SELECT token columns in client queries.
-- The API routes use service role for token operations.

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
--
-- Check new columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'social_connections'
-- ORDER BY ordinal_position;
--
-- Check constraints:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'social_connections'::regclass;
--
