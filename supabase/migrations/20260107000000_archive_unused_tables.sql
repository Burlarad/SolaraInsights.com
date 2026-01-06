-- Archive Migration: Move unused tables to archive schema
-- Generated: 2026-01-06
-- Safe: Idempotent, reversible, preserves data
--
-- EVIDENCE: Tables below have 0 code references in app/, lib/, components/, hooks/
-- grep -roh 'from("[table_name]")' found no matches
--
-- EXCLUDED FROM ARCHIVE (require verification):
-- - birth_data_versions (profiles.current_birth_version_id FK)
-- - social_consents (compliance)
-- - subscriptions (Stripe may use externally)
-- - feedback, public_compatibility, settings (may want to keep)
-- - waitlist_subscribers, year_prewarm_jobs (marketing/cron)

-- =============================================================================
-- STEP 1: Create archive schema
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS archive;

-- Grant basic access to postgres role
GRANT USAGE ON SCHEMA archive TO postgres;
GRANT ALL ON SCHEMA archive TO postgres;

-- =============================================================================
-- STEP 2: Archive tables with zero code references (LOW RISK)
-- =============================================================================

-- Archive: ai_invocations (logging table, 0 code refs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_invocations') THEN
    ALTER TABLE public.ai_invocations SET SCHEMA archive;
    RAISE NOTICE 'Archived: ai_invocations';
  END IF;
END $$;

-- Archive: analytics_events (analytics, 0 code refs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'analytics_events') THEN
    ALTER TABLE public.analytics_events SET SCHEMA archive;
    RAISE NOTICE 'Archived: analytics_events';
  END IF;
END $$;

-- Archive: app_admins (unused admin feature, 0 code refs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_admins') THEN
    ALTER TABLE public.app_admins SET SCHEMA archive;
    RAISE NOTICE 'Archived: app_admins';
  END IF;
END $$;

-- Archive: birth_charts (0 code refs, soul_paths replaced this)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'birth_charts') THEN
    ALTER TABLE public.birth_charts SET SCHEMA archive;
    RAISE NOTICE 'Archived: birth_charts';
  END IF;
END $$;

-- Archive: birth_charts_cache (cache table, 0 code refs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'birth_charts_cache') THEN
    ALTER TABLE public.birth_charts_cache SET SCHEMA archive;
    RAISE NOTICE 'Archived: birth_charts_cache';
  END IF;
END $$;

-- Archive: cache_events (logging table, 0 code refs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cache_events') THEN
    ALTER TABLE public.cache_events SET SCHEMA archive;
    RAISE NOTICE 'Archived: cache_events';
  END IF;
END $$;

-- Archive: daily_horoscopes (deprecated feature, 0 code refs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_horoscopes') THEN
    ALTER TABLE public.daily_horoscopes SET SCHEMA archive;
    RAISE NOTICE 'Archived: daily_horoscopes';
  END IF;
END $$;

-- Archive: family_members (unused feature, 0 code refs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'family_members') THEN
    ALTER TABLE public.family_members SET SCHEMA archive;
    RAISE NOTICE 'Archived: family_members';
  END IF;
END $$;

-- Archive: social_posts (social remnant, 0 code refs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'social_posts') THEN
    ALTER TABLE public.social_posts SET SCHEMA archive;
    RAISE NOTICE 'Archived: social_posts';
  END IF;
END $$;

-- Archive: social_profile_summaries (0 code refs, social_summaries used instead)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'social_profile_summaries') THEN
    ALTER TABLE public.social_profile_summaries SET SCHEMA archive;
    RAISE NOTICE 'Archived: social_profile_summaries';
  END IF;
END $$;

-- Archive: soul_print_master (seed data, 0 code refs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'soul_print_master') THEN
    ALTER TABLE public.soul_print_master SET SCHEMA archive;
    RAISE NOTICE 'Archived: soul_print_master';
  END IF;
END $$;

-- Archive: soul_print_translations (seed data, 0 code refs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'soul_print_translations') THEN
    ALTER TABLE public.soul_print_translations SET SCHEMA archive;
    RAISE NOTICE 'Archived: soul_print_translations';
  END IF;
END $$;

-- Archive: translation_cache (cache table, 0 code refs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'translation_cache') THEN
    ALTER TABLE public.translation_cache SET SCHEMA archive;
    RAISE NOTICE 'Archived: translation_cache';
  END IF;
END $$;

-- Archive: user_daily (unused feature, 0 code refs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_daily') THEN
    ALTER TABLE public.user_daily SET SCHEMA archive;
    RAISE NOTICE 'Archived: user_daily';
  END IF;
END $$;

-- Archive: user_learn_progress (unused feature, 0 code refs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_learn_progress') THEN
    ALTER TABLE public.user_learn_progress SET SCHEMA archive;
    RAISE NOTICE 'Archived: user_learn_progress';
  END IF;
END $$;

-- =============================================================================
-- SUMMARY: 15 tables archived to archive schema
-- =============================================================================
-- Archived:
--   ai_invocations, analytics_events, app_admins, birth_charts,
--   birth_charts_cache, cache_events, daily_horoscopes, family_members,
--   social_posts, social_profile_summaries, soul_print_master,
--   soul_print_translations, translation_cache, user_daily, user_learn_progress
--
-- NOT Archived (require manual verification):
--   birth_data_versions, feedback, public_compatibility, sanctuary_journal_entries,
--   settings, sign_daily, social_consents, subscriptions, user_year_insights,
--   user_year_transit_aspects, waitlist_subscribers, year_prewarm_jobs
-- =============================================================================
