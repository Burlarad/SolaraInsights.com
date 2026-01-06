-- Create connections table (ported from production schema)
-- Canonical migration: required for Connections + Space Between features.

CREATE TABLE IF NOT EXISTS public.connections (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id uuid NOT NULL,
  linked_profile_id uuid,
  name text NOT NULL,
  relationship_type text NOT NULL,
  birth_date date,
  birth_time time without time zone,
  birth_city text,
  birth_region text,
  birth_country text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  notes text,
  is_mutual boolean DEFAULT false NOT NULL,
  space_between_enabled boolean DEFAULT true NOT NULL,
  is_space_between_unlocked boolean DEFAULT false NOT NULL,
  birth_lat double precision,
  birth_lon double precision,
  timezone text,
  first_name text,
  middle_name text,
  last_name text,
  CONSTRAINT connections_birth_lat_range CHECK (
    birth_lat IS NULL OR (birth_lat >= -90 AND birth_lat <= 90)
  ),
  CONSTRAINT connections_birth_lon_range CHECK (
    birth_lon IS NULL OR (birth_lon >= -180 AND birth_lon <= 180)
  ),
  CONSTRAINT connections_timezone_not_blank CHECK (
    timezone IS NULL OR btrim(timezone) <> ''
  )
);

-- Primary key (match prod constraint name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'connections_pkey'
  ) THEN
    ALTER TABLE ONLY public.connections
      ADD CONSTRAINT connections_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Indexes (match prod)
CREATE INDEX IF NOT EXISTS idx_connections_owner
  ON public.connections (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_connections_linked_owner
  ON public.connections (linked_profile_id, owner_user_id)
  WHERE linked_profile_id IS NOT NULL;

-- RLS + Policies (match prod intent)
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='connections' AND policyname='Users can view their own connections') THEN
    CREATE POLICY "Users can view their own connections"
      ON public.connections
      FOR SELECT
      USING (auth.uid() = owner_user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='connections' AND policyname='Users can insert their own connections') THEN
    CREATE POLICY "Users can insert their own connections"
      ON public.connections
      FOR INSERT
      WITH CHECK (auth.uid() = owner_user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='connections' AND policyname='Users can update their own connections') THEN
    CREATE POLICY "Users can update their own connections"
      ON public.connections
      FOR UPDATE
      USING (auth.uid() = owner_user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='connections' AND policyname='Users can delete their own connections') THEN
    CREATE POLICY "Users can delete their own connections"
      ON public.connections
      FOR DELETE
      USING (auth.uid() = owner_user_id);
  END IF;
END $$;
