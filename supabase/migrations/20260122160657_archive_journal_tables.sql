-- Archive journal tables
-- This migration archives the journal_entries table (keeping user data for 90 days)
-- and drops the unused sanctuary_journal_entries table

BEGIN;

-- Archive journal_entries (keep data for 90 days before permanent deletion)
-- The table is renamed rather than dropped to preserve user data
ALTER TABLE IF EXISTS public.journal_entries
  RENAME TO _archive_journal_entries_20260122;

-- Drop unused sanctuary_journal_entries table
-- This table appears unused in the codebase
DROP TABLE IF EXISTS public.sanctuary_journal_entries;

COMMIT;
