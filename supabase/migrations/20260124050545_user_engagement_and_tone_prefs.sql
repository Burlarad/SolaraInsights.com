

-- 20260124050545_user_engagement_and_tone_prefs.sql
-- Create new engagement + tone preference tables (public), and drop old archived analytics/cache tables.

-- 1) New: user_engagement_events
create table if not exists public.user_engagement_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.user_engagement_events is
  'User engagement events for personalization (e.g., insights_view with dwell/open metrics).';

create index if not exists user_engagement_events_created_at_idx
  on public.user_engagement_events(created_at);

create index if not exists user_engagement_events_user_id_created_at_idx
  on public.user_engagement_events(user_id, created_at);

create index if not exists user_engagement_events_event_idx
  on public.user_engagement_events(event);

-- RLS for engagement events
alter table public.user_engagement_events enable row level security;

-- Allow users to insert their own events (by user_id OR email match)
drop policy if exists "Users can insert their engagement events" on public.user_engagement_events;
create policy "Users can insert their engagement events"
  on public.user_engagement_events
  for insert
  with check (
    (auth.uid() is not null and auth.uid() = user_id)
    or
    (auth.email() is not null and auth.email() = email)
  );

-- Allow users to read their own events
drop policy if exists "Users can read their engagement events" on public.user_engagement_events;
create policy "Users can read their engagement events"
  on public.user_engagement_events
  for select
  using (
    (auth.uid() is not null and auth.uid() = user_id)
    or
    (auth.email() is not null and auth.email() = email)
  );

-- Service role can do anything (typical pattern)
revoke all on table public.user_engagement_events from anon, authenticated;
grant select, insert on table public.user_engagement_events to authenticated;
grant all on table public.user_engagement_events to service_role;


-- 2) New: insight_tone_prefs
create table if not exists public.insight_tone_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lane_scores jsonb not null default '{}'::jsonb,
  last_lane text,
  last_variant text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.insight_tone_prefs is
  'Rolling tone preference state for daily insight lane selection (3–5 day memory).';

create index if not exists insight_tone_prefs_updated_at_idx
  on public.insight_tone_prefs(updated_at);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_insight_tone_prefs_updated_at on public.insight_tone_prefs;
create trigger trg_insight_tone_prefs_updated_at
before update on public.insight_tone_prefs
for each row execute function public.set_updated_at();

-- RLS for tone prefs
alter table public.insight_tone_prefs enable row level security;

drop policy if exists "Users can read their tone prefs" on public.insight_tone_prefs;
create policy "Users can read their tone prefs"
  on public.insight_tone_prefs
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can upsert their tone prefs" on public.insight_tone_prefs;
create policy "Users can upsert their tone prefs"
  on public.insight_tone_prefs
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their tone prefs" on public.insight_tone_prefs;
create policy "Users can update their tone prefs"
  on public.insight_tone_prefs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on table public.insight_tone_prefs from anon, authenticated;
grant select, insert, update on table public.insight_tone_prefs to authenticated;
grant all on table public.insight_tone_prefs to service_role;


-- 3) Drop old archived tables (user requested deletion)
drop table if exists archive.analytics_events;
drop table if exists archive.cache_events;