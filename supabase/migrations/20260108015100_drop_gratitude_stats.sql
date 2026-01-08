-- Migration: Drop unused gratitude_stats (unused + empty + wide grants)
-- Safe: verified 0 rows and 0 FK references

BEGIN;

DROP TABLE IF EXISTS public.gratitude_stats CASCADE;

COMMIT;
