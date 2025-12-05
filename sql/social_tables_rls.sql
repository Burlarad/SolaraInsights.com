-- ============================================================================
-- ENABLE RLS FOR SOCIAL TABLES
-- ============================================================================
-- These tables already exist in the database but need RLS policies.
-- Run this SQL in your Supabase SQL Editor to secure social_connections
-- and social_summaries tables.

-- Enable RLS on social_connections
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_connections
CREATE POLICY "Users can view their own social connections"
  ON public.social_connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social connections"
  ON public.social_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social connections"
  ON public.social_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social connections"
  ON public.social_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS on social_summaries
ALTER TABLE public.social_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_summaries
CREATE POLICY "Users can view their own social summaries"
  ON public.social_summaries
  FOR SELECT
  USING (auth.uid() = user_id);

-- NOTE: INSERT/UPDATE/DELETE for social_summaries may be restricted to service role only.
-- If you want to allow service role only for write operations, use these policies instead:
--
-- CREATE POLICY "Service role can insert social summaries"
--   ON public.social_summaries
--   FOR INSERT
--   WITH CHECK (true);
--
-- CREATE POLICY "Service role can update social summaries"
--   ON public.social_summaries
--   FOR UPDATE
--   USING (true);
--
-- CREATE POLICY "Service role can delete social summaries"
--   ON public.social_summaries
--   FOR DELETE
--   USING (true);
--
-- These service role policies will only work when using the service_role key,
-- not the anon/authenticated keys. For now, we're leaving INSERT/UPDATE/DELETE
-- without policies, which means they'll be blocked by RLS by default.
-- You can add specific policies later as needed for your background jobs.
