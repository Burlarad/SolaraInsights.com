-- Connections Mutual Unlock: is_mutual column + bidirectional trigger
-- Run this migration in Supabase SQL Editor
--
-- This adds mutual-checking infrastructure for Space Between gating:
-- - is_mutual column on connections table
-- - Composite index for fast reverse lookups
-- - Trigger function to maintain is_mutual flag bidirectionally

-- ============================================================================
-- 1. Add is_mutual column to connections table
-- ============================================================================
-- Denormalized flag maintained by trigger. Default false.

ALTER TABLE public.connections
ADD COLUMN IF NOT EXISTS is_mutual BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- 2. Create composite index for reverse connection lookups
-- ============================================================================
-- Used by trigger to find if B→A connection exists when A→B is created

CREATE INDEX IF NOT EXISTS idx_connections_linked_owner
ON public.connections(linked_profile_id, owner_user_id);

-- ============================================================================
-- 3. Create trigger function to maintain is_mutual flag
-- ============================================================================
-- On INSERT/UPDATE: Check if reverse connection exists and update both sides
-- On DELETE: Reset the other side's is_mutual to false

CREATE OR REPLACE FUNCTION maintain_mutual_flag()
RETURNS TRIGGER AS $$
DECLARE
  reverse_connection_id UUID;
BEGIN
  -- Handle INSERT and UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Only process if this connection has a linked_profile_id
    IF NEW.linked_profile_id IS NOT NULL THEN
      -- Find reverse connection: where the linked profile owns a connection
      -- that links back to this connection's owner
      SELECT id INTO reverse_connection_id
      FROM public.connections
      WHERE owner_user_id = NEW.linked_profile_id
        AND linked_profile_id = NEW.owner_user_id
      LIMIT 1;

      IF reverse_connection_id IS NOT NULL THEN
        -- Mutual connection exists! Update both sides
        NEW.is_mutual := TRUE;

        -- Update the reverse connection (if not already true)
        UPDATE public.connections
        SET is_mutual = TRUE
        WHERE id = reverse_connection_id
          AND is_mutual = FALSE;
      ELSE
        -- No reverse connection, ensure this one is not mutual
        NEW.is_mutual := FALSE;
      END IF;
    ELSE
      -- No linked profile, cannot be mutual
      NEW.is_mutual := FALSE;
    END IF;

    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    -- If this was a mutual connection, reset the other side
    IF OLD.is_mutual = TRUE AND OLD.linked_profile_id IS NOT NULL THEN
      UPDATE public.connections
      SET is_mutual = FALSE
      WHERE owner_user_id = OLD.linked_profile_id
        AND linked_profile_id = OLD.owner_user_id;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Create the trigger
-- ============================================================================
-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_maintain_mutual_flag ON public.connections;

CREATE TRIGGER trigger_maintain_mutual_flag
  BEFORE INSERT OR UPDATE OR DELETE ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION maintain_mutual_flag();

-- ============================================================================
-- 5. Backfill existing connections
-- ============================================================================
-- Set is_mutual = true for all existing bidirectional connection pairs

UPDATE public.connections c1
SET is_mutual = TRUE
WHERE c1.linked_profile_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.connections c2
    WHERE c2.owner_user_id = c1.linked_profile_id
      AND c2.linked_profile_id = c1.owner_user_id
  )
  AND c1.is_mutual = FALSE;

-- ============================================================================
-- Verification queries (run after migration to confirm)
-- ============================================================================
--
-- Check column exists:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'connections' AND column_name = 'is_mutual';
--
-- Check index exists:
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_connections_linked_owner';
--
-- Check trigger exists:
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_maintain_mutual_flag';
--
-- View mutual connections:
-- SELECT id, name, owner_user_id, linked_profile_id, is_mutual
-- FROM connections WHERE is_mutual = true;
--
