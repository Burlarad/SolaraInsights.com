BEGIN;

DROP VIEW IF EXISTS public.vw_foundation_monthly;

DO $$
BEGIN
  IF to_regclass('public.foundation_ledger') IS NOT NULL THEN
    EXECUTE $sql$
      DROP POLICY IF EXISTS "foundation_ledger_service_rw"
      ON public.foundation_ledger
    $sql$;
  END IF;
END $$;

DROP TABLE IF EXISTS public.gratitude_stats;
DROP TABLE IF EXISTS public.foundation_ledger;

COMMIT;
