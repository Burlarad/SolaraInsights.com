-- Library Checkouts: per-user shelf tracking for library books
--
-- Tracks which books (astrology charts, numerology profiles) a user has
-- checked out from the global library. Enables "Book X of N" counter
-- and book switching in the UI.

-- ============================================================================
-- 1. CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_type text NOT NULL CHECK (book_type IN ('astrology', 'numerology')),
  book_key text NOT NULL,
  label text,                -- Human-readable label, e.g. "Apr 15 1990 · NYC"
  created_at timestamptz NOT NULL DEFAULT now(),
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_type, book_key)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Shelf queries: fetch all books for a user by type
CREATE INDEX IF NOT EXISTS idx_library_checkouts_user_type
  ON public.library_checkouts(user_id, book_type, last_opened_at DESC);

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.library_checkouts ENABLE ROW LEVEL SECURITY;

-- Users can read their own shelf
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'library_checkouts'
      AND policyname = 'library_checkouts_select_own'
  ) THEN
    CREATE POLICY "library_checkouts_select_own"
      ON public.library_checkouts
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Users can add to their own shelf
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'library_checkouts'
      AND policyname = 'library_checkouts_insert_own'
  ) THEN
    CREATE POLICY "library_checkouts_insert_own"
      ON public.library_checkouts
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Users can update their own shelf entries (last_opened_at)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'library_checkouts'
      AND policyname = 'library_checkouts_update_own'
  ) THEN
    CREATE POLICY "library_checkouts_update_own"
      ON public.library_checkouts
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Users can remove from their own shelf
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'library_checkouts'
      AND policyname = 'library_checkouts_delete_own'
  ) THEN
    CREATE POLICY "library_checkouts_delete_own"
      ON public.library_checkouts
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Service role full access (for admin operations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'library_checkouts'
      AND policyname = 'library_checkouts_service_role_all'
  ) THEN
    CREATE POLICY "library_checkouts_service_role_all"
      ON public.library_checkouts
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.library_checkouts IS
  'Per-user shelf tracking for library books. Enables "Book X of N" counter and book switching. Each row = one book a user has checked out.';
