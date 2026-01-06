-- Reconcile local dev schema to match production (public schema)
-- Generated from docs/schema/prod_schema.sql
-- SAFE: idempotent (IF NOT EXISTS / OR REPLACE / DROP IF EXISTS)


-- =====================
-- TABLES
-- =====================

CREATE TABLE IF NOT EXISTS "public"."ai_invocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "feature" "text" NOT NULL,
    "model" "text" NOT NULL,
    "temperature" numeric NOT NULL,
    "top_p" numeric NOT NULL,
    "seed" integer,
    "settings_hash" "text" NOT NULL,
    "request_hash" "text" NOT NULL,
    "prompt_version" "text" NOT NULL,
    "openai_response_id" "text",
    "latency_ms" integer NOT NULL,
    "usage_prompt_tokens" integer,
    "usage_completion_tokens" integer,
    "usage_total_tokens" integer,
    "cached" boolean DEFAULT false NOT NULL,
    "success" boolean DEFAULT true NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "error_code" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."ai_usage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "feature_label" "text" NOT NULL,
    "route" "text" NOT NULL,
    "model" "text" NOT NULL,
    "prompt_version" integer DEFAULT 1 NOT NULL,
    "cache_status" "text" NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "total_tokens" integer DEFAULT 0 NOT NULL,
    "estimated_cost_usd" numeric(12,6) DEFAULT 0 NOT NULL,
    "user_id" "uuid",
    "timeframe" "text",
    "period_key" "text",
    "language" "text",
    "timezone" "text",
    CONSTRAINT "ai_usage_events_cache_status_check" CHECK (("cache_status" = ANY (ARRAY['hit'::"text", 'miss'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "event" "text" NOT NULL,
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."app_admins" (
    "user_id" "uuid" NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."birth_charts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "birth_version_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "input_hash" "text" NOT NULL,
    "chart_json" "jsonb" NOT NULL,
    "engine_version" "text" DEFAULT 'swiss-v1'::"text" NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."birth_charts_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "birth_input_hash" "text" NOT NULL,
    "engine_version" "text" DEFAULT 'swiss-v1'::"text" NOT NULL,
    "chart_json" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."birth_data_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "birth_date" "date" NOT NULL,
    "birth_time" "text",
    "birth_city" "text",
    "birth_region" "text",
    "birth_country" "text",
    "birth_lat" double precision NOT NULL,
    "birth_lon" double precision NOT NULL,
    "timezone" "text" NOT NULL,
    "label" "text"
);

CREATE TABLE IF NOT EXISTS "public"."cache_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feature" "text" NOT NULL,
    "cache_key" "text" NOT NULL,
    "cache_hit" boolean NOT NULL,
    "age_ms" integer,
    "latency_ms" integer NOT NULL,
    "model" "text" NOT NULL,
    "prompt_version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "linked_profile_id" "uuid",
    "name" "text" NOT NULL,
    "relationship_type" "text" NOT NULL,
    "birth_date" "date",
    "birth_time" time without time zone,
    "birth_city" "text",
    "birth_region" "text",
    "birth_country" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "is_mutual" boolean DEFAULT false NOT NULL,
    "space_between_enabled" boolean DEFAULT true NOT NULL,
    "is_space_between_unlocked" boolean DEFAULT false NOT NULL,
    "birth_lat" double precision,
    "birth_lon" double precision,
    "timezone" "text",
    "first_name" "text",
    "middle_name" "text",
    "last_name" "text",
    CONSTRAINT "connections_birth_lat_range" CHECK ((("birth_lat" IS NULL) OR (("birth_lat" >= ('-90'::integer)::double precision) AND ("birth_lat" <= (90)::double precision)))),
    CONSTRAINT "connections_birth_lon_range" CHECK ((("birth_lon" IS NULL) OR (("birth_lon" >= ('-180'::integer)::double precision) AND ("birth_lon" <= (180)::double precision)))),
    CONSTRAINT "connections_timezone_not_blank" CHECK ((("timezone" IS NULL) OR ("btrim"("timezone") <> ''::"text")))
);

CREATE TABLE IF NOT EXISTS "public"."daily_briefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "local_date" "date" NOT NULL,
    "language" "text" DEFAULT 'en'::"text" NOT NULL,
    "prompt_version" integer DEFAULT 1 NOT NULL,
    "model_version" "text",
    "title" "text" NOT NULL,
    "shared_vibe" "text" NOT NULL,
    "ways_to_show_up" "text"[] NOT NULL,
    "nudge" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."daily_horoscopes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "zodiac" "text",
    "summary_ref" "text",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."facebook_data_deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "confirmation_code" "text" NOT NULL,
    "facebook_user_id" "text" NOT NULL,
    "user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "error_message" "text",
    CONSTRAINT "fdr_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'user_not_found'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."family_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid",
    "owner_email" "text" NOT NULL,
    "invite_email" "text" NOT NULL,
    "status" "text" DEFAULT 'invited'::"text" NOT NULL,
    "invite_token" "text" NOT NULL,
    "provider" "text",
    "invited_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "accepted_user_id" "uuid",
    "accepted_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "message" "text" NOT NULL,
    "ai_summary" "text",
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."foundation_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_type" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "source" "text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "foundation_ledger_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['accrual'::"text", 'disbursement'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."global_astrology_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "year" integer NOT NULL,
    "event_type" "text" NOT NULL,
    "body" "text" NOT NULL,
    "from_sign" "text",
    "to_sign" "text",
    "season" "text",
    "occurs_at_utc" timestamp with time zone NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "global_astrology_events_year_check" CHECK ((("year" >= 1800) AND ("year" <= 2200)))
);

CREATE TABLE IF NOT EXISTS "public"."gratitude_stats" (
    "month_key" "text" NOT NULL,
    "total" integer DEFAULT 0 NOT NULL,
    "categories" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_date" "date" NOT NULL,
    "timeframe" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "journal_entries_timeframe_check" CHECK (("timeframe" = ANY (ARRAY['today'::"text", 'week'::"text", 'month'::"text", 'year'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."numerology_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "system" "text" DEFAULT 'pythagorean'::"text" NOT NULL,
    "input_hash" "text" NOT NULL,
    "profile_json" "jsonb" NOT NULL,
    "prompt_version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "preferred_name" "text",
    "birth_date" "date",
    "birth_place" "text",
    "birth_time" "text",
    "sign" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_name" "text",
    "birth_city" "text",
    "birth_region" "text",
    "birth_country" "text",
    "timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "zodiac_sign" "text",
    "language" "text" DEFAULT 'en'::"text" NOT NULL,
    "is_onboarded" boolean DEFAULT false NOT NULL,
    "onboarding_started_at" timestamp with time zone,
    "onboarding_completed_at" timestamp with time zone,
    "membership_plan" "text" DEFAULT 'none'::"text" NOT NULL,
    "is_comped" boolean DEFAULT false NOT NULL,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "subscription_status" "text",
    "subscription_start_date" timestamp with time zone,
    "subscription_end_date" timestamp with time zone,
    "location_for_charity" "text",
    "latitude" double precision,
    "longitude" double precision,
    "birth_lat" double precision,
    "birth_lon" double precision,
    "birth_chart_placements_json" "jsonb",
    "birth_chart_computed_at" timestamp with time zone,
    "last_seen_at" timestamp with time zone,
    "current_birth_version_id" "uuid",
    "local_timezone" "text",
    "last_social_sync_at" timestamp with time zone,
    "last_social_sync_local_date" "date",
    "social_sync_status" "text",
    "social_sync_error" "text",
    "first_name" "text",
    "middle_name" "text",
    "last_name" "text",
    "social_insights_enabled" boolean DEFAULT false NOT NULL,
    "social_insights_activated_at" timestamp with time zone,
    "is_hibernated" boolean DEFAULT false NOT NULL,
    "hibernated_at" timestamp with time zone,
    "reactivated_at" timestamp with time zone,
    "stripe_email" "text",
    "social_connect_prompt_dismissed_at" timestamp with time zone,
    CONSTRAINT "profiles_local_timezone_not_blank" CHECK ((("local_timezone" IS NULL) OR ("btrim"("local_timezone") <> ''::"text")))
);

CREATE TABLE IF NOT EXISTS "public"."public_compatibility" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pair_key" "text" NOT NULL,
    "sign_a" "text" NOT NULL,
    "sign_b" "text" NOT NULL,
    "content_en_json" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."sanctuary_journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_date" "date" NOT NULL,
    "entry_md" "text",
    "transit_context" "jsonb",
    "entry_type" "text" DEFAULT 'sanctuary'::"text" NOT NULL,
    "depth" "text",
    "starred" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."settings" (
    "id" "uuid" NOT NULL,
    "birth_date" "date",
    "birth_time" "text",
    "tz" "text",
    "lat" double precision,
    "lon" double precision,
    "source_accuracy" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."sign_daily" (
    "sign" "text" NOT NULL,
    "day_key" "date" NOT NULL,
    "scope" "text" NOT NULL,
    "text" "text" NOT NULL,
    "model_version" "text" DEFAULT 'gpt-4o-mini'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sign_daily_scope_check" CHECK (("scope" = ANY (ARRAY['yesterday'::"text", 'today'::"text", 'tomorrow'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."social_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "external_user_id" "text",
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "social_accounts_provider_check" CHECK (("provider" = ANY (ARRAY['facebook'::"text", 'instagram'::"text", 'tiktok'::"text", 'x'::"text", 'reddit'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."social_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "granted_scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "consented_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "revoked_at" timestamp with time zone,
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."social_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "external_user_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."social_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "external_post_id" "text",
    "posted_at" timestamp with time zone,
    "content" "text",
    "media_url" "text",
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "social_posts_provider_check" CHECK (("provider" = ANY (ARRAY['facebook'::"text", 'twitter'::"text", 'tiktok'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."social_profile_summaries" (
    "user_id" "uuid" NOT NULL,
    "providers" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "summary_text" "text",
    "top_keywords" "text"[] DEFAULT '{}'::"text"[],
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."social_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "window_days" integer DEFAULT 90 NOT NULL,
    "posts_count" integer DEFAULT 0 NOT NULL,
    "summary" "text" NOT NULL,
    "last_fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."soul_paths" (
    "user_id" "uuid" NOT NULL,
    "schema_version" integer NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "birth_input_hash" "text" NOT NULL,
    "soul_path_json" "jsonb" NOT NULL,
    "interpretation_cache" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "soul_path_narrative_json" "jsonb",
    "narrative_prompt_version" integer DEFAULT 1,
    "narrative_language" "text",
    "narrative_model" "text",
    "narrative_generated_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."soul_print_master" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "birth_input_hash" "text" NOT NULL,
    "master_language" "text" DEFAULT 'en'::"text" NOT NULL,
    "master_payload" "jsonb" NOT NULL,
    "prompt_version" "text",
    "model_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."soul_print_translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "birth_input_hash" "text" NOT NULL,
    "language" "text" NOT NULL,
    "translated_payload" "jsonb" NOT NULL,
    "translation_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."space_between_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "language" "text" DEFAULT 'en'::"text" NOT NULL,
    "prompt_version" integer DEFAULT 1 NOT NULL,
    "model_version" "text",
    "relationship_essence" "text" NOT NULL,
    "emotional_blueprint" "text" NOT NULL,
    "communication_patterns" "text" NOT NULL,
    "growth_edges" "text" NOT NULL,
    "care_guide" "text" NOT NULL,
    "includes_linked_birth_data" boolean DEFAULT false NOT NULL,
    "includes_linked_social_data" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cache_key" "text" DEFAULT ''::"text" NOT NULL,
    "refreshed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."translation_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cache_key" "text" NOT NULL,
    "language" "text" NOT NULL,
    "translation" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."user_daily" (
    "user_id" "uuid" NOT NULL,
    "day_key" "date" NOT NULL,
    "scope" "text" NOT NULL,
    "text" "text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "model_version" "text" DEFAULT 'gpt-4o-mini'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_daily_scope_check" CHECK (("scope" = ANY (ARRAY['yesterday'::"text", 'today'::"text", 'tomorrow'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."user_learn_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "guide_id" "text" NOT NULL,
    "local_date" "date" NOT NULL,
    "time_zone" "text",
    "completed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "dwell_ms" integer,
    "scroll_ratio" numeric(5,3),
    "device" "text",
    "metadata" "jsonb"
);

CREATE TABLE IF NOT EXISTS "public"."user_year_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "language" "text" DEFAULT 'en'::"text" NOT NULL,
    "prompt_version" integer DEFAULT 1 NOT NULL,
    "content" "jsonb" NOT NULL,
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_year_insights_year_check" CHECK ((("year" >= 1800) AND ("year" <= 2200)))
);

CREATE TABLE IF NOT EXISTS "public"."user_year_transit_aspects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "transit_body" "text" NOT NULL,
    "natal_body" "text" NOT NULL,
    "aspect" "text" NOT NULL,
    "exact_at_utc" timestamp with time zone NOT NULL,
    "orb_degrees" numeric,
    "season" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_year_transit_aspects_year_check" CHECK ((("year" >= 1800) AND ("year" <= 2200)))
);

CREATE TABLE IF NOT EXISTS "public"."waitlist_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "source" "text",
    "ip" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_term" "text",
    "utm_content" "text",
    "referrer" "text"
);

CREATE TABLE IF NOT EXISTS "public"."year_prewarm_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "language" "text" DEFAULT 'en'::"text" NOT NULL,
    "prompt_version" integer NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "run_after" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_at" timestamp with time zone,
    "locked_by" "text",
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "year_prewarm_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'done'::"text", 'failed'::"text"]))),
    CONSTRAINT "year_prewarm_jobs_year_check" CHECK ((("year" >= 1800) AND ("year" <= 2200)))
);

-- =====================
-- FUNCTIONS
-- =====================

CREATE OR REPLACE FUNCTION "public"."connections_maintain_flags"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- prevent recursion when updates are made inside recompute
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.linked_profile_id IS NOT NULL THEN
      PERFORM public.recompute_mutual_and_unlock(NEW.owner_user_id, NEW.linked_profile_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- recompute old pair if linked_profile_id changed
    IF OLD.linked_profile_id IS NOT NULL
       AND OLD.linked_profile_id IS DISTINCT FROM NEW.linked_profile_id THEN
      PERFORM public.recompute_mutual_and_unlock(OLD.owner_user_id, OLD.linked_profile_id);
    END IF;

    -- recompute current pair (also covers toggle flips)
    IF NEW.linked_profile_id IS NOT NULL THEN
      PERFORM public.recompute_mutual_and_unlock(NEW.owner_user_id, NEW.linked_profile_id);
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.linked_profile_id IS NOT NULL THEN
      PERFORM public.recompute_mutual_and_unlock(OLD.owner_user_id, OLD.linked_profile_id);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."maintain_mutual_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- prevent recursive loops when our own UPDATE runs
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.linked_profile_id is not null then
      perform public.recompute_mutual_for_pair(new.owner_user_id, new.linked_profile_id);
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- If the pair changed, recompute old pair to possibly unset
    if old.linked_profile_id is not null
       and (old.linked_profile_id is distinct from new.linked_profile_id
            or old.owner_user_id is distinct from new.owner_user_id) then
      perform public.recompute_mutual_for_pair(old.owner_user_id, old.linked_profile_id);
    end if;

    -- Recompute new pair
    if new.linked_profile_id is not null then
      perform public.recompute_mutual_for_pair(new.owner_user_id, new.linked_profile_id);
    else
      -- If unlinked, ensure this row is false
      update public.connections
        set is_mutual = false
      where id = new.id;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.linked_profile_id is not null then
      perform public.recompute_mutual_for_pair(old.owner_user_id, old.linked_profile_id);
    end if;
    return old;
  end if;

  return null;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."recompute_mutual_and_unlock"("a" "uuid", "b" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  mutual boolean;
  a_on boolean;
  b_on boolean;
  unlocked boolean;
BEGIN
  IF a IS NULL OR b IS NULL THEN
    RETURN;
  END IF;

  mutual :=
    EXISTS (SELECT 1 FROM public.connections WHERE owner_user_id = a AND linked_profile_id = b)
    AND EXISTS (SELECT 1 FROM public.connections WHERE owner_user_id = b AND linked_profile_id = a);

  -- Pull toggles (default false if row missing)
  SELECT COALESCE(space_between_enabled, false) INTO a_on
  FROM public.connections
  WHERE owner_user_id = a AND linked_profile_id = b
  LIMIT 1;

  SELECT COALESCE(space_between_enabled, false) INTO b_on
  FROM public.connections
  WHERE owner_user_id = b AND linked_profile_id = a
  LIMIT 1;

  unlocked := mutual AND a_on AND b_on;

  UPDATE public.connections
  SET
    is_mutual = mutual,
    is_space_between_unlocked = unlocked
  WHERE
    (owner_user_id = a AND linked_profile_id = b)
    OR
    (owner_user_id = b AND linked_profile_id = a);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."recompute_mutual_for_pair"("a" "uuid", "b" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  mutual boolean;
begin
  if a is null or b is null then
    return;
  end if;

  mutual :=
    exists (
      select 1 from public.connections
      where owner_user_id = a and linked_profile_id = b
    )
    and exists (
      select 1 from public.connections
      where owner_user_id = b and linked_profile_id = a
    );

  update public.connections
    set is_mutual = mutual
  where
    (owner_user_id = a and linked_profile_id = b)
    or
    (owner_user_id = b and linked_profile_id = a);
end;
$$;

CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."set_soul_path_interpretation"("p_user_id" "uuid", "p_lang" "text", "p_value" "jsonb") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE public.soul_paths
  SET interpretation_cache = jsonb_set(
    COALESCE(interpretation_cache, '{}'::jsonb),
    ARRAY[p_lang],
    p_value,
    true
  )
  WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."translation_cache_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."update_social_accounts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."update_social_identities_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =====================
-- ROW LEVEL SECURITY
-- =====================

ALTER TABLE "public"."ai_invocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ai_usage_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."birth_charts_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cache_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."daily_briefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."daily_horoscopes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."facebook_data_deletion_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."family_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."foundation_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."global_astrology_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."numerology_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."public_compatibility" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sanctuary_journal_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sign_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."social_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."social_consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."social_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."social_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."social_profile_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."social_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."soul_paths" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."soul_print_master" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."soul_print_translations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."space_between_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."translation_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_learn_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_year_insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_year_transit_aspects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."waitlist_subscribers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."year_prewarm_jobs" ENABLE ROW LEVEL SECURITY;

-- =====================
-- INDEXES
-- =====================

CREATE INDEX IF NOT EXISTS "ai_invocations_created_at_idx" ON "public"."ai_invocations" USING "btree" ("created_at");
CREATE INDEX IF NOT EXISTS "ai_invocations_feature_success_idx" ON "public"."ai_invocations" USING "btree" ("feature", "success");
CREATE INDEX IF NOT EXISTS "ai_invocations_model_idx" ON "public"."ai_invocations" USING "btree" ("model");
CREATE INDEX IF NOT EXISTS "ai_invocations_request_hash_idx" ON "public"."ai_invocations" USING "btree" ("request_hash");
CREATE INDEX IF NOT EXISTS "ai_invocations_user_id_idx" ON "public"."ai_invocations" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "ai_usage_events_created_at_idx" ON "public"."ai_usage_events" USING "btree" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "ai_usage_events_feature_label_idx" ON "public"."ai_usage_events" USING "btree" ("feature_label");
CREATE INDEX IF NOT EXISTS "ai_usage_events_route_idx" ON "public"."ai_usage_events" USING "btree" ("route");
CREATE INDEX IF NOT EXISTS "ai_usage_events_user_id_idx" ON "public"."ai_usage_events" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "analytics_events_created_at_idx" ON "public"."analytics_events" USING "btree" ("created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_event_idx" ON "public"."analytics_events" USING "btree" ("event");
CREATE UNIQUE INDEX IF NOT EXISTS "birth_charts_cache_unique" ON "public"."birth_charts_cache" USING "btree" ("user_id", "birth_input_hash");
CREATE INDEX IF NOT EXISTS "family_members_invite_email_idx" ON "public"."family_members" USING "btree" ("lower"("invite_email"));
CREATE INDEX IF NOT EXISTS "family_members_owner_idx" ON "public"."family_members" USING "btree" ("owner_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "family_members_owner_invite_unique" ON "public"."family_members" USING "btree" ("lower"("owner_email"), "lower"("invite_email")) WHERE ("status" = ANY (ARRAY['invited'::"text", 'active'::"text"]));
CREATE INDEX IF NOT EXISTS "feedback_category_idx" ON "public"."feedback" USING "btree" ("category");
CREATE INDEX IF NOT EXISTS "global_astrology_events_occurs_at_idx" ON "public"."global_astrology_events" USING "btree" ("occurs_at_utc");
CREATE UNIQUE INDEX IF NOT EXISTS "global_astrology_events_unique" ON "public"."global_astrology_events" USING "btree" ("year", "event_type", "body", "occurs_at_utc");
CREATE INDEX IF NOT EXISTS "global_astrology_events_year_idx" ON "public"."global_astrology_events" USING "btree" ("year");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_events_route_created" ON "public"."ai_usage_events" USING "btree" ("route", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_birth_data_versions_user_id_created" ON "public"."birth_data_versions" USING "btree" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_cache_events_cache_hit_created" ON "public"."cache_events" USING "btree" ("cache_hit", "created_at");
CREATE INDEX IF NOT EXISTS "idx_cache_events_created_at" ON "public"."cache_events" USING "btree" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_cache_events_feature_created" ON "public"."cache_events" USING "btree" ("feature", "created_at");
CREATE INDEX IF NOT EXISTS "idx_connections_linked_owner" ON "public"."connections" USING "btree" ("linked_profile_id", "owner_user_id") WHERE ("linked_profile_id" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_connections_owner" ON "public"."connections" USING "btree" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "idx_daily_briefs_connection_date" ON "public"."daily_briefs" USING "btree" ("connection_id", "local_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_fdr_confirmation_code" ON "public"."facebook_data_deletion_requests" USING "btree" ("confirmation_code");
CREATE INDEX IF NOT EXISTS "idx_fdr_facebook_user_id" ON "public"."facebook_data_deletion_requests" USING "btree" ("facebook_user_id");
CREATE INDEX IF NOT EXISTS "idx_fdr_user_id" ON "public"."facebook_data_deletion_requests" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_foundation_ledger_created_at" ON "public"."foundation_ledger" USING "btree" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_foundation_ledger_entry_type_created" ON "public"."foundation_ledger" USING "btree" ("entry_type", "created_at");
CREATE INDEX IF NOT EXISTS "idx_journal_entries_user_date" ON "public"."journal_entries" USING "btree" ("user_id", "entry_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_numerology_profiles_user_id" ON "public"."numerology_profiles" USING "btree" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_numerology_profiles_user_system_hash" ON "public"."numerology_profiles" USING "btree" ("user_id", "system", "input_hash");
CREATE INDEX IF NOT EXISTS "idx_profiles_is_hibernated" ON "public"."profiles" USING "btree" ("is_hibernated");
CREATE INDEX IF NOT EXISTS "idx_profiles_last_seen_at" ON "public"."profiles" USING "btree" ("last_seen_at" DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS "idx_public_compatibility_pair_key" ON "public"."public_compatibility" USING "btree" ("pair_key");
CREATE INDEX IF NOT EXISTS "idx_social_identities_provider_external" ON "public"."social_identities" USING "btree" ("provider", "external_user_id");
CREATE INDEX IF NOT EXISTS "idx_social_identities_user_provider" ON "public"."social_identities" USING "btree" ("user_id", "provider");
CREATE INDEX IF NOT EXISTS "idx_social_summaries_user_provider" ON "public"."social_summaries" USING "btree" ("user_id", "provider");
CREATE INDEX IF NOT EXISTS "idx_soul_paths_schema_version" ON "public"."soul_paths" USING "btree" ("schema_version");
CREATE INDEX IF NOT EXISTS "idx_soul_paths_user_id" ON "public"."soul_paths" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_space_between_connection" ON "public"."space_between_reports" USING "btree" ("connection_id");
CREATE INDEX IF NOT EXISTS "profiles_last_seen_at_idx" ON "public"."profiles" USING "btree" ("last_seen_at" DESC);
CREATE INDEX IF NOT EXISTS "sanctuary_journal_user_date_idx" ON "public"."sanctuary_journal_entries" USING "btree" ("user_id", "entry_date");
CREATE UNIQUE INDEX IF NOT EXISTS "sanctuary_journal_user_date_unique" ON "public"."sanctuary_journal_entries" USING "btree" ("user_id", "entry_date");
CREATE INDEX IF NOT EXISTS "sanctuary_journal_user_starred_idx" ON "public"."sanctuary_journal_entries" USING "btree" ("user_id", "starred");
CREATE INDEX IF NOT EXISTS "sign_daily_day_scope_idx" ON "public"."sign_daily" USING "btree" ("day_key" DESC, "scope");
CREATE INDEX IF NOT EXISTS "social_accounts_user_provider_idx" ON "public"."social_accounts" USING "btree" ("user_id", "provider");
CREATE INDEX IF NOT EXISTS "social_posts_user_provider_idx" ON "public"."social_posts" USING "btree" ("user_id", "provider", "posted_at");
CREATE INDEX IF NOT EXISTS "soul_paths_interpretation_cache_gin" ON "public"."soul_paths" USING "gin" ("interpretation_cache");
CREATE INDEX IF NOT EXISTS "soul_paths_narrative_idx" ON "public"."soul_paths" USING "btree" ("narrative_prompt_version", "narrative_language");
CREATE UNIQUE INDEX IF NOT EXISTS "soul_print_master_unique" ON "public"."soul_print_master" USING "btree" ("user_id", "birth_input_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "soul_print_translations_unique" ON "public"."soul_print_translations" USING "btree" ("user_id", "birth_input_hash", "language");
CREATE UNIQUE INDEX IF NOT EXISTS "translation_cache_language_cache_key_idx" ON "public"."translation_cache" USING "btree" ("language", "cache_key");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_birth_charts_user_hash" ON "public"."birth_charts" USING "btree" ("user_id", "input_hash");
CREATE INDEX IF NOT EXISTS "user_daily_day_scope_idx" ON "public"."user_daily" USING "btree" ("day_key" DESC, "scope");
CREATE INDEX IF NOT EXISTS "user_learn_progress_guide_idx" ON "public"."user_learn_progress" USING "btree" ("guide_id");
CREATE INDEX IF NOT EXISTS "user_learn_progress_user_idx" ON "public"."user_learn_progress" USING "btree" ("user_id", "local_date" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "user_year_insights_unique" ON "public"."user_year_insights" USING "btree" ("user_id", "year", "language", "prompt_version");
CREATE INDEX IF NOT EXISTS "user_year_insights_user_year_idx" ON "public"."user_year_insights" USING "btree" ("user_id", "year");
CREATE INDEX IF NOT EXISTS "user_year_transit_aspects_exact_at_idx" ON "public"."user_year_transit_aspects" USING "btree" ("exact_at_utc");
CREATE UNIQUE INDEX IF NOT EXISTS "user_year_transit_aspects_unique" ON "public"."user_year_transit_aspects" USING "btree" ("user_id", "year", "transit_body", "natal_body", "aspect", "exact_at_utc");
CREATE INDEX IF NOT EXISTS "user_year_transit_aspects_user_year_idx" ON "public"."user_year_transit_aspects" USING "btree" ("user_id", "year");
CREATE INDEX IF NOT EXISTS "year_prewarm_jobs_claim_idx" ON "public"."year_prewarm_jobs" USING "btree" ("status", "run_after", "updated_at");
CREATE UNIQUE INDEX IF NOT EXISTS "year_prewarm_jobs_unique" ON "public"."year_prewarm_jobs" USING "btree" ("user_id", "year", "language", "prompt_version");
CREATE INDEX IF NOT EXISTS "year_prewarm_jobs_user_year_idx" ON "public"."year_prewarm_jobs" USING "btree" ("user_id", "year");

-- =====================
-- CONSTRAINTS
-- =====================

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_invocations_pkey') THEN
    ALTER TABLE ONLY "public"."ai_invocations" ADD CONSTRAINT "ai_invocations_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_usage_events_pkey') THEN
    ALTER TABLE ONLY "public"."ai_usage_events" ADD CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_events_pkey') THEN
    ALTER TABLE ONLY "public"."analytics_events" ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_admins_pkey') THEN
    ALTER TABLE ONLY "public"."app_admins" ADD CONSTRAINT "app_admins_pkey" PRIMARY KEY ("user_id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'birth_charts_cache_pkey') THEN
    ALTER TABLE ONLY "public"."birth_charts_cache" ADD CONSTRAINT "birth_charts_cache_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'birth_charts_pkey') THEN
    ALTER TABLE ONLY "public"."birth_charts" ADD CONSTRAINT "birth_charts_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'birth_data_versions_pkey') THEN
    ALTER TABLE ONLY "public"."birth_data_versions" ADD CONSTRAINT "birth_data_versions_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cache_events_pkey') THEN
    ALTER TABLE ONLY "public"."cache_events" ADD CONSTRAINT "cache_events_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'connections_pkey') THEN
    ALTER TABLE ONLY "public"."connections" ADD CONSTRAINT "connections_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_briefs_pkey') THEN
    ALTER TABLE ONLY "public"."daily_briefs" ADD CONSTRAINT "daily_briefs_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_briefs_unique_key') THEN
    ALTER TABLE ONLY "public"."daily_briefs" ADD CONSTRAINT "daily_briefs_unique_key" UNIQUE ("connection_id", "local_date", "language", "prompt_version");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_horoscopes_pkey') THEN
    ALTER TABLE ONLY "public"."daily_horoscopes" ADD CONSTRAINT "daily_horoscopes_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_horoscopes_user_id_date_key') THEN
    ALTER TABLE ONLY "public"."daily_horoscopes" ADD CONSTRAINT "daily_horoscopes_user_id_date_key" UNIQUE ("user_id", "date");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facebook_data_deletion_requests_confirmation_code_key') THEN
    ALTER TABLE ONLY "public"."facebook_data_deletion_requests" ADD CONSTRAINT "facebook_data_deletion_requests_confirmation_code_key" UNIQUE ("confirmation_code");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facebook_data_deletion_requests_pkey') THEN
    ALTER TABLE ONLY "public"."facebook_data_deletion_requests" ADD CONSTRAINT "facebook_data_deletion_requests_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_members_invite_token_key') THEN
    ALTER TABLE ONLY "public"."family_members" ADD CONSTRAINT "family_members_invite_token_key" UNIQUE ("invite_token");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_members_pkey') THEN
    ALTER TABLE ONLY "public"."family_members" ADD CONSTRAINT "family_members_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_pkey') THEN
    ALTER TABLE ONLY "public"."feedback" ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'foundation_ledger_pkey') THEN
    ALTER TABLE ONLY "public"."foundation_ledger" ADD CONSTRAINT "foundation_ledger_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_astrology_events_pkey') THEN
    ALTER TABLE ONLY "public"."global_astrology_events" ADD CONSTRAINT "global_astrology_events_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gratitude_stats_pkey') THEN
    ALTER TABLE ONLY "public"."gratitude_stats" ADD CONSTRAINT "gratitude_stats_pkey" PRIMARY KEY ("month_key");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_pkey') THEN
    ALTER TABLE ONLY "public"."journal_entries" ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_user_id_entry_date_timeframe_key') THEN
    ALTER TABLE ONLY "public"."journal_entries" ADD CONSTRAINT "journal_entries_user_id_entry_date_timeframe_key" UNIQUE ("user_id", "entry_date", "timeframe");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'numerology_profiles_pkey') THEN
    ALTER TABLE ONLY "public"."numerology_profiles" ADD CONSTRAINT "numerology_profiles_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key') THEN
    ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pkey') THEN
    ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_compatibility_pair_key_key') THEN
    ALTER TABLE ONLY "public"."public_compatibility" ADD CONSTRAINT "public_compatibility_pair_key_key" UNIQUE ("pair_key");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_compatibility_pkey') THEN
    ALTER TABLE ONLY "public"."public_compatibility" ADD CONSTRAINT "public_compatibility_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sanctuary_journal_entries_pkey') THEN
    ALTER TABLE ONLY "public"."sanctuary_journal_entries" ADD CONSTRAINT "sanctuary_journal_entries_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_pkey') THEN
    ALTER TABLE ONLY "public"."settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sign_daily_pkey') THEN
    ALTER TABLE ONLY "public"."sign_daily" ADD CONSTRAINT "sign_daily_pkey" PRIMARY KEY ("sign", "day_key", "scope");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_accounts_pkey') THEN
    ALTER TABLE ONLY "public"."social_accounts" ADD CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_accounts_user_provider_unique') THEN
    ALTER TABLE ONLY "public"."social_accounts" ADD CONSTRAINT "social_accounts_user_provider_unique" UNIQUE ("user_id", "provider");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_consents_pkey') THEN
    ALTER TABLE ONLY "public"."social_consents" ADD CONSTRAINT "social_consents_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_consents_user_provider_key') THEN
    ALTER TABLE ONLY "public"."social_consents" ADD CONSTRAINT "social_consents_user_provider_key" UNIQUE ("user_id", "provider");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_identities_pkey') THEN
    ALTER TABLE ONLY "public"."social_identities" ADD CONSTRAINT "social_identities_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_identities_provider_external_unique') THEN
    ALTER TABLE ONLY "public"."social_identities" ADD CONSTRAINT "social_identities_provider_external_unique" UNIQUE ("provider", "external_user_id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_identities_user_provider_unique') THEN
    ALTER TABLE ONLY "public"."social_identities" ADD CONSTRAINT "social_identities_user_provider_unique" UNIQUE ("user_id", "provider");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_posts_pkey') THEN
    ALTER TABLE ONLY "public"."social_posts" ADD CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profile_summaries_pkey') THEN
    ALTER TABLE ONLY "public"."social_profile_summaries" ADD CONSTRAINT "social_profile_summaries_pkey" PRIMARY KEY ("user_id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_summaries_pkey') THEN
    ALTER TABLE ONLY "public"."social_summaries" ADD CONSTRAINT "social_summaries_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_summaries_user_provider_unique') THEN
    ALTER TABLE ONLY "public"."social_summaries" ADD CONSTRAINT "social_summaries_user_provider_unique" UNIQUE ("user_id", "provider");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'soul_paths_pkey') THEN
    ALTER TABLE ONLY "public"."soul_paths" ADD CONSTRAINT "soul_paths_pkey" PRIMARY KEY ("user_id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'soul_print_master_pkey') THEN
    ALTER TABLE ONLY "public"."soul_print_master" ADD CONSTRAINT "soul_print_master_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'soul_print_translations_pkey') THEN
    ALTER TABLE ONLY "public"."soul_print_translations" ADD CONSTRAINT "soul_print_translations_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'space_between_reports_pkey') THEN
    ALTER TABLE ONLY "public"."space_between_reports" ADD CONSTRAINT "space_between_reports_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'space_between_unique_key') THEN
    ALTER TABLE ONLY "public"."space_between_reports" ADD CONSTRAINT "space_between_unique_key" UNIQUE ("connection_id", "language", "prompt_version");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_email_key') THEN
    ALTER TABLE ONLY "public"."subscriptions" ADD CONSTRAINT "subscriptions_email_key" UNIQUE ("email");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_pkey') THEN
    ALTER TABLE ONLY "public"."subscriptions" ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'translation_cache_pkey') THEN
    ALTER TABLE ONLY "public"."translation_cache" ADD CONSTRAINT "translation_cache_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_daily_pkey') THEN
    ALTER TABLE ONLY "public"."user_daily" ADD CONSTRAINT "user_daily_pkey" PRIMARY KEY ("user_id", "day_key", "scope");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_learn_progress_pkey') THEN
    ALTER TABLE ONLY "public"."user_learn_progress" ADD CONSTRAINT "user_learn_progress_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_learn_progress_unique') THEN
    ALTER TABLE ONLY "public"."user_learn_progress" ADD CONSTRAINT "user_learn_progress_unique" UNIQUE ("user_id", "guide_id", "local_date");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_year_insights_pkey') THEN
    ALTER TABLE ONLY "public"."user_year_insights" ADD CONSTRAINT "user_year_insights_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_year_transit_aspects_pkey') THEN
    ALTER TABLE ONLY "public"."user_year_transit_aspects" ADD CONSTRAINT "user_year_transit_aspects_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'waitlist_subscribers_email_key') THEN
    ALTER TABLE ONLY "public"."waitlist_subscribers" ADD CONSTRAINT "waitlist_subscribers_email_key" UNIQUE ("email");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'waitlist_subscribers_pkey') THEN
    ALTER TABLE ONLY "public"."waitlist_subscribers" ADD CONSTRAINT "waitlist_subscribers_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'year_prewarm_jobs_pkey') THEN
    ALTER TABLE ONLY "public"."year_prewarm_jobs" ADD CONSTRAINT "year_prewarm_jobs_pkey" PRIMARY KEY ("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_events_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_admins_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."app_admins" ADD CONSTRAINT "app_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'birth_charts_birth_version_id_fkey') THEN
    ALTER TABLE ONLY "public"."birth_charts" ADD CONSTRAINT "birth_charts_birth_version_id_fkey" FOREIGN KEY ("birth_version_id") REFERENCES "public"."birth_data_versions"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'connections_linked_profile_id_fkey') THEN
    ALTER TABLE ONLY "public"."connections" ADD CONSTRAINT "connections_linked_profile_id_fkey" FOREIGN KEY ("linked_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'connections_owner_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."connections" ADD CONSTRAINT "connections_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_briefs_connection_id_fkey') THEN
    ALTER TABLE ONLY "public"."daily_briefs" ADD CONSTRAINT "daily_briefs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_briefs_owner_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."daily_briefs" ADD CONSTRAINT "daily_briefs_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_horoscopes_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."daily_horoscopes" ADD CONSTRAINT "daily_horoscopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facebook_data_deletion_requests_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."facebook_data_deletion_requests" ADD CONSTRAINT "facebook_data_deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_members_accepted_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."family_members" ADD CONSTRAINT "family_members_accepted_user_id_fkey" FOREIGN KEY ("accepted_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_members_owner_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."family_members" ADD CONSTRAINT "family_members_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."journal_entries" ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'numerology_profiles_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."numerology_profiles" ADD CONSTRAINT "numerology_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_current_birth_version_fk') THEN
    ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_current_birth_version_fk" FOREIGN KEY ("current_birth_version_id") REFERENCES "public"."birth_data_versions"("id");
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey') THEN
    ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sanctuary_journal_entries_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."sanctuary_journal_entries" ADD CONSTRAINT "sanctuary_journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_id_fkey') THEN
    ALTER TABLE ONLY "public"."settings" ADD CONSTRAINT "settings_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_accounts_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."social_accounts" ADD CONSTRAINT "social_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_consents_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."social_consents" ADD CONSTRAINT "social_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_identities_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."social_identities" ADD CONSTRAINT "social_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_posts_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."social_posts" ADD CONSTRAINT "social_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profile_summaries_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."social_profile_summaries" ADD CONSTRAINT "social_profile_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'soul_paths_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."soul_paths" ADD CONSTRAINT "soul_paths_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'space_between_reports_connection_id_fkey') THEN
    ALTER TABLE ONLY "public"."space_between_reports" ADD CONSTRAINT "space_between_reports_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'space_between_reports_owner_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."space_between_reports" ADD CONSTRAINT "space_between_reports_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_profile_fkey') THEN
    ALTER TABLE ONLY "public"."subscriptions" ADD CONSTRAINT "subscriptions_user_profile_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_daily_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."user_daily" ADD CONSTRAINT "user_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_learn_progress_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."user_learn_progress" ADD CONSTRAINT "user_learn_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_year_insights_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."user_year_insights" ADD CONSTRAINT "user_year_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_year_transit_aspects_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."user_year_transit_aspects" ADD CONSTRAINT "user_year_transit_aspects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'year_prewarm_jobs_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."year_prewarm_jobs" ADD CONSTRAINT "year_prewarm_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feedback' AND policyname='Admins can read everything') THEN
    CREATE POLICY "Admins can read everything" ON "public"."feedback" FOR SELECT USING (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions' AND policyname='Admins can read subscriptions') THEN
    CREATE POLICY "Admins can read subscriptions" ON "public"."subscriptions" FOR SELECT USING (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='waitlist_subscribers' AND policyname='Only admins can view waitlist') THEN
    CREATE POLICY "Only admins can view waitlist" ON "public"."waitlist_subscribers" FOR SELECT USING (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sign_daily' AND policyname='Public read access to sign_daily') THEN
    CREATE POLICY "Public read access to sign_daily" ON "public"."sign_daily" FOR SELECT USING (true);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='facebook_data_deletion_requests' AND policyname='Public read by confirmation_code') THEN
    CREATE POLICY "Public read by confirmation_code" ON "public"."facebook_data_deletion_requests" FOR SELECT USING (true);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_summaries' AND policyname='Service role can manage social summaries') THEN
    CREATE POLICY "Service role can manage social summaries" ON "public"."social_summaries" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sign_daily' AND policyname='Service role updates sign_daily') THEN
    CREATE POLICY "Service role updates sign_daily" ON "public"."sign_daily" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_daily' AND policyname='Service role updates user_daily') THEN
    CREATE POLICY "Service role updates user_daily" ON "public"."user_daily" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sign_daily' AND policyname='Service role writes sign_daily') THEN
    CREATE POLICY "Service role writes sign_daily" ON "public"."sign_daily" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_daily' AND policyname='Service role writes user_daily') THEN
    CREATE POLICY "Service role writes user_daily" ON "public"."user_daily" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='connections' AND policyname='Users can delete their own connections') THEN
    CREATE POLICY "Users can delete their own connections" ON "public"."connections" FOR DELETE USING (("auth"."uid"() = "owner_user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='journal_entries' AND policyname='Users can delete their own journal') THEN
    CREATE POLICY "Users can delete their own journal" ON "public"."journal_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feedback' AND policyname='Users can insert feedback') THEN
    CREATE POLICY "Users can insert feedback" ON "public"."feedback" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("auth"."email"() = "email")));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='analytics_events' AND policyname='Users can insert their analytics events') THEN
    CREATE POLICY "Users can insert their analytics events" ON "public"."analytics_events" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("auth"."email"() = "email")));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='connections' AND policyname='Users can insert their own connections') THEN
    CREATE POLICY "Users can insert their own connections" ON "public"."connections" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='journal_entries' AND policyname='Users can insert their own journal') THEN
    CREATE POLICY "Users can insert their own journal" ON "public"."journal_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='waitlist_subscribers' AND policyname='Users can insert themselves into waitlist') THEN
    CREATE POLICY "Users can insert themselves into waitlist" ON "public"."waitlist_subscribers" FOR INSERT WITH CHECK (true);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='analytics_events' AND policyname='Users can read their analytics') THEN
    CREATE POLICY "Users can read their analytics" ON "public"."analytics_events" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."email"() = "email")));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='journal_entries' AND policyname='Users can read their own journal') THEN
    CREATE POLICY "Users can read their own journal" ON "public"."journal_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can read their own profile') THEN
    CREATE POLICY "Users can read their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='connections' AND policyname='Users can update their own connections') THEN
    CREATE POLICY "Users can update their own connections" ON "public"."connections" FOR UPDATE USING (("auth"."uid"() = "owner_user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='journal_entries' AND policyname='Users can update their own journal') THEN
    CREATE POLICY "Users can update their own journal" ON "public"."journal_entries" FOR UPDATE USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='connections' AND policyname='Users can view their own connections') THEN
    CREATE POLICY "Users can view their own connections" ON "public"."connections" FOR SELECT USING (("auth"."uid"() = "owner_user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='journal_entries' AND policyname='Users can view their own journal') THEN
    CREATE POLICY "Users can view their own journal" ON "public"."journal_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can view their own profile') THEN
    CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_summaries' AND policyname='Users can view their own social summaries') THEN
    CREATE POLICY "Users can view their own social summaries" ON "public"."social_summaries" FOR SELECT TO "authenticated" USING ((("auth"."uid"())::"text" = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_accounts' AND policyname='Users cannot delete social_accounts') THEN
    CREATE POLICY "Users cannot delete social_accounts" ON "public"."social_accounts" FOR DELETE TO "authenticated" USING (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_identities' AND policyname='Users cannot delete social_identities') THEN
    CREATE POLICY "Users cannot delete social_identities" ON "public"."social_identities" FOR DELETE USING (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_accounts' AND policyname='Users cannot insert social_accounts') THEN
    CREATE POLICY "Users cannot insert social_accounts" ON "public"."social_accounts" FOR INSERT TO "authenticated" WITH CHECK (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_identities' AND policyname='Users cannot insert social_identities') THEN
    CREATE POLICY "Users cannot insert social_identities" ON "public"."social_identities" FOR INSERT WITH CHECK (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_accounts' AND policyname='Users cannot read social_accounts') THEN
    CREATE POLICY "Users cannot read social_accounts" ON "public"."social_accounts" FOR SELECT TO "authenticated" USING (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_identities' AND policyname='Users cannot read social_identities') THEN
    CREATE POLICY "Users cannot read social_identities" ON "public"."social_identities" FOR SELECT USING (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_accounts' AND policyname='Users cannot update social_accounts') THEN
    CREATE POLICY "Users cannot update social_accounts" ON "public"."social_accounts" FOR UPDATE TO "authenticated" USING (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_identities' AND policyname='Users cannot update social_identities') THEN
    CREATE POLICY "Users cannot update social_identities" ON "public"."social_identities" FOR UPDATE USING (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='facebook_data_deletion_requests' AND policyname='Users cannot write deletion_requests') THEN
    CREATE POLICY "Users cannot write deletion_requests" ON "public"."facebook_data_deletion_requests" USING (false) WITH CHECK (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_daily' AND policyname='Users read own user_daily') THEN
    CREATE POLICY "Users read own user_daily" ON "public"."user_daily" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_invocations' AND policyname='ai_invocations_service_rw') THEN
    CREATE POLICY "ai_invocations_service_rw" ON "public"."ai_invocations" USING (false) WITH CHECK (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cache_events' AND policyname='cache_events_service_rw') THEN
    CREATE POLICY "cache_events_service_rw" ON "public"."cache_events" USING (false) WITH CHECK (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='birth_charts_cache' AND policyname='charts_insert_own') THEN
    CREATE POLICY "charts_insert_own" ON "public"."birth_charts_cache" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='birth_charts_cache' AND policyname='charts_select_own') THEN
    CREATE POLICY "charts_select_own" ON "public"."birth_charts_cache" FOR SELECT USING (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_briefs' AND policyname='daily_briefs_delete_own') THEN
    CREATE POLICY "daily_briefs_delete_own" ON "public"."daily_briefs" FOR DELETE USING (("owner_user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_briefs' AND policyname='daily_briefs_insert_own') THEN
    CREATE POLICY "daily_briefs_insert_own" ON "public"."daily_briefs" FOR INSERT WITH CHECK (("owner_user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_briefs' AND policyname='daily_briefs_select_own') THEN
    CREATE POLICY "daily_briefs_select_own" ON "public"."daily_briefs" FOR SELECT USING (("owner_user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_horoscopes' AND policyname='dh_insert_own') THEN
    CREATE POLICY "dh_insert_own" ON "public"."daily_horoscopes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_horoscopes' AND policyname='dh_select_admin') THEN
    CREATE POLICY "dh_select_admin" ON "public"."daily_horoscopes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."app_admins" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_horoscopes' AND policyname='dh_select_own') THEN
    CREATE POLICY "dh_select_own" ON "public"."daily_horoscopes" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_horoscopes' AND policyname='dh_update_own') THEN
    CREATE POLICY "dh_update_own" ON "public"."daily_horoscopes" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='family_members' AND policyname='family_members_select_self') THEN
    CREATE POLICY "family_members_select_self" ON "public"."family_members" FOR SELECT USING ((("auth"."uid"() = "owner_user_id") OR ("auth"."uid"() = "accepted_user_id")));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='family_members' AND policyname='family_members_service_role_full') THEN
    CREATE POLICY "family_members_service_role_full" ON "public"."family_members" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='foundation_ledger' AND policyname='foundation_ledger_service_rw') THEN
    CREATE POLICY "foundation_ledger_service_rw" ON "public"."foundation_ledger" USING (false) WITH CHECK (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='global_astrology_events' AND policyname='global_events_read_all') THEN
    CREATE POLICY "global_events_read_all" ON "public"."global_astrology_events" FOR SELECT USING (true);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='numerology_profiles' AND policyname='numerology_profiles_delete_own') THEN
    CREATE POLICY "numerology_profiles_delete_own" ON "public"."numerology_profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='numerology_profiles' AND policyname='numerology_profiles_insert_own') THEN
    CREATE POLICY "numerology_profiles_insert_own" ON "public"."numerology_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='numerology_profiles' AND policyname='numerology_profiles_select_own') THEN
    CREATE POLICY "numerology_profiles_select_own" ON "public"."numerology_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='numerology_profiles' AND policyname='numerology_profiles_update_own') THEN
    CREATE POLICY "numerology_profiles_update_own" ON "public"."numerology_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='public_compatibility' AND policyname='public_compatibility_select') THEN
    CREATE POLICY "public_compatibility_select" ON "public"."public_compatibility" FOR SELECT USING (true);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_accounts' AND policyname='sa_service_role_all') THEN
    CREATE POLICY "sa_service_role_all" ON "public"."social_accounts" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sanctuary_journal_entries' AND policyname='sanctuary_journal_modify_self') THEN
    CREATE POLICY "sanctuary_journal_modify_self" ON "public"."sanctuary_journal_entries" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sanctuary_journal_entries' AND policyname='sanctuary_journal_select_self') THEN
    CREATE POLICY "sanctuary_journal_select_self" ON "public"."sanctuary_journal_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sanctuary_journal_entries' AND policyname='sanctuary_journal_service_role_full') THEN
    CREATE POLICY "sanctuary_journal_service_role_full" ON "public"."sanctuary_journal_entries" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='service_role_full_access_profiles') THEN
    CREATE POLICY "service_role_full_access_profiles" ON "public"."profiles" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='translation_cache' AND policyname='service_role_manage_translation_cache') THEN
    CREATE POLICY "service_role_manage_translation_cache" ON "public"."translation_cache" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='settings' AND policyname='settings_select_self') THEN
    CREATE POLICY "settings_select_self" ON "public"."settings" FOR SELECT USING (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='settings' AND policyname='settings_service_role_full') THEN
    CREATE POLICY "settings_service_role_full" ON "public"."settings" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='settings' AND policyname='settings_upsert_self') THEN
    CREATE POLICY "settings_upsert_self" ON "public"."settings" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_consents' AND policyname='social_consents_modify_self') THEN
    CREATE POLICY "social_consents_modify_self" ON "public"."social_consents" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_consents' AND policyname='social_consents_select_self') THEN
    CREATE POLICY "social_consents_select_self" ON "public"."social_consents" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_consents' AND policyname='social_consents_service_role_full') THEN
    CREATE POLICY "social_consents_service_role_full" ON "public"."social_consents" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_identities' AND policyname='social_identities_service_role_all') THEN
    CREATE POLICY "social_identities_service_role_all" ON "public"."social_identities" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='soul_print_master' AND policyname='soul_master_insert_own') THEN
    CREATE POLICY "soul_master_insert_own" ON "public"."soul_print_master" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='soul_print_master' AND policyname='soul_master_select_own') THEN
    CREATE POLICY "soul_master_select_own" ON "public"."soul_print_master" FOR SELECT USING (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='soul_print_translations' AND policyname='soul_trans_insert_own') THEN
    CREATE POLICY "soul_trans_insert_own" ON "public"."soul_print_translations" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='soul_print_translations' AND policyname='soul_trans_select_own') THEN
    CREATE POLICY "soul_trans_select_own" ON "public"."soul_print_translations" FOR SELECT USING (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_posts' AND policyname='sp_admin_select') THEN
    CREATE POLICY "sp_admin_select" ON "public"."social_posts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."app_admins" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_posts' AND policyname='sp_insert_own') THEN
    CREATE POLICY "sp_insert_own" ON "public"."social_posts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='space_between_reports' AND policyname='space_between_select_connection_members') THEN
    CREATE POLICY "space_between_select_connection_members" ON "public"."space_between_reports" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."connections" "c"
  WHERE (("c"."id" = "space_between_reports"."connection_id") AND ("c"."is_space_between_unlocked" = true) AND (("c"."owner_user_id" = "auth"."uid"()) OR ("c"."linked_profile_id" = "auth"."uid"()))))));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='space_between_reports' AND policyname='space_between_service_role_write') THEN
    CREATE POLICY "space_between_service_role_write" ON "public"."space_between_reports" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_profile_summaries' AND policyname='sps_select_admin') THEN
    CREATE POLICY "sps_select_admin" ON "public"."social_profile_summaries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."app_admins" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_profile_summaries' AND policyname='sps_select_self') THEN
    CREATE POLICY "sps_select_self" ON "public"."social_profile_summaries" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_profile_summaries' AND policyname='sps_update_self') THEN
    CREATE POLICY "sps_update_self" ON "public"."social_profile_summaries" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_profile_summaries' AND policyname='sps_upsert_self') THEN
    CREATE POLICY "sps_upsert_self" ON "public"."social_profile_summaries" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_learn_progress' AND policyname='user_learn_progress_select_self') THEN
    CREATE POLICY "user_learn_progress_select_self" ON "public"."user_learn_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_learn_progress' AND policyname='user_learn_progress_upsert_self') THEN
    CREATE POLICY "user_learn_progress_upsert_self" ON "public"."user_learn_progress" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_year_insights' AND policyname='user_year_insights_read_own') THEN
    CREATE POLICY "user_year_insights_read_own" ON "public"."user_year_insights" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_year_transit_aspects' AND policyname='user_year_transits_read_own') THEN
    CREATE POLICY "user_year_transits_read_own" ON "public"."user_year_transit_aspects" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='year_prewarm_jobs' AND policyname='year_prewarm_jobs_read_own') THEN
    CREATE POLICY "year_prewarm_jobs_read_own" ON "public"."year_prewarm_jobs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

-- =====================
-- POLICIES
-- =====================

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feedback' AND policyname='Admins can read everything') THEN
    CREATE POLICY "Admins can read everything" ON "public"."feedback" FOR SELECT USING (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions' AND policyname='Admins can read subscriptions') THEN
    CREATE POLICY "Admins can read subscriptions" ON "public"."subscriptions" FOR SELECT USING (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='waitlist_subscribers' AND policyname='Only admins can view waitlist') THEN
    CREATE POLICY "Only admins can view waitlist" ON "public"."waitlist_subscribers" FOR SELECT USING (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sign_daily' AND policyname='Public read access to sign_daily') THEN
    CREATE POLICY "Public read access to sign_daily" ON "public"."sign_daily" FOR SELECT USING (true);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='facebook_data_deletion_requests' AND policyname='Public read by confirmation_code') THEN
    CREATE POLICY "Public read by confirmation_code" ON "public"."facebook_data_deletion_requests" FOR SELECT USING (true);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_summaries' AND policyname='Service role can manage social summaries') THEN
    CREATE POLICY "Service role can manage social summaries" ON "public"."social_summaries" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sign_daily' AND policyname='Service role updates sign_daily') THEN
    CREATE POLICY "Service role updates sign_daily" ON "public"."sign_daily" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_daily' AND policyname='Service role updates user_daily') THEN
    CREATE POLICY "Service role updates user_daily" ON "public"."user_daily" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sign_daily' AND policyname='Service role writes sign_daily') THEN
    CREATE POLICY "Service role writes sign_daily" ON "public"."sign_daily" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_daily' AND policyname='Service role writes user_daily') THEN
    CREATE POLICY "Service role writes user_daily" ON "public"."user_daily" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='connections' AND policyname='Users can delete their own connections') THEN
    CREATE POLICY "Users can delete their own connections" ON "public"."connections" FOR DELETE USING (("auth"."uid"() = "owner_user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='journal_entries' AND policyname='Users can delete their own journal') THEN
    CREATE POLICY "Users can delete their own journal" ON "public"."journal_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feedback' AND policyname='Users can insert feedback') THEN
    CREATE POLICY "Users can insert feedback" ON "public"."feedback" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("auth"."email"() = "email")));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='analytics_events' AND policyname='Users can insert their analytics events') THEN
    CREATE POLICY "Users can insert their analytics events" ON "public"."analytics_events" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("auth"."email"() = "email")));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='connections' AND policyname='Users can insert their own connections') THEN
    CREATE POLICY "Users can insert their own connections" ON "public"."connections" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='journal_entries' AND policyname='Users can insert their own journal') THEN
    CREATE POLICY "Users can insert their own journal" ON "public"."journal_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='waitlist_subscribers' AND policyname='Users can insert themselves into waitlist') THEN
    CREATE POLICY "Users can insert themselves into waitlist" ON "public"."waitlist_subscribers" FOR INSERT WITH CHECK (true);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='analytics_events' AND policyname='Users can read their analytics') THEN
    CREATE POLICY "Users can read their analytics" ON "public"."analytics_events" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."email"() = "email")));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='journal_entries' AND policyname='Users can read their own journal') THEN
    CREATE POLICY "Users can read their own journal" ON "public"."journal_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can read their own profile') THEN
    CREATE POLICY "Users can read their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='connections' AND policyname='Users can update their own connections') THEN
    CREATE POLICY "Users can update their own connections" ON "public"."connections" FOR UPDATE USING (("auth"."uid"() = "owner_user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='journal_entries' AND policyname='Users can update their own journal') THEN
    CREATE POLICY "Users can update their own journal" ON "public"."journal_entries" FOR UPDATE USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='connections' AND policyname='Users can view their own connections') THEN
    CREATE POLICY "Users can view their own connections" ON "public"."connections" FOR SELECT USING (("auth"."uid"() = "owner_user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='journal_entries' AND policyname='Users can view their own journal') THEN
    CREATE POLICY "Users can view their own journal" ON "public"."journal_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can view their own profile') THEN
    CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_summaries' AND policyname='Users can view their own social summaries') THEN
    CREATE POLICY "Users can view their own social summaries" ON "public"."social_summaries" FOR SELECT TO "authenticated" USING ((("auth"."uid"())::"text" = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_accounts' AND policyname='Users cannot delete social_accounts') THEN
    CREATE POLICY "Users cannot delete social_accounts" ON "public"."social_accounts" FOR DELETE TO "authenticated" USING (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_identities' AND policyname='Users cannot delete social_identities') THEN
    CREATE POLICY "Users cannot delete social_identities" ON "public"."social_identities" FOR DELETE USING (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_accounts' AND policyname='Users cannot insert social_accounts') THEN
    CREATE POLICY "Users cannot insert social_accounts" ON "public"."social_accounts" FOR INSERT TO "authenticated" WITH CHECK (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_identities' AND policyname='Users cannot insert social_identities') THEN
    CREATE POLICY "Users cannot insert social_identities" ON "public"."social_identities" FOR INSERT WITH CHECK (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_accounts' AND policyname='Users cannot read social_accounts') THEN
    CREATE POLICY "Users cannot read social_accounts" ON "public"."social_accounts" FOR SELECT TO "authenticated" USING (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_identities' AND policyname='Users cannot read social_identities') THEN
    CREATE POLICY "Users cannot read social_identities" ON "public"."social_identities" FOR SELECT USING (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_accounts' AND policyname='Users cannot update social_accounts') THEN
    CREATE POLICY "Users cannot update social_accounts" ON "public"."social_accounts" FOR UPDATE TO "authenticated" USING (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_identities' AND policyname='Users cannot update social_identities') THEN
    CREATE POLICY "Users cannot update social_identities" ON "public"."social_identities" FOR UPDATE USING (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='facebook_data_deletion_requests' AND policyname='Users cannot write deletion_requests') THEN
    CREATE POLICY "Users cannot write deletion_requests" ON "public"."facebook_data_deletion_requests" USING (false) WITH CHECK (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_daily' AND policyname='Users read own user_daily') THEN
    CREATE POLICY "Users read own user_daily" ON "public"."user_daily" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_invocations' AND policyname='ai_invocations_service_rw') THEN
    CREATE POLICY "ai_invocations_service_rw" ON "public"."ai_invocations" USING (false) WITH CHECK (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cache_events' AND policyname='cache_events_service_rw') THEN
    CREATE POLICY "cache_events_service_rw" ON "public"."cache_events" USING (false) WITH CHECK (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='birth_charts_cache' AND policyname='charts_insert_own') THEN
    CREATE POLICY "charts_insert_own" ON "public"."birth_charts_cache" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='birth_charts_cache' AND policyname='charts_select_own') THEN
    CREATE POLICY "charts_select_own" ON "public"."birth_charts_cache" FOR SELECT USING (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_briefs' AND policyname='daily_briefs_delete_own') THEN
    CREATE POLICY "daily_briefs_delete_own" ON "public"."daily_briefs" FOR DELETE USING (("owner_user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_briefs' AND policyname='daily_briefs_insert_own') THEN
    CREATE POLICY "daily_briefs_insert_own" ON "public"."daily_briefs" FOR INSERT WITH CHECK (("owner_user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_briefs' AND policyname='daily_briefs_select_own') THEN
    CREATE POLICY "daily_briefs_select_own" ON "public"."daily_briefs" FOR SELECT USING (("owner_user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_horoscopes' AND policyname='dh_insert_own') THEN
    CREATE POLICY "dh_insert_own" ON "public"."daily_horoscopes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_horoscopes' AND policyname='dh_select_admin') THEN
    CREATE POLICY "dh_select_admin" ON "public"."daily_horoscopes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."app_admins" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_horoscopes' AND policyname='dh_select_own') THEN
    CREATE POLICY "dh_select_own" ON "public"."daily_horoscopes" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_horoscopes' AND policyname='dh_update_own') THEN
    CREATE POLICY "dh_update_own" ON "public"."daily_horoscopes" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='family_members' AND policyname='family_members_select_self') THEN
    CREATE POLICY "family_members_select_self" ON "public"."family_members" FOR SELECT USING ((("auth"."uid"() = "owner_user_id") OR ("auth"."uid"() = "accepted_user_id")));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='family_members' AND policyname='family_members_service_role_full') THEN
    CREATE POLICY "family_members_service_role_full" ON "public"."family_members" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='foundation_ledger' AND policyname='foundation_ledger_service_rw') THEN
    CREATE POLICY "foundation_ledger_service_rw" ON "public"."foundation_ledger" USING (false) WITH CHECK (false);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='global_astrology_events' AND policyname='global_events_read_all') THEN
    CREATE POLICY "global_events_read_all" ON "public"."global_astrology_events" FOR SELECT USING (true);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='numerology_profiles' AND policyname='numerology_profiles_delete_own') THEN
    CREATE POLICY "numerology_profiles_delete_own" ON "public"."numerology_profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='numerology_profiles' AND policyname='numerology_profiles_insert_own') THEN
    CREATE POLICY "numerology_profiles_insert_own" ON "public"."numerology_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='numerology_profiles' AND policyname='numerology_profiles_select_own') THEN
    CREATE POLICY "numerology_profiles_select_own" ON "public"."numerology_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='numerology_profiles' AND policyname='numerology_profiles_update_own') THEN
    CREATE POLICY "numerology_profiles_update_own" ON "public"."numerology_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='public_compatibility' AND policyname='public_compatibility_select') THEN
    CREATE POLICY "public_compatibility_select" ON "public"."public_compatibility" FOR SELECT USING (true);
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_accounts' AND policyname='sa_service_role_all') THEN
    CREATE POLICY "sa_service_role_all" ON "public"."social_accounts" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sanctuary_journal_entries' AND policyname='sanctuary_journal_modify_self') THEN
    CREATE POLICY "sanctuary_journal_modify_self" ON "public"."sanctuary_journal_entries" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sanctuary_journal_entries' AND policyname='sanctuary_journal_select_self') THEN
    CREATE POLICY "sanctuary_journal_select_self" ON "public"."sanctuary_journal_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sanctuary_journal_entries' AND policyname='sanctuary_journal_service_role_full') THEN
    CREATE POLICY "sanctuary_journal_service_role_full" ON "public"."sanctuary_journal_entries" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='service_role_full_access_profiles') THEN
    CREATE POLICY "service_role_full_access_profiles" ON "public"."profiles" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='translation_cache' AND policyname='service_role_manage_translation_cache') THEN
    CREATE POLICY "service_role_manage_translation_cache" ON "public"."translation_cache" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='settings' AND policyname='settings_select_self') THEN
    CREATE POLICY "settings_select_self" ON "public"."settings" FOR SELECT USING (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='settings' AND policyname='settings_service_role_full') THEN
    CREATE POLICY "settings_service_role_full" ON "public"."settings" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='settings' AND policyname='settings_upsert_self') THEN
    CREATE POLICY "settings_upsert_self" ON "public"."settings" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_consents' AND policyname='social_consents_modify_self') THEN
    CREATE POLICY "social_consents_modify_self" ON "public"."social_consents" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_consents' AND policyname='social_consents_select_self') THEN
    CREATE POLICY "social_consents_select_self" ON "public"."social_consents" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_consents' AND policyname='social_consents_service_role_full') THEN
    CREATE POLICY "social_consents_service_role_full" ON "public"."social_consents" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_identities' AND policyname='social_identities_service_role_all') THEN
    CREATE POLICY "social_identities_service_role_all" ON "public"."social_identities" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='soul_print_master' AND policyname='soul_master_insert_own') THEN
    CREATE POLICY "soul_master_insert_own" ON "public"."soul_print_master" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='soul_print_master' AND policyname='soul_master_select_own') THEN
    CREATE POLICY "soul_master_select_own" ON "public"."soul_print_master" FOR SELECT USING (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='soul_print_translations' AND policyname='soul_trans_insert_own') THEN
    CREATE POLICY "soul_trans_insert_own" ON "public"."soul_print_translations" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='soul_print_translations' AND policyname='soul_trans_select_own') THEN
    CREATE POLICY "soul_trans_select_own" ON "public"."soul_print_translations" FOR SELECT USING (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_posts' AND policyname='sp_admin_select') THEN
    CREATE POLICY "sp_admin_select" ON "public"."social_posts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."app_admins" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_posts' AND policyname='sp_insert_own') THEN
    CREATE POLICY "sp_insert_own" ON "public"."social_posts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='space_between_reports' AND policyname='space_between_select_connection_members') THEN
    CREATE POLICY "space_between_select_connection_members" ON "public"."space_between_reports" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."connections" "c"
  WHERE (("c"."id" = "space_between_reports"."connection_id") AND ("c"."is_space_between_unlocked" = true) AND (("c"."owner_user_id" = "auth"."uid"()) OR ("c"."linked_profile_id" = "auth"."uid"()))))));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='space_between_reports' AND policyname='space_between_service_role_write') THEN
    CREATE POLICY "space_between_service_role_write" ON "public"."space_between_reports" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_profile_summaries' AND policyname='sps_select_admin') THEN
    CREATE POLICY "sps_select_admin" ON "public"."social_profile_summaries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."app_admins" "a"
  WHERE ("a"."user_id" = "auth"."uid"()))));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_profile_summaries' AND policyname='sps_select_self') THEN
    CREATE POLICY "sps_select_self" ON "public"."social_profile_summaries" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_profile_summaries' AND policyname='sps_update_self') THEN
    CREATE POLICY "sps_update_self" ON "public"."social_profile_summaries" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='social_profile_summaries' AND policyname='sps_upsert_self') THEN
    CREATE POLICY "sps_upsert_self" ON "public"."social_profile_summaries" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_learn_progress' AND policyname='user_learn_progress_select_self') THEN
    CREATE POLICY "user_learn_progress_select_self" ON "public"."user_learn_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_learn_progress' AND policyname='user_learn_progress_upsert_self') THEN
    CREATE POLICY "user_learn_progress_upsert_self" ON "public"."user_learn_progress" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_year_insights' AND policyname='user_year_insights_read_own') THEN
    CREATE POLICY "user_year_insights_read_own" ON "public"."user_year_insights" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_year_transit_aspects' AND policyname='user_year_transits_read_own') THEN
    CREATE POLICY "user_year_transits_read_own" ON "public"."user_year_transit_aspects" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='year_prewarm_jobs' AND policyname='year_prewarm_jobs_read_own') THEN
    CREATE POLICY "year_prewarm_jobs_read_own" ON "public"."year_prewarm_jobs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
  END IF;
END $do$;

-- =====================
-- TRIGGERS
-- =====================

