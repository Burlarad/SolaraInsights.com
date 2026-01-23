

-- Migration: add cost_micros to ai_usage_events for precise cost accounting
-- Date: 2026-01-22
-- Notes:
-- - We keep existing columns (estimated_cost_usd, cost_cents) for backward compatibility.
-- - Backfill cost_micros from estimated_cost_usd when available.
-- - If estimated_cost_usd is null, we backfill from cost_cents for USD rows.

BEGIN;

-- 1) Add the micros column (idempotent)
ALTER TABLE public.ai_usage_events
  ADD COLUMN IF NOT EXISTS cost_micros bigint;

-- 2) Backfill from estimated_cost_usd (numeric dollars -> micros)
--    Example: $0.012345 -> 12345 micros
UPDATE public.ai_usage_events
SET cost_micros = ROUND(estimated_cost_usd * 1000000)::bigint
WHERE cost_micros IS NULL
  AND estimated_cost_usd IS NOT NULL;

-- 3) Fallback backfill for USD cents (only if still null)
--    Example: 12 cents -> 0.12 USD -> 120000 micros
UPDATE public.ai_usage_events
SET cost_micros = (cost_cents::bigint * 10000)
WHERE cost_micros IS NULL
  AND cost_cents IS NOT NULL
  AND (currency IS NULL OR currency = 'USD');

COMMIT;