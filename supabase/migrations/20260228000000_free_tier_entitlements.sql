-- Free Tier Entitlements
-- Adds tracking columns for one-time free tarot taste.
--
-- tarot_free_used: true after a free user has drawn their one lifetime
--   tarot reading. Prevents repeated free draws without Premium.
--   DEFAULT FALSE keeps all existing users eligible for the free taste.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tarot_free_used BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.tarot_free_used IS
  'True once a free user has consumed their one-lifetime tarot taste. Premium users ignore this flag.';
