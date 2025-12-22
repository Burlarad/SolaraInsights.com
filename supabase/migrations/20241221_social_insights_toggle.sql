-- Migration: Add social insights toggle with deferred activation model
-- Run this in your Supabase SQL editor

-- Add columns to profiles table
-- NOTE: Default is FALSE - enabled only set to true after first OAuth connection
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS social_insights_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS social_insights_activated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS social_connect_prompt_dismissed_at TIMESTAMPTZ DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN profiles.social_insights_enabled IS 'When true, social insights are active and sync triggers. Default false - only enabled after first OAuth connection.';
COMMENT ON COLUMN profiles.social_insights_activated_at IS 'Timestamp when social insights were first activated (first OAuth connection). NULL means never activated.';
COMMENT ON COLUMN profiles.social_connect_prompt_dismissed_at IS 'Legacy: When set, the social connect modal in Sanctuary will not auto-show. May be deprecated.';

-- Backfill: For existing users who already have connected social accounts,
-- set enabled=true and activated_at=now()
UPDATE profiles p
SET
  social_insights_enabled = true,
  social_insights_activated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM social_accounts sa
  WHERE sa.user_id = p.id
)
AND p.social_insights_enabled = false;
