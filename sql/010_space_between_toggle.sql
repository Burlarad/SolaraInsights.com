-- Space Between Toggle + Dual Consent Unlock
-- Run this migration in Supabase SQL Editor
--
-- Adds:
-- - space_between_enabled: per-connection toggle for consent
-- - is_space_between_unlocked: computed flag (mutual + both toggles ON)
-- - Updated trigger to maintain is_space_between_unlocked

-- ============================================================================
-- 1. Add new columns to connections table
-- ============================================================================

-- User's consent toggle for this specific connection
ALTER TABLE public.connections
ADD COLUMN IF NOT EXISTS space_between_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Computed unlock status: is_mutual AND both parties have space_between_enabled
ALTER TABLE public.connections
ADD COLUMN IF NOT EXISTS is_space_between_unlocked BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- 2. Replace trigger function with updated logic
-- ============================================================================
-- Now maintains both is_mutual AND is_space_between_unlocked

CREATE OR REPLACE FUNCTION maintain_mutual_and_unlock_flags()
RETURNS TRIGGER AS $$
DECLARE
  reverse_connection RECORD;
BEGIN
  -- Handle INSERT and UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Only process if this connection has a linked_profile_id
    IF NEW.linked_profile_id IS NOT NULL THEN
      -- Find reverse connection: where the linked profile owns a connection
      -- that links back to this connection's owner
      SELECT id, space_between_enabled INTO reverse_connection
      FROM public.connections
      WHERE owner_user_id = NEW.linked_profile_id
        AND linked_profile_id = NEW.owner_user_id
      LIMIT 1;

      IF reverse_connection.id IS NOT NULL THEN
        -- Mutual connection exists!
        NEW.is_mutual := TRUE;

        -- Space Between unlocked only if BOTH parties have it enabled
        NEW.is_space_between_unlocked := (
          NEW.space_between_enabled = TRUE AND
          reverse_connection.space_between_enabled = TRUE
        );

        -- Update the reverse connection's is_mutual (if not already true)
        -- Also update its is_space_between_unlocked based on both toggles
        UPDATE public.connections
        SET
          is_mutual = TRUE,
          is_space_between_unlocked = (
            space_between_enabled = TRUE AND
            NEW.space_between_enabled = TRUE
          )
        WHERE id = reverse_connection.id
          AND (
            is_mutual = FALSE OR
            is_space_between_unlocked != (
              space_between_enabled = TRUE AND
              NEW.space_between_enabled = TRUE
            )
          );
      ELSE
        -- No reverse connection, not mutual, not unlocked
        NEW.is_mutual := FALSE;
        NEW.is_space_between_unlocked := FALSE;
      END IF;
    ELSE
      -- No linked profile, cannot be mutual or unlocked
      NEW.is_mutual := FALSE;
      NEW.is_space_between_unlocked := FALSE;
    END IF;

    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    -- If this was linked, reset the other side's mutual and unlock status
    IF OLD.linked_profile_id IS NOT NULL THEN
      UPDATE public.connections
      SET
        is_mutual = FALSE,
        is_space_between_unlocked = FALSE
      WHERE owner_user_id = OLD.linked_profile_id
        AND linked_profile_id = OLD.owner_user_id;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Replace the trigger (drop old, create new)
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_maintain_mutual_flag ON public.connections;
DROP TRIGGER IF EXISTS trigger_maintain_mutual_and_unlock ON public.connections;

CREATE TRIGGER trigger_maintain_mutual_and_unlock
  BEFORE INSERT OR UPDATE OR DELETE ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION maintain_mutual_and_unlock_flags();

-- ============================================================================
-- 4. Backfill existing connections
-- ============================================================================
-- Recompute is_mutual and is_space_between_unlocked for all existing connections

-- First pass: set is_mutual where both sides are linked
UPDATE public.connections c1
SET is_mutual = TRUE
WHERE c1.linked_profile_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.connections c2
    WHERE c2.owner_user_id = c1.linked_profile_id
      AND c2.linked_profile_id = c1.owner_user_id
  )
  AND c1.is_mutual = FALSE;

-- Second pass: set is_space_between_unlocked where mutual AND both enabled
UPDATE public.connections c1
SET is_space_between_unlocked = TRUE
WHERE c1.is_mutual = TRUE
  AND c1.space_between_enabled = TRUE
  AND EXISTS (
    SELECT 1 FROM public.connections c2
    WHERE c2.owner_user_id = c1.linked_profile_id
      AND c2.linked_profile_id = c1.owner_user_id
      AND c2.space_between_enabled = TRUE
  )
  AND c1.is_space_between_unlocked = FALSE;

-- ============================================================================
-- 5. Drop old function if it exists
-- ============================================================================

DROP FUNCTION IF EXISTS maintain_mutual_flag();

-- ============================================================================
-- Verification queries (run after migration to confirm)
-- ============================================================================
--
-- Check new columns exist:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'connections'
--   AND column_name IN ('space_between_enabled', 'is_space_between_unlocked');
--
-- Check trigger exists:
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_maintain_mutual_and_unlock';
--
-- View unlocked connections:
-- SELECT id, name, is_mutual, space_between_enabled, is_space_between_unlocked
-- FROM connections WHERE is_mutual = true;
--
