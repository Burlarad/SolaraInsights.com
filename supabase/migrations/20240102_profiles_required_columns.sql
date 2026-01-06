-- Migration: Add additional columns to profiles (now handled in baseline)
-- This migration is kept for history but all columns are now in baseline.
-- Safe to run - ADD COLUMN IF NOT EXISTS is idempotent.

-- These are no-ops since baseline now includes them:
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS membership_plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS membership_updated_at timestamptz;

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_profiles_membership_plan ON public.profiles(membership_plan);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);
