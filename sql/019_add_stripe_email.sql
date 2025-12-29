-- Migration 019: Add stripe_email column to profiles
-- This stores the email from Stripe checkout, which may differ from auth email
-- (e.g., OAuth users signing up with Facebook email but paying with different email)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_email TEXT;

COMMENT ON COLUMN profiles.stripe_email IS 'Email from Stripe checkout (for billing display in Settings)';
