drop extension if exists "pg_net";

drop trigger if exists "trg_insight_tone_prefs_updated_at" on "public"."insight_tone_prefs";

drop policy "Service role can read charts" on "public"."charts";

drop policy "Service role can update charts" on "public"."charts";

drop policy "Service role can write charts" on "public"."charts";

drop policy "Users can read their tone prefs" on "public"."insight_tone_prefs";

drop policy "Users can update their tone prefs" on "public"."insight_tone_prefs";

drop policy "Users can upsert their tone prefs" on "public"."insight_tone_prefs";

drop policy "Service role can read numerology" on "public"."numerology_library";

drop policy "Service role can update numerology" on "public"."numerology_library";

drop policy "Service role can write numerology" on "public"."numerology_library";

drop policy "profiles_insert_own" on "public"."profiles";

drop policy "profiles_select_own" on "public"."profiles";

drop policy "profiles_update_own" on "public"."profiles";

drop policy "public_compatibility_insert_policy" on "public"."public_compatibility";

drop policy "public_compatibility_select_policy" on "public"."public_compatibility";

drop policy "Users can insert their engagement events" on "public"."user_engagement_events";

drop policy "Users can read their engagement events" on "public"."user_engagement_events";

revoke delete on table "public"."charts" from "service_role";

revoke insert on table "public"."charts" from "service_role";

revoke references on table "public"."charts" from "service_role";

revoke select on table "public"."charts" from "service_role";

revoke trigger on table "public"."charts" from "service_role";

revoke truncate on table "public"."charts" from "service_role";

revoke update on table "public"."charts" from "service_role";

revoke update on table "public"."daily_briefs" from "authenticated";

revoke insert on table "public"."insight_tone_prefs" from "authenticated";

revoke select on table "public"."insight_tone_prefs" from "authenticated";

revoke update on table "public"."insight_tone_prefs" from "authenticated";

revoke delete on table "public"."insight_tone_prefs" from "service_role";

revoke insert on table "public"."insight_tone_prefs" from "service_role";

revoke references on table "public"."insight_tone_prefs" from "service_role";

revoke select on table "public"."insight_tone_prefs" from "service_role";

revoke trigger on table "public"."insight_tone_prefs" from "service_role";

revoke truncate on table "public"."insight_tone_prefs" from "service_role";

revoke update on table "public"."insight_tone_prefs" from "service_role";

revoke delete on table "public"."numerology_library" from "service_role";

revoke insert on table "public"."numerology_library" from "service_role";

revoke references on table "public"."numerology_library" from "service_role";

revoke select on table "public"."numerology_library" from "service_role";

revoke trigger on table "public"."numerology_library" from "service_role";

revoke truncate on table "public"."numerology_library" from "service_role";

revoke update on table "public"."numerology_library" from "service_role";

revoke update on table "public"."space_between_reports" from "authenticated";

revoke insert on table "public"."user_engagement_events" from "authenticated";

revoke select on table "public"."user_engagement_events" from "authenticated";

revoke delete on table "public"."user_engagement_events" from "service_role";

revoke insert on table "public"."user_engagement_events" from "service_role";

revoke references on table "public"."user_engagement_events" from "service_role";

revoke select on table "public"."user_engagement_events" from "service_role";

revoke trigger on table "public"."user_engagement_events" from "service_role";

revoke truncate on table "public"."user_engagement_events" from "service_role";

revoke update on table "public"."user_engagement_events" from "service_role";

alter table "public"."insight_tone_prefs" drop constraint "insight_tone_prefs_user_id_fkey";

alter table "public"."user_engagement_events" drop constraint "user_engagement_events_user_id_fkey";

drop function if exists "public"."update_chart_access"();

drop function if exists "public"."update_numerology_access"();

alter table "public"."charts" drop constraint "charts_pkey";

alter table "public"."insight_tone_prefs" drop constraint "insight_tone_prefs_pkey";

