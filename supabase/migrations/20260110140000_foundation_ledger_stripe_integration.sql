-- Foundation Ledger: Stripe Integration Schema
--
-- Adds columns for:
-- - Stripe event idempotency (stripe_event_id with UNIQUE constraint)
-- - Geographic location for marketing + give-back targeting
--
-- RLS: service_role only (no user access)

-- ============================================================================
-- SECTION 1: Add new columns to foundation_ledger
-- ============================================================================

DO $$
BEGIN
  -- stripe_event_id: For idempotency - ensures we don't double-count events
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'foundation_ledger'
    AND column_name = 'stripe_event_id'
  ) THEN
    ALTER TABLE public.foundation_ledger
    ADD COLUMN stripe_event_id text;

    RAISE NOTICE 'Added stripe_event_id column';
  END IF;

  -- country_code: ISO 3166-1 alpha-2 (e.g., "US", "GB", "DE")
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'foundation_ledger'
    AND column_name = 'country_code'
  ) THEN
    ALTER TABLE public.foundation_ledger
    ADD COLUMN country_code text;

    RAISE NOTICE 'Added country_code column';
  END IF;

  -- region_code: ISO 3166-2 format (e.g., "US-VA", "GB-ENG", "DE-BY")
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'foundation_ledger'
    AND column_name = 'region_code'
  ) THEN
    ALTER TABLE public.foundation_ledger
    ADD COLUMN region_code text;

    RAISE NOTICE 'Added region_code column';
  END IF;

  -- city: Free text city name (nullable)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'foundation_ledger'
    AND column_name = 'city'
  ) THEN
    ALTER TABLE public.foundation_ledger
    ADD COLUMN city text;

    RAISE NOTICE 'Added city column';
  END IF;

  -- user_id: Reference to profiles.id for attribution (nullable)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'foundation_ledger'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.foundation_ledger
    ADD COLUMN user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

    RAISE NOTICE 'Added user_id column';
  END IF;
END $$;

-- ============================================================================
-- SECTION 2: Create unique index for idempotency
-- ============================================================================

-- Unique index on stripe_event_id ensures we can't insert the same event twice
-- Using a partial index to allow NULL values (for non-Stripe ledger entries)
CREATE UNIQUE INDEX IF NOT EXISTS idx_foundation_ledger_stripe_event_id
ON public.foundation_ledger (stripe_event_id)
WHERE stripe_event_id IS NOT NULL;

-- Index for location-based queries (give-back targeting)
CREATE INDEX IF NOT EXISTS idx_foundation_ledger_country_code
ON public.foundation_ledger (country_code)
WHERE country_code IS NOT NULL;

-- Index for user attribution queries
CREATE INDEX IF NOT EXISTS idx_foundation_ledger_user_id
ON public.foundation_ledger (user_id)
WHERE user_id IS NOT NULL;

-- ============================================================================
-- SECTION 3: RLS + GRANTS (service_role only)
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.foundation_ledger ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (including the broken USING(false) one)
DROP POLICY IF EXISTS "foundation_ledger_service_rw" ON public.foundation_ledger;
DROP POLICY IF EXISTS "foundation_ledger_service_role_all" ON public.foundation_ledger;

-- Create proper service_role only policy
CREATE POLICY "foundation_ledger_service_role_all"
ON public.foundation_ledger
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Lock down grants
REVOKE ALL ON TABLE public.foundation_ledger FROM anon, authenticated;
GRANT ALL ON TABLE public.foundation_ledger TO service_role;

-- ============================================================================
-- SECTION 4: Add comment explaining the table
-- ============================================================================

COMMENT ON TABLE public.foundation_ledger IS
'Financial ledger for Solara Foundation give-back program.
Tracks accruals (from Stripe payments) and disbursements (charitable donations).
Service-role only access - no direct user access.';

COMMENT ON COLUMN public.foundation_ledger.stripe_event_id IS
'Stripe event ID for idempotency. Unique constraint prevents duplicate processing.';

COMMENT ON COLUMN public.foundation_ledger.country_code IS
'ISO 3166-1 alpha-2 country code from billing address (e.g., "US", "GB").';

COMMENT ON COLUMN public.foundation_ledger.region_code IS
'ISO 3166-2 region code (e.g., "US-VA", "GB-ENG"). Format: {country}-{region}.';

COMMENT ON COLUMN public.foundation_ledger.city IS
'City name from billing address. Used for local give-back targeting.';

COMMENT ON COLUMN public.foundation_ledger.user_id IS
'Reference to profiles.id for user attribution. SET NULL on user deletion.';

-- ============================================================================
-- SECTION 5: Verification
-- ============================================================================

DO $$
DECLARE
  col_count int;
  idx_count int;
  policy_count int;
BEGIN
  -- Count new columns
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'foundation_ledger'
  AND column_name IN ('stripe_event_id', 'country_code', 'region_code', 'city', 'user_id');

  -- Count new indexes
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND tablename = 'foundation_ledger'
  AND indexname LIKE 'idx_foundation_ledger_%';

  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename = 'foundation_ledger';

  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'FOUNDATION LEDGER MIGRATION COMPLETE';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'New columns added: %', col_count;
  RAISE NOTICE 'Indexes present: %', idx_count;
  RAISE NOTICE 'Policies present: %', policy_count;
END $$;
