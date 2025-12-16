-- Profile Birth Signature Lookup Index
-- Run this migration in Supabase SQL Editor
--
-- Optimizes profile resolution queries for connection linking

-- Index for fast profile lookup by birth signature
-- Used when resolving connections to real profiles
CREATE INDEX IF NOT EXISTS idx_profiles_birth_signature_lookup
ON public.profiles(birth_date, birth_city, birth_country);

-- Additional index for name lookups (normalized matching happens in code)
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_name_lower
ON public.profiles(LOWER(preferred_name));

CREATE INDEX IF NOT EXISTS idx_profiles_full_name_lower
ON public.profiles(LOWER(full_name));
