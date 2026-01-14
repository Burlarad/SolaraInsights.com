-- ============================================================================
-- VERIFICATION: AI Usage Tracking Tables
-- ============================================================================
-- Run these queries after applying migration to verify correct setup.
-- Execute with: psql $DATABASE_URL -f verification_ai_usage_tracking.sql
-- Or in Supabase Studio SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. Verify table structure
-- ============================================================================

-- Check ai_usage_events columns
SELECT
    'ai_usage_events' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'ai_usage_events'
ORDER BY ordinal_position;

-- Check ai_usage_rollup_daily columns
SELECT
    'ai_usage_rollup_daily' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'ai_usage_rollup_daily'
ORDER BY ordinal_position;

-- ============================================================================
-- 2. Verify RLS is enabled
-- ============================================================================

SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('ai_usage_events', 'ai_usage_rollup_daily')
ORDER BY tablename;

-- ============================================================================
-- 3. Verify RLS policies (should be service_role only)
-- ============================================================================

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('ai_usage_events', 'ai_usage_rollup_daily')
ORDER BY tablename, policyname;

-- ============================================================================
-- 4. Verify GRANTS (anon/authenticated should have NO access)
-- ============================================================================

-- Check table privileges
SELECT
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND table_name IN ('ai_usage_events', 'ai_usage_rollup_daily')
ORDER BY table_name, grantee;

-- Check function privileges for upsert_ai_usage_rollup
SELECT
    routine_schema,
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
AND routine_name = 'upsert_ai_usage_rollup';

-- ============================================================================
-- 5. Verify indexes exist
-- ============================================================================

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('ai_usage_events', 'ai_usage_rollup_daily')
ORDER BY tablename, indexname;

-- ============================================================================
-- 6. Test insert works for service_role (will fail for anon/authenticated)
-- ============================================================================

-- This should SUCCEED when run as service_role:
-- INSERT INTO public.ai_usage_events (
--     feature_label, route, model, cache_status,
--     input_tokens, output_tokens, total_tokens,
--     cost_cents, provider, meta
-- ) VALUES (
--     'Test Feature', '/api/test', 'gpt-4o-mini', 'miss',
--     100, 50, 150,
--     1, 'openai', '{"test": true}'::jsonb
-- );

-- ============================================================================
-- 7. Verify rollup function exists and has correct signature
-- ============================================================================

SELECT
    proname as function_name,
    proargnames as argument_names,
    proargtypes::regtype[] as argument_types,
    prosecdef as security_definer
FROM pg_proc
WHERE proname = 'upsert_ai_usage_rollup'
AND pronamespace = 'public'::regnamespace;

-- ============================================================================
-- 8. Sample queries for daily/weekly/monthly aggregation
-- ============================================================================

-- Daily totals (last 7 days)
-- SELECT
--     day,
--     SUM(calls) as total_calls,
--     SUM(cost_cents) / 100.0 as total_cost_usd,
--     SUM(tokens_total) as total_tokens
-- FROM public.ai_usage_rollup_daily
-- WHERE day >= CURRENT_DATE - INTERVAL '7 days'
-- GROUP BY day
-- ORDER BY day DESC;

-- By feature (last 30 days)
-- SELECT
--     feature,
--     SUM(calls) as total_calls,
--     SUM(cost_cents) / 100.0 as total_cost_usd,
--     SUM(tokens_total) as total_tokens
-- FROM public.ai_usage_rollup_daily
-- WHERE day >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY feature
-- ORDER BY total_cost_usd DESC;

-- By model (last 30 days)
-- SELECT
--     model,
--     SUM(calls) as total_calls,
--     SUM(cost_cents) / 100.0 as total_cost_usd,
--     SUM(tokens_total) as total_tokens,
--     ROUND(SUM(cache_hits)::numeric / NULLIF(SUM(calls), 0) * 100, 1) as cache_hit_rate
-- FROM public.ai_usage_rollup_daily
-- WHERE day >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY model
-- ORDER BY total_cost_usd DESC;

-- ============================================================================
-- 9. Verify rollup matches raw events (data integrity check)
-- ============================================================================

-- Compare rollup totals to raw event totals for a date range
-- This query should return rows with matching = TRUE for all

-- WITH raw_totals AS (
--     SELECT
--         DATE(created_at) as day,
--         feature_label as feature,
--         model,
--         COUNT(*) as raw_calls,
--         SUM(cost_cents) as raw_cost_cents,
--         SUM(total_tokens) as raw_tokens
--     FROM public.ai_usage_events
--     WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
--     GROUP BY DATE(created_at), feature_label, model
-- ),
-- rollup_totals AS (
--     SELECT
--         day,
--         feature,
--         model,
--         calls as rollup_calls,
--         cost_cents as rollup_cost_cents,
--         tokens_total as rollup_tokens
--     FROM public.ai_usage_rollup_daily
--     WHERE day >= CURRENT_DATE - INTERVAL '7 days'
-- )
-- SELECT
--     COALESCE(r.day, u.day) as day,
--     COALESCE(r.feature, u.feature) as feature,
--     COALESCE(r.model, u.model) as model,
--     r.raw_calls,
--     u.rollup_calls,
--     r.raw_calls = u.rollup_calls as calls_match,
--     r.raw_cost_cents,
--     u.rollup_cost_cents,
--     r.raw_cost_cents = u.rollup_cost_cents as cost_match
-- FROM raw_totals r
-- FULL OUTER JOIN rollup_totals u
--     ON r.day = u.day AND r.feature = u.feature AND r.model = u.model
-- ORDER BY day DESC, feature, model;

-- ============================================================================
-- 10. Security test: Verify anon/authenticated CANNOT access
-- ============================================================================

-- These should FAIL when run as anon or authenticated role:
-- SET ROLE anon;
-- SELECT * FROM public.ai_usage_events LIMIT 1;  -- Should fail
-- SELECT * FROM public.ai_usage_rollup_daily LIMIT 1;  -- Should fail
-- RESET ROLE;

-- SET ROLE authenticated;
-- SELECT * FROM public.ai_usage_events LIMIT 1;  -- Should fail
-- SELECT * FROM public.ai_usage_rollup_daily LIMIT 1;  -- Should fail
-- RESET ROLE;

-- ============================================================================
-- VERIFICATION COMPLETE
-- ============================================================================
-- Expected results:
-- 1. Both tables have all required columns
-- 2. RLS is enabled on both tables
-- 3. Only service_role has access (policies use auth.role() = 'service_role')
-- 4. Grants show service_role only, no anon/authenticated
-- 5. All indexes exist
-- 6. upsert_ai_usage_rollup function exists with correct signature
-- ============================================================================
