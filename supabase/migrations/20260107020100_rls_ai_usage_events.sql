-- Migration: Add RLS policies to ai_usage_events table
-- Issue: RLS was enabled but NO policies existed
-- Decision: This is an INTERNAL table for AI cost tracking
--   - Writes: service role only (from lib/ai/trackUsage.ts)
--   - Reads: service role only (from scripts/ai-usage-report.ts)
--   - Users do NOT need to query their own usage (no user-facing feature)

-- Ensure RLS is enabled (idempotent)
ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies for clean slate
DROP POLICY IF EXISTS "ai_usage_events_service_role_all" ON ai_usage_events;

-- Service role has full access (internal tracking table)
CREATE POLICY "ai_usage_events_service_role_all" ON ai_usage_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add table comment documenting RLS decision
COMMENT ON TABLE ai_usage_events IS 'Internal AI usage tracking for cost control. Service role access only. Not user-facing.';
