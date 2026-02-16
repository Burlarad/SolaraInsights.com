-- Space Between Reports: schema fixes for quarterly refresh + linked data
-- Fixes: BLOCKER 1 (INSERT fails), BLOCKER 4 (quarterly refresh), WARNING (missing column)
--
-- Changes:
-- 1. Add linked_profile_id column (referenced in INSERT but missing from table)
-- 2. Add INSERT policy so authenticated users can write their own reports
--    (BLOCKER 1 fix — route now uses admin client, but policy is defense-in-depth)
-- 3. Add UPDATE policy so admin UPSERT can update existing rows
--    (BLOCKER 4 fix — quarterly refresh overwrites via UPSERT)

-- ============================================================================
-- 1. Add linked_profile_id column
-- ============================================================================

ALTER TABLE public.space_between_reports
ADD COLUMN IF NOT EXISTS linked_profile_id uuid;

-- ============================================================================
-- 2. Add INSERT policy for authenticated users (owner can insert own reports)
-- ============================================================================
-- Defense-in-depth: the route uses admin client, but this policy ensures
-- even if code changes, users can only insert rows they own.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'space_between_reports'
      AND policyname = 'space_between_insert_own'
  ) THEN
    CREATE POLICY "space_between_insert_own"
      ON public.space_between_reports
      FOR INSERT
      WITH CHECK (owner_user_id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- 3. Add UPDATE policy for authenticated users (owner can update own reports)
-- ============================================================================
-- Required for UPSERT (INSERT ... ON CONFLICT UPDATE) to work with user session.
-- Defense-in-depth: route uses admin client, but this keeps things safe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'space_between_reports'
      AND policyname = 'space_between_update_own'
  ) THEN
    CREATE POLICY "space_between_update_own"
      ON public.space_between_reports
      FOR UPDATE
      USING (owner_user_id = auth.uid())
      WITH CHECK (owner_user_id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- 4. Backfill linked_profile_id from connections table where possible
-- ============================================================================
-- Safe: only updates rows where linked_profile_id is NULL and connection has one

UPDATE public.space_between_reports sbr
SET linked_profile_id = c.linked_profile_id
FROM public.connections c
WHERE sbr.connection_id = c.id
  AND sbr.linked_profile_id IS NULL
  AND c.linked_profile_id IS NOT NULL;
