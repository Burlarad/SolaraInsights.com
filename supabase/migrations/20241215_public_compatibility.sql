-- Migration: Create public_compatibility table for stone tablet compatibility readings
-- Run this in your Supabase SQL editor

-- Create table for storing generated compatibility readings (one per pair, forever)
CREATE TABLE IF NOT EXISTS public_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_key TEXT NOT NULL UNIQUE, -- e.g., "scorpio__taurus" (alphabetical)
  sign_a TEXT NOT NULL,          -- First sign (alphabetically sorted)
  sign_b TEXT NOT NULL,          -- Second sign (alphabetically sorted)
  content_en_json JSONB NOT NULL, -- Full compatibility content (English only)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by pair_key
CREATE INDEX IF NOT EXISTS idx_public_compatibility_pair_key ON public_compatibility(pair_key);

-- Add comment for documentation
COMMENT ON TABLE public_compatibility IS 'Stone tablet compatibility readings - generated once per sign pair, stored forever';
COMMENT ON COLUMN public_compatibility.pair_key IS 'Canonical key like "scorpio__taurus" (alphabetically sorted)';
COMMENT ON COLUMN public_compatibility.content_en_json IS 'Full compatibility JSON content in English';

-- RLS policies (allow public read, admin-only write)
ALTER TABLE public_compatibility ENABLE ROW LEVEL SECURITY;

-- Anyone can read compatibility data
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='public_compatibility' AND policyname='public_compatibility_select_policy') THEN
    CREATE POLICY "public_compatibility_select_policy" ON public_compatibility
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Only service role can insert (API uses admin client)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='public_compatibility' AND policyname='public_compatibility_insert_policy') THEN
    CREATE POLICY "public_compatibility_insert_policy" ON public_compatibility
      FOR INSERT
      WITH CHECK (false);
  END IF;
END $$;
