-- 20260124051348_drop_gender_from_profiles.sql
-- Remove gender from profiles (we do not collect gender)

alter table public.profiles
  drop column if exists gender;
