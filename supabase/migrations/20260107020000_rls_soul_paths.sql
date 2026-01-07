-- Migration: Add RLS policies to soul_paths table
-- Issue: RLS was enabled but NO policies existed, blocking all client queries
-- Solution: Add user-scoped policies + service role access

-- Ensure RLS is enabled (idempotent)
ALTER TABLE soul_paths ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies for clean slate
DROP POLICY IF EXISTS "soul_paths_select_own" ON soul_paths;
DROP POLICY IF EXISTS "soul_paths_insert_own" ON soul_paths;
DROP POLICY IF EXISTS "soul_paths_update_own" ON soul_paths;
DROP POLICY IF EXISTS "soul_paths_delete_own" ON soul_paths;
DROP POLICY IF EXISTS "soul_paths_service_role_all" ON soul_paths;

-- User can read their own soul path
CREATE POLICY "soul_paths_select_own" ON soul_paths
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- User can insert their own soul path
CREATE POLICY "soul_paths_insert_own" ON soul_paths
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- User can update their own soul path
CREATE POLICY "soul_paths_update_own" ON soul_paths
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User can delete their own soul path
CREATE POLICY "soul_paths_delete_own" ON soul_paths
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role has full access (for admin/cron operations)
CREATE POLICY "soul_paths_service_role_all" ON soul_paths
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add table comment documenting RLS
COMMENT ON TABLE soul_paths IS 'User birth chart computation cache. RLS: user-scoped (auth.uid() = user_id) + service_role full access.';
