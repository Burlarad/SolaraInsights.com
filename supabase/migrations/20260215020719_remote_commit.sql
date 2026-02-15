-- Remote schema commit (hardened for idempotency + missing storage helper functions)

-- 1) numerology_profiles: add columns + unique constraint (idempotent)
-- PRODUCTION-SAFE: Entire block skipped with NOTICE if table doesn't exist.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'numerology_profiles'
  ) then
    raise notice 'Table public.numerology_profiles does not exist, skipping column additions and constraint';
    return;
  end if;

  -- Add columns (IF NOT EXISTS makes each idempotent)
  alter table public.numerology_profiles add column if not exists config_version text;
  alter table public.numerology_profiles add column if not exists input_json jsonb;
  alter table public.numerology_profiles add column if not exists numerology_json jsonb;
  alter table public.numerology_profiles add column if not exists numerology_key text;

  -- Ensure numerology_key has a unique index
  create unique index if not exists numerology_profiles_numerology_key_key
    on public.numerology_profiles using btree (numerology_key);

  -- Promote index to constraint if not already present
  if not exists (
    select 1
    from pg_constraint c
    where c.conname = 'numerology_profiles_numerology_key_key'
      and c.conrelid = 'public.numerology_profiles'::regclass
  ) then
    alter table public.numerology_profiles
      add constraint numerology_profiles_numerology_key_key
      unique using index numerology_profiles_numerology_key_key;
  end if;
end $$;

-- 3) Storage triggers
-- Guard the delete_prefix_hierarchy_trigger() because some local/remote storage schemas do not include it.

do $$
begin
  -- Create/update prefix triggers are present in most Supabase storage schemas,
  -- but some local/remote variants may not include them.
  -- Guard each trigger by BOTH function AND table existence to prevent
  -- "relation does not exist" errors in environments with partial storage schemas.

  -- storage.objects_insert_prefix_trigger()
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'storage' and p.proname = 'objects_insert_prefix_trigger'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    drop trigger if exists objects_insert_create_prefix on storage.objects;
    create trigger objects_insert_create_prefix
      before insert on storage.objects
      for each row
      execute function storage.objects_insert_prefix_trigger();
  else
    raise notice 'storage.objects_insert_prefix_trigger() or storage.objects missing, skipping objects_insert_create_prefix trigger';
  end if;

  -- storage.objects_update_prefix_trigger()
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'storage' and p.proname = 'objects_update_prefix_trigger'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    drop trigger if exists objects_update_create_prefix on storage.objects;
    create trigger objects_update_create_prefix
      before update on storage.objects
      for each row
      when ((new.name <> old.name) or (new.bucket_id <> old.bucket_id))
      execute function storage.objects_update_prefix_trigger();
  else
    raise notice 'storage.objects_update_prefix_trigger() or storage.objects missing, skipping objects_update_create_prefix trigger';
  end if;

  -- storage.prefixes_insert_trigger()
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'storage' and p.proname = 'prefixes_insert_trigger'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'prefixes'
  ) then
    drop trigger if exists prefixes_create_hierarchy on storage.prefixes;
    create trigger prefixes_create_hierarchy
      before insert on storage.prefixes
      for each row
      when (pg_trigger_depth() < 1)
      execute function storage.prefixes_insert_trigger();
  else
    raise notice 'storage.prefixes_insert_trigger() or storage.prefixes missing, skipping prefixes_create_hierarchy trigger';
  end if;

  -- storage.delete_prefix_hierarchy_trigger()
  -- This function targets BOTH storage.objects AND storage.prefixes,
  -- so we guard with existence checks for both tables.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'storage' and p.proname = 'delete_prefix_hierarchy_trigger'
  ) then
    -- objects delete trigger (guard table existence)
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'storage' and table_name = 'objects'
    ) then
      drop trigger if exists objects_delete_delete_prefix on storage.objects;
      create trigger objects_delete_delete_prefix
        after delete on storage.objects
        for each row
        execute function storage.delete_prefix_hierarchy_trigger();
    else
      raise notice 'storage.objects missing, skipping objects_delete_delete_prefix trigger';
    end if;

    -- prefixes delete trigger (guard table existence)
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'storage' and table_name = 'prefixes'
    ) then
      drop trigger if exists prefixes_delete_hierarchy on storage.prefixes;
      create trigger prefixes_delete_hierarchy
        after delete on storage.prefixes
        for each row
        execute function storage.delete_prefix_hierarchy_trigger();
    else
      raise notice 'storage.prefixes missing, skipping prefixes_delete_hierarchy trigger';
    end if;
  else
    raise notice 'storage.delete_prefix_hierarchy_trigger() missing, skipping delete-prefix triggers';
  end if;
end $$;
