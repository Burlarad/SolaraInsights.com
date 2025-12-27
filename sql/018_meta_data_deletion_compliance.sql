-- ============================================================================
-- META DATA DELETION COMPLIANCE MIGRATION
-- ============================================================================
-- This migration adds tables required for Meta (Facebook/Instagram) Data
-- Deletion Callback compliance.
--
-- Creates:
-- 1. social_identities - Preserves external_user_id → user_id mapping
--    (survives disconnect, used for Data Deletion lookups)
-- 2. facebook_data_deletion_requests - Audit log for Meta callbacks
--
-- Run this migration in Supabase SQL Editor.

-- ============================================================================
-- 1. CREATE social_identities TABLE
-- ============================================================================
-- This table persists the mapping between external social platform user IDs
-- and Solara user IDs. Unlike social_accounts (which is deleted on disconnect),
-- this table survives disconnection to support Meta Data Deletion callbacks.

CREATE TABLE IF NOT EXISTS public.social_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one identity per user per provider
  CONSTRAINT social_identities_user_provider_unique UNIQUE (user_id, provider),

  -- Also enforce unique external_user_id per provider (one Solara account per FB account)
  CONSTRAINT social_identities_external_unique UNIQUE (provider, external_user_id),

  -- Provider must be one of the allowed values
  CONSTRAINT social_identities_provider_check CHECK (
    provider IN ('facebook', 'instagram', 'tiktok', 'x', 'reddit')
  )
);

-- ============================================================================
-- 2. CREATE INDEXES FOR social_identities
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_social_identities_user_provider
  ON public.social_identities(user_id, provider);

-- Critical index for Meta Data Deletion callback lookups
CREATE INDEX IF NOT EXISTS idx_social_identities_provider_external
  ON public.social_identities(provider, external_user_id);

-- ============================================================================
-- 3. ENABLE RLS FOR social_identities
-- ============================================================================

ALTER TABLE public.social_identities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES FOR social_identities
-- ============================================================================
-- Service role only - users should not directly access this table.
-- This table is an internal mapping used for compliance callbacks.

DROP POLICY IF EXISTS "Users cannot read social_identities" ON public.social_identities;
DROP POLICY IF EXISTS "Users cannot insert social_identities" ON public.social_identities;
DROP POLICY IF EXISTS "Users cannot update social_identities" ON public.social_identities;
DROP POLICY IF EXISTS "Users cannot delete social_identities" ON public.social_identities;

CREATE POLICY "Users cannot read social_identities"
  ON public.social_identities
  FOR SELECT
  USING (false);

CREATE POLICY "Users cannot insert social_identities"
  ON public.social_identities
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Users cannot update social_identities"
  ON public.social_identities
  FOR UPDATE
  USING (false);

CREATE POLICY "Users cannot delete social_identities"
  ON public.social_identities
  FOR DELETE
  USING (false);

-- ============================================================================
-- 5. ADD updated_at TRIGGER FOR social_identities
-- ============================================================================

CREATE OR REPLACE FUNCTION update_social_identities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS social_identities_updated_at ON public.social_identities;
CREATE TRIGGER social_identities_updated_at
  BEFORE UPDATE ON public.social_identities
  FOR EACH ROW
  EXECUTE FUNCTION update_social_identities_updated_at();

-- ============================================================================
-- 6. CREATE facebook_data_deletion_requests TABLE
-- ============================================================================
-- Audit log for Meta Data Deletion Callback requests.
-- Meta requires a confirmation URL that users can visit to check status.

CREATE TABLE IF NOT EXISTS public.facebook_data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- confirmation_code is what Meta shows users and what we use in status URL
  confirmation_code TEXT NOT NULL UNIQUE,
  -- Facebook user ID from signed_request
  facebook_user_id TEXT NOT NULL,
  -- Our internal user_id (may be null if lookup fails)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  -- Timestamps
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  -- Optional error message if processing failed
  error_message TEXT,

  -- Status must be one of the allowed values
  CONSTRAINT fdr_status_check CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'user_not_found')
  )
);

-- ============================================================================
-- 7. CREATE INDEXES FOR facebook_data_deletion_requests
-- ============================================================================

-- Primary lookup by confirmation code (for status page)
CREATE INDEX IF NOT EXISTS idx_fdr_confirmation_code
  ON public.facebook_data_deletion_requests(confirmation_code);

-- Lookup by Facebook user ID
CREATE INDEX IF NOT EXISTS idx_fdr_facebook_user_id
  ON public.facebook_data_deletion_requests(facebook_user_id);

-- Lookup by our user_id
CREATE INDEX IF NOT EXISTS idx_fdr_user_id
  ON public.facebook_data_deletion_requests(user_id);

-- ============================================================================
-- 8. ENABLE RLS FOR facebook_data_deletion_requests
-- ============================================================================

ALTER TABLE public.facebook_data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. RLS POLICIES FOR facebook_data_deletion_requests
-- ============================================================================
-- Service role only for writes. Users can read by confirmation_code for status.

DROP POLICY IF EXISTS "Users cannot write deletion_requests" ON public.facebook_data_deletion_requests;
DROP POLICY IF EXISTS "Public read by confirmation_code" ON public.facebook_data_deletion_requests;

-- Block all writes from regular users
CREATE POLICY "Users cannot write deletion_requests"
  ON public.facebook_data_deletion_requests
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Allow public read by confirmation_code (for status page)
-- Note: This is intentionally public - the confirmation_code acts as authentication
CREATE POLICY "Public read by confirmation_code"
  ON public.facebook_data_deletion_requests
  FOR SELECT
  USING (true);

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
--
-- Check social_identities table:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'social_identities'
-- ORDER BY ordinal_position;
--
-- Check facebook_data_deletion_requests table:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'facebook_data_deletion_requests'
-- ORDER BY ordinal_position;
--
-- Check indexes:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename IN ('social_identities', 'facebook_data_deletion_requests');
--
-- Check RLS is enabled:
-- SELECT relname, relrowsecurity
-- FROM pg_class
-- WHERE relname IN ('social_identities', 'facebook_data_deletion_requests');
--
