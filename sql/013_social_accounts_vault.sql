-- ============================================================================
-- SOCIAL ACCOUNTS VAULT MIGRATION
-- ============================================================================
-- Creates social_accounts as the canonical token vault for Social Insights.
-- This replaces token storage in social_connections.
-- Run this migration in Supabase SQL Editor.

-- ============================================================================
-- 1. CREATE social_accounts TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_user_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one account per user per provider
  CONSTRAINT social_accounts_user_provider_unique UNIQUE (user_id, provider),

  -- Provider must be one of the allowed values
  CONSTRAINT social_accounts_provider_check CHECK (
    provider IN ('facebook', 'instagram', 'tiktok', 'x', 'reddit')
  )
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_social_accounts_user_provider
  ON public.social_accounts(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_social_accounts_expires_at
  ON public.social_accounts(expires_at)
  WHERE access_token IS NOT NULL AND expires_at IS NOT NULL;

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================
-- Token columns should NEVER be readable by authenticated users.
-- Only service role can read/write this table.
-- We create restrictive policies that block normal users.

DROP POLICY IF EXISTS "Service role full access to social_accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Users cannot read social_accounts" ON public.social_accounts;

-- Block all authenticated user access (tokens must never be exposed)
-- Service role bypasses RLS, so this effectively makes the table service-role-only
CREATE POLICY "Users cannot read social_accounts"
  ON public.social_accounts
  FOR SELECT
  USING (false);

CREATE POLICY "Users cannot insert social_accounts"
  ON public.social_accounts
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Users cannot update social_accounts"
  ON public.social_accounts
  FOR UPDATE
  USING (false);

CREATE POLICY "Users cannot delete social_accounts"
  ON public.social_accounts
  FOR DELETE
  USING (false);

-- ============================================================================
-- 5. ADD updated_at TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_social_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS social_accounts_updated_at ON public.social_accounts;
CREATE TRIGGER social_accounts_updated_at
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_social_accounts_updated_at();

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
--
-- Check table exists:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'social_accounts'
-- ORDER BY ordinal_position;
--
-- Check constraints:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'social_accounts'::regclass;
--
-- Check RLS is enabled:
-- SELECT relname, relrowsecurity
-- FROM pg_class
-- WHERE relname = 'social_accounts';
--
