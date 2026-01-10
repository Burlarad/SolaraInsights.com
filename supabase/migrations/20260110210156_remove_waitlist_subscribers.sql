-- Remove waitlist feature entirely (table + policies + grants)
-- Rationale: no marketing waitlist flow in app yet; eliminate attack surface + confusion.

DO $$
DECLARE
  p RECORD;
BEGIN
  -- Drop ALL policies on the table (even if names differ across environments)
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'waitlist_subscribers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.waitlist_subscribers;', p.policyname);
  END LOOP;
END $$;

-- Revoke any lingering privileges (safe even if table is already gone)
REVOKE ALL ON TABLE public.waitlist_subscribers FROM anon, authenticated;

-- Drop the table (CASCADE to remove any dependent views/triggers that might exist)
DROP TABLE IF EXISTS public.waitlist_subscribers CASCADE;

