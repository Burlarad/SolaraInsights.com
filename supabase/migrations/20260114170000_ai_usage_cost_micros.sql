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
--
-- IMPORTANT: Some environments already have an older ai_usage_rollup_daily table
-- with columns like (day, feature, calls, tokens_in, cost_cents, ...).
-- This migration makes sure the v2 schema exists with usage_date + micros.
-- -----------------------------

-- If a legacy ai_usage_rollup_daily exists (older schema uses `day`/`feature`/`calls`/`cost_cents`),
-- rename it out of the way so we can create the new v2 table with `usage_date` + micros.
DO $$
BEGIN
  IF to_regclass('public.ai_usage_rollup_daily') IS NOT NULL THEN
    -- legacy schema check: has `day` but not `usage_date`
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ai_usage_rollup_daily'
        AND column_name = 'day'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ai_usage_rollup_daily'
        AND column_name = 'usage_date'
    ) THEN
      IF to_regclass('public.ai_usage_rollup_daily_legacy') IS NULL THEN
        ALTER TABLE public.ai_usage_rollup_daily RENAME TO ai_usage_rollup_daily_legacy;
      ELSE
        DROP TABLE public.ai_usage_rollup_daily;
      END IF;
    END IF;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.ai_usage_rollup_daily (
  usage_date date NOT NULL,
  provider text NOT NULL DEFAULT 'openai',
  currency text NOT NULL DEFAULT 'usd',
  feature_label text NOT NULL,
  route text,
  model text NOT NULL,
  prompt_version text,
  user_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',

  request_count bigint NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  total_tokens bigint NOT NULL DEFAULT 0,
  cost_micros bigint NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure the conflict target exists BEFORE any backfill that uses ON CONFLICT.
-- Some environments may already have a different PRIMARY KEY (e.g., legacy `id`).
-- We only need a UNIQUE constraint on the conflict columns for the backfill to work.
DO $$
BEGIN
  -- If we *don't* have our intended composite PK, ensure a UNIQUE constraint exists
  -- for (usage_date, provider, currency, feature_label, model, user_id) so ON CONFLICT works.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'ai_usage_rollup_daily'
      AND c.conname = 'ai_usage_rollup_daily_pk'
      AND c.contype = 'p'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'ai_usage_rollup_daily'
        AND c.conname = 'ai_usage_rollup_daily_conflict_uk'
        AND c.contype IN ('u','p')
    ) THEN
      ALTER TABLE public.ai_usage_rollup_daily
        ADD CONSTRAINT ai_usage_rollup_daily_conflict_uk
        UNIQUE (usage_date, provider, currency, feature_label, model, user_id);
    END IF;
  END IF;
END;
$$;

-- Backfill from legacy table (if we had to rename it) so historical totals aren't lost.
-- Keep this robust: only rely on legacy columns we know exist (day, feature, calls, cost_cents).
DO $$
BEGIN
  IF to_regclass('public.ai_usage_rollup_daily_legacy') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='ai_usage_rollup_daily_legacy' AND column_name='day'
     )
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='ai_usage_rollup_daily_legacy' AND column_name='feature'
     )
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='ai_usage_rollup_daily_legacy' AND column_name='calls'
     )
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='ai_usage_rollup_daily_legacy' AND column_name='cost_cents'
     )
  THEN
    -- Make sure the ON CONFLICT target exists *inside the same statement* as the backfill.
    -- This avoids any migration-runner statement-order/parsing weirdness with DO blocks.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'ai_usage_rollup_daily'
        AND c.conname = 'ai_usage_rollup_daily_conflict_uk'
        AND c.contype = 'u'
    ) THEN
      BEGIN
        ALTER TABLE public.ai_usage_rollup_daily
          ADD CONSTRAINT ai_usage_rollup_daily_conflict_uk
          UNIQUE (usage_date, provider, currency, feature_label, model, user_id);
      EXCEPTION
        WHEN duplicate_object THEN
          -- Constraint already exists (race/redo). Safe to ignore.
          NULL;
      END;
    END IF;

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
      created_at,
      updated_at
    )
    SELECT
      l.day AS usage_date,
      'openai' AS provider,
      'usd' AS currency,
      l.feature AS feature_label,
      NULL::text AS route,
      'unknown' AS model,
      NULL::text AS prompt_version,
      '00000000-0000-0000-0000-000000000000'::uuid AS user_id,
      COALESCE(l.calls, 0)::bigint AS request_count,
      0::bigint AS input_tokens,
      0::bigint AS output_tokens,
      0::bigint AS total_tokens,
      (COALESCE(l.cost_cents, 0)::bigint * 10000) AS cost_micros,
      now() AS created_at,
      now() AS updated_at
    FROM public.ai_usage_rollup_daily_legacy l
    ON CONFLICT ON CONSTRAINT ai_usage_rollup_daily_conflict_uk DO NOTHING;
  END IF;
END;
$$;

DO $$
DECLARE
  v_pk text;
