-- Rollback Migration: Restore archived tables to public schema
-- Use this ONLY if you need to restore archived tables
-- Run manually: supabase db execute < this_file.sql
--
-- NOTE: This migration should NOT run automatically.
-- It's provided for emergency rollback only.
-- To use: rename to have earlier timestamp than archive migration.

-- =============================================================================
-- RESTORE ARCHIVED TABLES TO PUBLIC SCHEMA
-- =============================================================================

-- Restore: ai_invocations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'ai_invocations') THEN
    ALTER TABLE archive.ai_invocations SET SCHEMA public;
    RAISE NOTICE 'Restored: ai_invocations';
  END IF;
END $$;

-- Restore: analytics_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'analytics_events') THEN
    ALTER TABLE archive.analytics_events SET SCHEMA public;
    RAISE NOTICE 'Restored: analytics_events';
  END IF;
END $$;

-- Restore: app_admins
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'app_admins') THEN
    ALTER TABLE archive.app_admins SET SCHEMA public;
    RAISE NOTICE 'Restored: app_admins';
  END IF;
END $$;

-- Restore: birth_charts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'birth_charts') THEN
    ALTER TABLE archive.birth_charts SET SCHEMA public;
    RAISE NOTICE 'Restored: birth_charts';
  END IF;
END $$;

-- Restore: birth_charts_cache
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'birth_charts_cache') THEN
    ALTER TABLE archive.birth_charts_cache SET SCHEMA public;
    RAISE NOTICE 'Restored: birth_charts_cache';
  END IF;
END $$;

-- Restore: cache_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'cache_events') THEN
    ALTER TABLE archive.cache_events SET SCHEMA public;
    RAISE NOTICE 'Restored: cache_events';
  END IF;
END $$;

-- Restore: daily_horoscopes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'daily_horoscopes') THEN
    ALTER TABLE archive.daily_horoscopes SET SCHEMA public;
    RAISE NOTICE 'Restored: daily_horoscopes';
  END IF;
END $$;

-- Restore: family_members
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'family_members') THEN
    ALTER TABLE archive.family_members SET SCHEMA public;
    RAISE NOTICE 'Restored: family_members';
  END IF;
END $$;

-- Restore: social_posts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'social_posts') THEN
    ALTER TABLE archive.social_posts SET SCHEMA public;
    RAISE NOTICE 'Restored: social_posts';
  END IF;
END $$;

-- Restore: social_profile_summaries
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'social_profile_summaries') THEN
    ALTER TABLE archive.social_profile_summaries SET SCHEMA public;
    RAISE NOTICE 'Restored: social_profile_summaries';
  END IF;
END $$;

-- Restore: soul_print_master
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'soul_print_master') THEN
    ALTER TABLE archive.soul_print_master SET SCHEMA public;
    RAISE NOTICE 'Restored: soul_print_master';
  END IF;
END $$;

-- Restore: soul_print_translations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'soul_print_translations') THEN
    ALTER TABLE archive.soul_print_translations SET SCHEMA public;
    RAISE NOTICE 'Restored: soul_print_translations';
  END IF;
END $$;

-- Restore: translation_cache
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'translation_cache') THEN
    ALTER TABLE archive.translation_cache SET SCHEMA public;
    RAISE NOTICE 'Restored: translation_cache';
  END IF;
END $$;

-- Restore: user_daily
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'user_daily') THEN
    ALTER TABLE archive.user_daily SET SCHEMA public;
    RAISE NOTICE 'Restored: user_daily';
  END IF;
END $$;

-- Restore: user_learn_progress
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = 'user_learn_progress') THEN
    ALTER TABLE archive.user_learn_progress SET SCHEMA public;
    RAISE NOTICE 'Restored: user_learn_progress';
  END IF;
END $$;

-- =============================================================================
-- After restoring, you may need to re-grant permissions:
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
-- =============================================================================
