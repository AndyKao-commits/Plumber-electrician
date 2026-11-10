-- Security hardening for already-applied databases.
-- Run once in Supabase SQL Editor after the publish-blocking review findings.

create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_user_org_id() from public;
grant execute on function public.current_user_org_id() to authenticated;

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.role is distinct from old.role
     or new.finance_authorized is distinct from old.finance_authorized then
    raise exception 'privileged profile fields cannot be changed by clients';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileged_columns on public.profiles;
create trigger trg_protect_profile_privileged_columns
  before update on public.profiles
  for each row
  execute function public.protect_profile_privileged_columns();

revoke update on table public.profiles from authenticated, anon;
grant update (name, email, phone, line_user_id, pay_type)
  on table public.profiles to authenticated;

drop policy if exists "profiles_read_same_org" on public.profiles;
create policy "profiles_read_same_org" on public.profiles for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid() and organization_id = public.current_user_org_id())
  with check (
    id = auth.uid()
    and organization_id = public.current_user_org_id()
  );

drop policy if exists "sites_org_all" on public.sites;
create policy "sites_org_all" on public.sites for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "attendance_read_presence_or_own" on public.attendance;
create policy "attendance_read_presence_or_own" on public.attendance for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "attendance_write_own" on public.attendance;
create policy "attendance_write_own" on public.attendance for insert to authenticated
  with check (
    user_id = auth.uid()
    and organization_id = public.current_user_org_id()
  );

drop policy if exists "attendance_update_own" on public.attendance;
create policy "attendance_update_own" on public.attendance for update to authenticated
  using (
    user_id = auth.uid()
    and organization_id = public.current_user_org_id()
  )
  with check (
    user_id = auth.uid()
    and organization_id = public.current_user_org_id()
  );

drop policy if exists "purchases_org_read" on public.purchases;
create policy "purchases_org_read" on public.purchases for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "purchases_insert_own" on public.purchases;
create policy "purchases_insert_own" on public.purchases for insert to authenticated
  with check (
    user_id = auth.uid()
    and organization_id = public.current_user_org_id()
  );

drop policy if exists "notices_own" on public.notices;
create policy "notices_own" on public.notices for all to authenticated
  using (
    user_id = auth.uid()
    and organization_id = public.current_user_org_id()
  )
  with check (
    user_id = auth.uid()
    and organization_id = public.current_user_org_id()
  );