alter table "public"."numerology_library" drop constraint "numerology_library_pkey";

alter table "public"."user_engagement_events" drop constraint "user_engagement_events_pkey";

drop index if exists "public"."charts_pkey";

drop index if exists "public"."idx_charts_created_at";

drop index if exists "public"."idx_charts_last_accessed";

drop index if exists "public"."idx_numerology_created_at";

drop index if exists "public"."idx_numerology_last_accessed";

drop index if exists "public"."idx_profiles_membership_plan";

drop index if exists "public"."idx_profiles_official_chart_key";

drop index if exists "public"."idx_profiles_official_numerology_key";

drop index if exists "public"."idx_profiles_role";

drop index if exists "public"."idx_profiles_subscription_status";

drop index if exists "public"."idx_social_summaries_expires_at";

drop index if exists "public"."insight_tone_prefs_pkey";

drop index if exists "public"."insight_tone_prefs_updated_at_idx";

drop index if exists "public"."numerology_library_pkey";

drop index if exists "public"."user_engagement_events_created_at_idx";

drop index if exists "public"."user_engagement_events_event_idx";

drop index if exists "public"."user_engagement_events_pkey";

drop index if exists "public"."user_engagement_events_user_id_created_at_idx";

drop table "public"."charts";

drop table "public"."insight_tone_prefs";

drop table "public"."numerology_library";

