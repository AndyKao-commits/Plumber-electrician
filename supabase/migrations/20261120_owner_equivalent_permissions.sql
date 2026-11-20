-- Make access_template = 'owner' a true owner-equivalent authorization role.
-- The original profiles.role = 'boss' account remains protected from deletion/demotion.
-- Business self-approval prohibitions remain enforced separately.

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(access_template, '') = 'owner' then 'boss'
    else role::text
  end
  from public.profiles
  where id = auth.uid()
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

comment on function public.current_user_role() is
  'Effective authorization role. Delegated owner template resolves to boss while the stored profile role remains employee.';

-- These two older policy families inspected profiles.role directly, so make
-- them use the effective role helper as well.
drop policy if exists "attendance_corrections_select_own_or_approver"
  on public.attendance_corrections;
create policy "attendance_corrections_select_own_or_approver"
  on public.attendance_corrections for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('boss', 'owner', 'admin')
    )
  );

drop policy if exists "attendance_corrections_update_approver"
  on public.attendance_corrections;
create policy "attendance_corrections_update_approver"
  on public.attendance_corrections for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner', 'admin')
  )
  with check (organization_id = public.current_user_org_id());

drop policy if exists "location_checkins_select_own_or_boss"
  on public.location_checkins;
create policy "location_checkins_select_own_or_boss"
  on public.location_checkins for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('boss', 'owner', 'admin')
    )
  );

drop policy if exists "location_checkins_update_boss"
  on public.location_checkins;
create policy "location_checkins_update_boss"
  on public.location_checkins for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner', 'admin')
  )
  with check (organization_id = public.current_user_org_id());

-- Delegated owners must also receive approval notifications.
create or replace function public.list_approver_ids(
  p_exclude_self boolean default true
)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(p.id), array[]::uuid[])
  from public.profiles p
  where p.organization_id = public.current_user_org_id()
    and (
      p.role::text in ('boss', 'owner', 'admin')
      or coalesce(p.access_template, '') = 'owner'
    )
    and (not p_exclude_self or p.id is distinct from auth.uid());
$$;

revoke all on function public.list_approver_ids(boolean) from public;
grant execute on function public.list_approver_ids(boolean) to authenticated;

create or replace function public.create_notices_for_roles(
  p_roles text[],
  p_kind text,
  p_title text,
  p_detail text default '',
  p_href text default null,
  p_as_todo boolean default true,
  p_exclude_self boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_ids uuid[];
begin
  if v_org is null then
    raise exception '無法決定組織';
  end if;

  select coalesce(array_agg(p.id), array[]::uuid[])
    into v_ids
  from public.profiles p
  where p.organization_id = v_org
    and (
      p.role::text = any (p_roles)
      or (
        coalesce(p.access_template, '') = 'owner'
        and (
          'boss' = any (p_roles)
          or 'owner' = any (p_roles)
        )
      )
    )
    and (not p_exclude_self or p.id is distinct from auth.uid());

  return public.create_org_notices(
    v_ids,
    p_kind,
    p_title,
    p_detail,
    p_href,
    p_as_todo
  );
end;
$$;

revoke all on function public.create_notices_for_roles(
  text[], text, text, text, text, boolean, boolean
) from public;
grant execute on function public.create_notices_for_roles(
  text[], text, text, text, text, boolean, boolean
) to authenticated;

notify pgrst, 'reload schema';
