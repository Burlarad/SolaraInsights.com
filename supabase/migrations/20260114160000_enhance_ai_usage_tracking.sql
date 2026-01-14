-- ============================================================================
-- MIGRATION: Enhance AI Usage Tracking for Full Cost Auditing
-- ============================================================================
-- This migration:
-- 1. Adds missing columns to ai_usage_events for audit-grade tracking
-- 2. Creates ai_usage_rollup_daily for fast aggregation queries
-- 3. Ensures both tables are service_role only (no user access)
-- 4. Adds optimized indexes for common query patterns
-- ============================================================================

-- ============================================================================
-- PART 1: Enhance ai_usage_events table
-- ============================================================================

-- Add provider column (for future multi-provider support: OpenAI, Anthropic, etc.)
ALTER TABLE public.ai_usage_events
ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'openai';

-- Add cost_cents for integer-based accounting (avoid floating point issues)
ALTER TABLE public.ai_usage_events
ADD COLUMN IF NOT EXISTS cost_cents integer NOT NULL DEFAULT 0;

-- Add currency column
ALTER TABLE public.ai_usage_events
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd';

-- Add request_id for correlation with external systems
ALTER TABLE public.ai_usage_events
ADD COLUMN IF NOT EXISTS request_id text;

-- Add meta jsonb for pricing snapshots, cache details, and future extensibility
ALTER TABLE public.ai_usage_events
ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb;

-- Backfill cost_cents from estimated_cost_usd for existing records
UPDATE public.ai_usage_events
SET cost_cents = ROUND(estimated_cost_usd * 100)::integer
WHERE cost_cents = 0 AND estimated_cost_usd > 0;

-- ============================================================================
-- PART 2: Add composite indexes for query patterns
-- ============================================================================

-- Daily/weekly/monthly aggregation by date
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_occurred_at
ON public.ai_usage_events (created_at DESC);

-- Feature breakdown queries: feature + date range
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_feature_occurred
ON public.ai_usage_events (feature_label, created_at DESC);

-- User-specific queries (nullable)
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_occurred
ON public.ai_usage_events (user_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- Model breakdown queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_model_occurred
ON public.ai_usage_events (model, created_at DESC);

-- Provider + date for multi-provider scenarios
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_provider_occurred
ON public.ai_usage_events (provider, created_at DESC);

-- ============================================================================
-- PART 3: Create ai_usage_rollup_daily table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_rollup_daily (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    day date NOT NULL,
    feature text NOT NULL,
    model text NOT NULL,
    provider text NOT NULL DEFAULT 'openai',
    calls integer NOT NULL DEFAULT 0,
    cache_hits integer NOT NULL DEFAULT 0,
    cache_misses integer NOT NULL DEFAULT 0,
    tokens_in integer NOT NULL DEFAULT 0,
    tokens_out integer NOT NULL DEFAULT 0,
    tokens_total integer NOT NULL DEFAULT 0,
    cost_cents integer NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'usd',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ai_usage_rollup_daily_unique UNIQUE (day, feature, model, provider)
);

-- Indexes for rollup queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_rollup_daily_day
ON public.ai_usage_rollup_daily (day DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_rollup_daily_feature_day
ON public.ai_usage_rollup_daily (feature, day DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_rollup_daily_model_day
ON public.ai_usage_rollup_daily (model, day DESC);

-- ============================================================================
-- PART 4: RLS + GRANTS for ai_usage_rollup_daily
-- ============================================================================

-- Enable RLS
ALTER TABLE public.ai_usage_rollup_daily ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "ai_usage_rollup_daily_service_role_all" ON public.ai_usage_rollup_daily;

-- Create service_role-only policy
CREATE POLICY "ai_usage_rollup_daily_service_role_all"
ON public.ai_usage_rollup_daily
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Revoke all from public roles
REVOKE ALL ON TABLE public.ai_usage_rollup_daily FROM anon, authenticated;

-- Grant all to service_role
GRANT ALL ON TABLE public.ai_usage_rollup_daily TO service_role;

-- ============================================================================
-- PART 5: Re-confirm ai_usage_events security (idempotent)
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy to ensure correct state
DROP POLICY IF EXISTS "ai_usage_events_service_role_all" ON public.ai_usage_events;

CREATE POLICY "ai_usage_events_service_role_all"
ON public.ai_usage_events
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Revoke from public roles
REVOKE ALL ON TABLE public.ai_usage_events FROM anon, authenticated;

-- Grant to service_role
GRANT ALL ON TABLE public.ai_usage_events TO service_role;

-- ============================================================================
-- PART 6: Create helper function for upserting daily rollups
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_ai_usage_rollup(
    p_day date,
    p_feature text,
    p_model text,
    p_provider text DEFAULT 'openai',
    p_is_cache_hit boolean DEFAULT false,
    p_tokens_in integer DEFAULT 0,
    p_tokens_out integer DEFAULT 0,
    p_cost_cents integer DEFAULT 0,
    p_currency text DEFAULT 'usd'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.ai_usage_rollup_daily (
        day, feature, model, provider,
        calls, cache_hits, cache_misses,
        tokens_in, tokens_out, tokens_total,
        cost_cents, currency, updated_at
    )
    VALUES (
        p_day, p_feature, p_model, p_provider,
        1,
        CASE WHEN p_is_cache_hit THEN 1 ELSE 0 END,
        CASE WHEN p_is_cache_hit THEN 0 ELSE 1 END,
        p_tokens_in, p_tokens_out, p_tokens_in + p_tokens_out,
        p_cost_cents, p_currency, now()
    )
    ON CONFLICT (day, feature, model, provider)
    DO UPDATE SET
        calls = ai_usage_rollup_daily.calls + 1,
        cache_hits = ai_usage_rollup_daily.cache_hits + CASE WHEN p_is_cache_hit THEN 1 ELSE 0 END,
        cache_misses = ai_usage_rollup_daily.cache_misses + CASE WHEN p_is_cache_hit THEN 0 ELSE 1 END,
        tokens_in = ai_usage_rollup_daily.tokens_in + p_tokens_in,
        tokens_out = ai_usage_rollup_daily.tokens_out + p_tokens_out,
        tokens_total = ai_usage_rollup_daily.tokens_total + p_tokens_in + p_tokens_out,
        cost_cents = ai_usage_rollup_daily.cost_cents + p_cost_cents,
        updated_at = now();
END;
$$;

-- Grant execute only to service_role
REVOKE ALL ON FUNCTION public.upsert_ai_usage_rollup FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_ai_usage_rollup TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
