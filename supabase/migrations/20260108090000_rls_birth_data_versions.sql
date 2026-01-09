-- Migration: Enable RLS + policies for birth_data_versions
-- PR3: Remaining RLS hardening

begin;

alter table public.birth_data_versions enable row level security;

-- User-scoped policies (auth user can only access their own rows)
create policy "birth_data_versions_select_own"
on public.birth_data_versions
for select
using (auth.uid() = user_id);

create policy "birth_data_versions_insert_own"
on public.birth_data_versions
for insert
with check (auth.uid() = user_id);

create policy "birth_data_versions_update_own"
on public.birth_data_versions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "birth_data_versions_delete_own"
on public.birth_data_versions
for delete
using (auth.uid() = user_id);

-- Service role policy (server/admin jobs)
create policy "birth_data_versions_service_role_all"
on public.birth_data_versions
for all
to service_role
using (true)
with check (true);

commit;