drop table "public"."user_engagement_events";


  create table "archive"."analytics_events" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "email" text,
    "event" text not null,
    "payload" jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "archive"."analytics_events" enable row level security;


  create table "archive"."cache_events" (
    "id" uuid not null default gen_random_uuid(),
    "feature" text not null,
    "cache_key" text not null,
    "cache_hit" boolean not null,
    "age_ms" integer,
    "latency_ms" integer not null,
    "model" text not null,
    "prompt_version" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "archive"."cache_events" enable row level security;

alter table "public"."profiles" drop column "membership_updated_at";

alter table "public"."profiles" drop column "official_chart_key";

alter table "public"."profiles" drop column "official_numerology_key";

alter table "public"."social_summaries" drop column "expires_at";

alter table "public"."social_summaries" drop column "metadata_json";

alter table "public"."social_summaries" drop column "summary_text";

CREATE INDEX analytics_events_created_at_idx ON archive.analytics_events USING btree (created_at);

CREATE INDEX analytics_events_event_idx ON archive.analytics_events USING btree (event);

CREATE UNIQUE INDEX analytics_events_pkey ON archive.analytics_events USING btree (id);

CREATE UNIQUE INDEX cache_events_pkey ON archive.cache_events USING btree (id);

CREATE INDEX idx_cache_events_cache_hit_created ON archive.cache_events USING btree (cache_hit, created_at);

CREATE INDEX idx_cache_events_created_at ON archive.cache_events USING btree (created_at);

CREATE INDEX idx_cache_events_feature_created ON archive.cache_events USING btree (feature, created_at);

alter table "archive"."analytics_events" add constraint "analytics_events_pkey" PRIMARY KEY using index "analytics_events_pkey";

alter table "archive"."cache_events" add constraint "cache_events_pkey" PRIMARY KEY using index "cache_events_pkey";

alter table "archive"."analytics_events" add constraint "analytics_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "archive"."analytics_events" validate constraint "analytics_events_user_id_fkey";

create or replace view "public"."vw_transit_cache_efficiency" as  SELECT date_trunc('day'::text, created_at) AS day,
    (avg(
        CASE
            WHEN cache_hit THEN 1.0
            ELSE 0.0
        END))::double precision AS hit_rate,
    percentile_cont((0.95)::double precision) WITHIN GROUP (ORDER BY (((latency_ms)::numeric)::double precision)) AS p95_latency_ms,
    percentile_cont((0.99)::double precision) WITHIN GROUP (ORDER BY (((latency_ms)::numeric)::double precision)) AS p99_latency_ms
   FROM archive.cache_events
  WHERE ((feature = 'transits_today'::text) AND (created_at >= (now() - '30 days'::interval)))
  GROUP BY (date_trunc('day'::text, created_at))
  ORDER BY (date_trunc('day'::text, created_at));


create or replace view "public"."vw_transit_hit_miss" as  SELECT date_trunc('day'::text, created_at) AS day,
    (sum(
        CASE
            WHEN cache_hit THEN 1
            ELSE 0
        END))::integer AS hits,
    (sum(
        CASE
            WHEN cache_hit THEN 0
            ELSE 1
        END))::integer AS misses
   FROM archive.cache_events
  WHERE ((feature = 'transits_today'::text) AND (created_at >= (now() - '30 days'::interval)))
  GROUP BY (date_trunc('day'::text, created_at))
  ORDER BY (date_trunc('day'::text, created_at));


create or replace view "public"."vw_transit_usage_pulse" as  SELECT date_trunc('day'::text, created_at) AS day,
    (count(*))::integer AS requests
   FROM archive.cache_events
  WHERE ((feature = 'transits_today'::text) AND (created_at >= (now() - '30 days'::interval)))
  GROUP BY (date_trunc('day'::text, created_at))
  ORDER BY (date_trunc('day'::text, created_at));


grant delete on table "archive"."analytics_events" to "service_role";

grant insert on table "archive"."analytics_events" to "service_role";

grant references on table "archive"."analytics_events" to "service_role";

grant select on table "archive"."analytics_events" to "service_role";

grant trigger on table "archive"."analytics_events" to "service_role";

grant truncate on table "archive"."analytics_events" to "service_role";

grant update on table "archive"."analytics_events" to "service_role";

grant delete on table "archive"."cache_events" to "service_role";

grant insert on table "archive"."cache_events" to "service_role";

grant references on table "archive"."cache_events" to "service_role";

grant select on table "archive"."cache_events" to "service_role";

grant trigger on table "archive"."cache_events" to "service_role";

grant truncate on table "archive"."cache_events" to "service_role";

grant update on table "archive"."cache_events" to "service_role";


  create policy "Users can insert their analytics events"
  on "archive"."analytics_events"
  as permissive
  for insert
  to public
with check (((auth.uid() = user_id) OR (auth.email() = email)));



  create policy "Users can read their analytics"
  on "archive"."analytics_events"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR (auth.email() = email)));



  create policy "cache_events_service_rw"
  on "archive"."cache_events"
  as permissive
  for all
  to public
using (false)
with check (false);


CREATE TRIGGER update_family_members_updated_at BEFORE UPDATE ON archive.family_members FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER translation_cache_set_updated_at BEFORE UPDATE ON archive.translation_cache FOR EACH ROW EXECUTE FUNCTION public.translation_cache_set_updated_at();

CREATE TRIGGER trg_connections_maintain_flags AFTER INSERT OR DELETE OR UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.connections_maintain_flags();

CREATE TRIGGER trg_maintain_mutual_flag AFTER INSERT OR DELETE OR UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.maintain_mutual_flag();

CREATE TRIGGER trg_numerology_profiles_updated_at BEFORE UPDATE ON public.numerology_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER social_accounts_updated_at BEFORE UPDATE ON public.social_accounts FOR EACH ROW EXECUTE FUNCTION public.update_social_accounts_updated_at();

CREATE TRIGGER update_social_consents_updated_at BEFORE UPDATE ON public.social_consents FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER social_identities_set_updated_at BEFORE UPDATE ON public.social_identities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER social_identities_updated_at BEFORE UPDATE ON public.social_identities FOR EACH ROW EXECUTE FUNCTION public.update_social_identities_updated_at();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER year_prewarm_jobs_set_updated_at BEFORE UPDATE ON public.year_prewarm_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


