-- Performance indexes for Solara
-- Run this migration in Supabase SQL Editor

-- Index for cron job queries on profiles.last_seen_at
-- Used by /api/cron/prewarm-insights to find recently active users
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at
ON profiles(last_seen_at DESC NULLS LAST);

-- Index for telemetry queries on ai_usage_events
-- Used for cost monitoring and analytics
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_route_created
ON ai_usage_events(route, created_at DESC);

-- Index for soul_paths lookups by user
CREATE INDEX IF NOT EXISTS idx_soul_paths_user_id
ON soul_paths(user_id);

-- Index for connections by owner
CREATE INDEX IF NOT EXISTS idx_connections_owner
ON connections(owner_user_id);

-- Index for journal entries by user and date
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date
ON journal_entries(user_id, entry_date DESC);
