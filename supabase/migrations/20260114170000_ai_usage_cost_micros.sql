

-- Migration: AI usage cost tracking (micros) + daily rollups
-- Goal:
-- 1) Store per-request token usage and cost in ai_usage_events
-- 2) Maintain a fast daily rollup table for dashboards/audits
-- 3) Keep everything service_role only (no user access)

BEGIN;

-- -----------------------------
-- 1) ai_usage_events: add cost + metadata fields (idempotent)
-- -----------------------------
ALTER TABLE IF EXISTS public.ai_usage_events
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.ai_usage_events
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS cost_micros bigint,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS meta jsonb;

-- Defaults (safe for existing rows)
UPDATE public.ai_usage_events
SET
  provider = COALESCE(provider, 'openai'),
  currency = COALESCE(currency, 'usd'),
  cost_micros = COALESCE(cost_micros, 0),
  meta = COALESCE(meta, '{}'::jsonb)
WHERE
  provider IS NULL
  OR currency IS NULL
  OR cost_micros IS NULL
  OR meta IS NULL;

ALTER TABLE public.ai_usage_events
  ALTER COLUMN provider SET DEFAULT 'openai',
  ALTER COLUMN currency SET DEFAULT 'usd',
  ALTER COLUMN cost_micros SET DEFAULT 0,
  ALTER COLUMN meta SET DEFAULT '{}'::jsonb;

-- Helpful indexes for audits
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created_at
  ON public.ai_usage_events (created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_feature_created_at
  ON public.ai_usage_events (feature_label, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_model_created_at
  ON public.ai_usage_events (model, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_created_at
  ON public.ai_usage_events (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_provider_created_at
  ON public.ai_usage_events (provider, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_request_id
  ON public.ai_usage_events (request_id);

-- RLS: service_role only
DROP POLICY IF EXISTS "ai_usage_events_service_role_all" ON public.ai_usage_events;
CREATE POLICY "ai_usage_events_service_role_all"
  ON public.ai_usage_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.ai_usage_events FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_usage_events TO service_role;


-- -----------------------------
-- 2) Daily rollup table for fast totals
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_rollup_daily (
  usage_date date NOT NULL,
  provider text NOT NULL DEFAULT 'openai',
  currency text NOT NULL DEFAULT 'usd',
  feature_label text NOT NULL,
  route text,
  model text NOT NULL,
  prompt_version text,
  user_id uuid,

  request_count bigint NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  total_tokens bigint NOT NULL DEFAULT 0,
  cost_micros bigint NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ai_usage_rollup_daily_pk PRIMARY KEY (
    usage_date,
    provider,
    currency,
    feature_label,
    model,
    user_id
  )
);

ALTER TABLE public.ai_usage_rollup_daily
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_usage_rollup_daily_date
  ON public.ai_usage_rollup_daily (usage_date);

CREATE INDEX IF NOT EXISTS idx_ai_usage_rollup_daily_feature_date
  ON public.ai_usage_rollup_daily (feature_label, usage_date);

CREATE INDEX IF NOT EXISTS idx_ai_usage_rollup_daily_model_date
  ON public.ai_usage_rollup_daily (model, usage_date);

CREATE INDEX IF NOT EXISTS idx_ai_usage_rollup_daily_user_date
  ON public.ai_usage_rollup_daily (user_id, usage_date);

DROP POLICY IF EXISTS "ai_usage_rollup_daily_service_role_all" ON public.ai_usage_rollup_daily;
CREATE POLICY "ai_usage_rollup_daily_service_role_all"
  ON public.ai_usage_rollup_daily
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.ai_usage_rollup_daily FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_usage_rollup_daily TO service_role;


-- -----------------------------
-- 3) Upsert helper for atomic rollup updates
-- -----------------------------
CREATE OR REPLACE FUNCTION public.upsert_ai_usage_rollup_daily(
  p_created_at timestamptz,
  p_provider text,
  p_currency text,
  p_feature_label text,
  p_route text,
  p_model text,
  p_prompt_version text,
  p_user_id uuid,
  p_input_tokens bigint,
  p_output_tokens bigint,
  p_total_tokens bigint,
  p_cost_micros bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date date := (p_created_at AT TIME ZONE 'UTC')::date;
BEGIN
  INSERT INTO public.ai_usage_rollup_daily (
    usage_date,
    provider,
    currency,
    feature_label,
    route,
    model,
    prompt_version,
    user_id,
    request_count,
    input_tokens,
    output_tokens,
    total_tokens,
    cost_micros,
    updated_at
  ) VALUES (
    v_date,
    COALESCE(p_provider, 'openai'),
    COALESCE(p_currency, 'usd'),
    p_feature_label,
    p_route,
    p_model,
    p_prompt_version,
    p_user_id,
    1,
    COALESCE(p_input_tokens, 0),
    COALESCE(p_output_tokens, 0),
    COALESCE(p_total_tokens, 0),
    COALESCE(p_cost_micros, 0),
    now()
  )
  ON CONFLICT (usage_date, provider, currency, feature_label, model, user_id)
  DO UPDATE SET
    request_count = public.ai_usage_rollup_daily.request_count + 1,
    input_tokens = public.ai_usage_rollup_daily.input_tokens + EXCLUDED.input_tokens,
    output_tokens = public.ai_usage_rollup_daily.output_tokens + EXCLUDED.output_tokens,
    total_tokens = public.ai_usage_rollup_daily.total_tokens + EXCLUDED.total_tokens,
    cost_micros = public.ai_usage_rollup_daily.cost_micros + EXCLUDED.cost_micros,
    route = COALESCE(EXCLUDED.route, public.ai_usage_rollup_daily.route),
    prompt_version = COALESCE(EXCLUDED.prompt_version, public.ai_usage_rollup_daily.prompt_version),
    updated_at = now();
END;
$$;

-- Restrict who can execute the function
REVOKE ALL ON FUNCTION public.upsert_ai_usage_rollup_daily(
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  bigint,
  bigint,
  bigint,
  bigint
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_ai_usage_rollup_daily(
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  bigint,
  bigint,
  bigint,
  bigint
) TO service_role;

COMMIT;