-- Add narrative caching columns to soul_paths table
-- This enables "stone tablet" caching: Soul Print AI narratives should NEVER change
-- unless birth data, schema, prompt version, or language changes.
--
-- Migration: 004_add_soul_path_narrative_caching.sql
-- Run with: psql $DATABASE_URL -f sql/004_add_soul_path_narrative_caching.sql

-- Add narrative caching columns
alter table public.soul_paths
add column if not exists soul_path_narrative_json jsonb,
add column if not exists narrative_prompt_version int default 1,
add column if not exists narrative_language text,
add column if not exists narrative_model text,
add column if not exists narrative_generated_at timestamptz;

-- Add index for efficient narrative lookup
create index if not exists soul_paths_narrative_idx
on public.soul_paths (narrative_prompt_version, narrative_language);

-- Add comment explaining the caching strategy
comment on column public.soul_paths.soul_path_narrative_json is
'Cached AI-generated Soul Print narrative. Never regenerated unless birth_input_hash, schema_version, narrative_prompt_version, or narrative_language changes.';

comment on column public.soul_paths.narrative_prompt_version is
'Prompt version used to generate this narrative. Increment to invalidate and regenerate all narratives.';

comment on column public.soul_paths.narrative_language is
'Language code (e.g., "en", "es") for this narrative. Each language is cached separately.';
