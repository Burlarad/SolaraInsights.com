-- Patch migration: Remote ledger says applied, but schema is missing Library Book objects.
-- This migration is intentionally idempotent (IF NOT EXISTS) and safe to apply to any environment.

-- 1) Add official keys to profiles (Settings source-of-truth pointers)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS official_chart_key text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS official_numerology_key text;

-- 2) Add structured columns to social_summaries (no more HTML comment metadata)
ALTER TABLE public.social_summaries
  ADD COLUMN IF NOT EXISTS metadata_json jsonb;

ALTER TABLE public.social_summaries
  ADD COLUMN IF NOT EXISTS summary_text text;

-- expires_at already exists on your remote, but keep this safe:
ALTER TABLE public.social_summaries
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 3) Global chart library table (dedupe by deterministic chart_key)
CREATE TABLE IF NOT EXISTS public.charts (
  chart_key text PRIMARY KEY,
  input_json jsonb NOT NULL,
  geometry_json jsonb NOT NULL,
  engine_config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Global numerology library table (dedupe by deterministic numerology_key)
CREATE TABLE IF NOT EXISTS public.numerology_profiles (
  numerology_key text PRIMARY KEY,
  input_json jsonb NOT NULL,
  numerology_json jsonb NOT NULL,
  config_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Minimal safety indexes (optional but cheap)
CREATE INDEX IF NOT EXISTS charts_created_at_idx ON public.charts (created_at DESC);
CREATE INDEX IF NOT EXISTS numerology_profiles_created_at_idx ON public.numerology_profiles (created_at DESC);

