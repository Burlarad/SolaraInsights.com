-- Baseline: create profiles table (matches production schema)

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  name text,
  preferred_name text,
  birth_date date,
  birth_place text,
  birth_time text,
  sign text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  full_name text,
  birth_city text,
  birth_region text,
  birth_country text,
  timezone text NOT NULL DEFAULT 'UTC',
  zodiac_sign text,
  language text NOT NULL DEFAULT 'en',
  is_onboarded boolean NOT NULL DEFAULT false,
  onboarding_started_at timestamptz,
  onboarding_completed_at timestamptz,
  membership_plan text NOT NULL DEFAULT 'none',
  is_comped boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'user',
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  location_for_charity text,
  latitude double precision,
  longitude double precision,
  birth_lat double precision,
  birth_lon double precision,
  birth_chart_placements_json jsonb,
  birth_chart_computed_at timestamptz,
  last_seen_at timestamptz,
  current_birth_version_id uuid,
  local_timezone text,
  last_social_sync_at timestamptz,
  last_social_sync_local_date date,
  social_sync_status text,
  social_sync_error text,
  first_name text,
  middle_name text,
  last_name text,
  social_insights_enabled boolean NOT NULL DEFAULT false,
  social_insights_activated_at timestamptz,
  is_hibernated boolean NOT NULL DEFAULT false,
  hibernated_at timestamptz,
  reactivated_at timestamptz,
  stripe_email text,
  social_connect_prompt_dismissed_at timestamptz,
  membership_updated_at timestamptz,
  CONSTRAINT profiles_local_timezone_not_blank CHECK (local_timezone IS NULL OR btrim(local_timezone) <> '')
);

-- Primary key (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pkey') THEN
    ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Foreign key to auth.users (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Unique email constraint (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key') THEN
    ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
END $$;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY "profiles_select_own" ON public.profiles
      FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY "profiles_insert_own" ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own" ON public.profiles
      FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Common indexes
CREATE INDEX IF NOT EXISTS idx_profiles_membership_plan ON public.profiles(membership_plan);
CREATE INDEX IF NOT EXISTS idx_profiles_is_hibernated ON public.profiles(is_hibernated);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