BEGIN
  -- Rename legacy columns to the new names
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='day'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='usage_date'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily RENAME COLUMN day TO usage_date';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='feature'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='feature_label'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily RENAME COLUMN feature TO feature_label';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='calls'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='request_count'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily RENAME COLUMN calls TO request_count';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='tokens_in'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='input_tokens'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily RENAME COLUMN tokens_in TO input_tokens';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='tokens_out'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='output_tokens'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily RENAME COLUMN tokens_out TO output_tokens';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='tokens_total'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='total_tokens'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily RENAME COLUMN tokens_total TO total_tokens';
  END IF;

  -- Add new columns that didn't exist before
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='route'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ADD COLUMN route text';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='prompt_version'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ADD COLUMN prompt_version text';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='user_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ADD COLUMN user_id uuid';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='currency'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ADD COLUMN currency text NOT NULL DEFAULT ''usd''';
  END IF;

  -- cost_micros: if old cost_cents exists, convert it, then drop it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='cost_micros'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ADD COLUMN cost_micros bigint NOT NULL DEFAULT 0';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='cost_cents'
  ) THEN
    -- Backfill micros from cents when possible (1 cent = 10,000 micros)
    EXECUTE 'UPDATE public.ai_usage_rollup_daily SET cost_micros = COALESCE(cost_micros, 0) + (COALESCE(cost_cents, 0)::bigint * 10000)';
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily DROP COLUMN cost_cents';
  END IF;

  -- Drop legacy cache columns if they exist (not part of the new rollup schema)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='cache_hits'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily DROP COLUMN cache_hits';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='cache_misses'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily DROP COLUMN cache_misses';
  END IF;

  -- Drop legacy surrogate id (we want a composite primary key)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_rollup_daily' AND column_name='id'
  ) THEN
    -- Drop any existing primary key constraint (usually on id)
    SELECT c.conname INTO v_pk
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public' AND t.relname='ai_usage_rollup_daily' AND c.contype='p'
    LIMIT 1;

    IF v_pk IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.ai_usage_rollup_daily DROP CONSTRAINT %I', v_pk);
      v_pk := NULL;
    END IF;
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily DROP COLUMN id';
  END IF;

  -- Ensure NOT NULL + defaults on required columns
  EXECUTE 'UPDATE public.ai_usage_rollup_daily SET provider = COALESCE(provider, ''openai'')';
  EXECUTE 'UPDATE public.ai_usage_rollup_daily SET currency = COALESCE(currency, ''usd'')';

  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN provider SET DEFAULT ''openai''';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN currency SET DEFAULT ''usd''';

  EXECUTE 'UPDATE public.ai_usage_rollup_daily SET model = COALESCE(model, ''unknown'')';
  EXECUTE 'UPDATE public.ai_usage_rollup_daily SET feature_label = COALESCE(feature_label, ''unknown'')';
  EXECUTE 'UPDATE public.ai_usage_rollup_daily SET usage_date = COALESCE(usage_date, (now() AT TIME ZONE ''UTC'')::date)';
  EXECUTE 'UPDATE public.ai_usage_rollup_daily SET user_id = COALESCE(user_id, ''00000000-0000-0000-0000-000000000000''::uuid)';

  -- These columns should exist by now; set safe defaults and enforce non-null
  EXECUTE 'UPDATE public.ai_usage_rollup_daily SET request_count = COALESCE(request_count, 0)';
  EXECUTE 'UPDATE public.ai_usage_rollup_daily SET input_tokens = COALESCE(input_tokens, 0)';
  EXECUTE 'UPDATE public.ai_usage_rollup_daily SET output_tokens = COALESCE(output_tokens, 0)';
  EXECUTE 'UPDATE public.ai_usage_rollup_daily SET total_tokens = COALESCE(total_tokens, 0)';
  EXECUTE 'UPDATE public.ai_usage_rollup_daily SET cost_micros = COALESCE(cost_micros, 0)';

  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN request_count SET DEFAULT 0';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN input_tokens SET DEFAULT 0';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN output_tokens SET DEFAULT 0';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN total_tokens SET DEFAULT 0';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN cost_micros SET DEFAULT 0';

  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN user_id SET DEFAULT ''00000000-0000-0000-0000-000000000000''';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN user_id SET NOT NULL';

  -- Enforce NOT NULL where required
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN provider SET NOT NULL';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN currency SET NOT NULL';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN model SET NOT NULL';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN feature_label SET NOT NULL';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN usage_date SET NOT NULL';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN request_count SET NOT NULL';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN input_tokens SET NOT NULL';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN output_tokens SET NOT NULL';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN total_tokens SET NOT NULL';
  EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ALTER COLUMN cost_micros SET NOT NULL';

  -- Add the composite primary key if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public' AND t.relname='ai_usage_rollup_daily' AND c.contype='p'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_usage_rollup_daily ADD CONSTRAINT ai_usage_rollup_daily_pk PRIMARY KEY (usage_date, provider, currency, feature_label, model, user_id)';
  END IF;
END $$;

ALTER TABLE public.ai_usage_rollup_daily
  ENABLE ROW LEVEL SECURITY;

-- Indexes (now that the correct columns exist)
CREATE INDEX IF NOT EXISTS idx_ai_usage_rollup_daily_date
  ON public.ai_usage_rollup_daily (usage_date);

CREATE INDEX IF NOT EXISTS idx_ai_usage_rollup_daily_feature_date
  ON public.ai_usage_rollup_daily (feature_label, usage_date);

CREATE INDEX IF NOT EXISTS idx_ai_usage_rollup_daily_model_date
  ON public.ai_usage_rollup_daily (model, usage_date);

CREATE INDEX IF NOT EXISTS idx_ai_usage_rollup_daily_user_date
  ON public.ai_usage_rollup_daily (user_id, usage_date);

-- RLS: service_role only
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
    COALESCE(p_feature_label, 'unknown'),
    p_route,
    COALESCE(p_model, 'unknown'),
    p_prompt_version,
    COALESCE(p_user_id, '00000000-0000-0000-0000-000000000000'),
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