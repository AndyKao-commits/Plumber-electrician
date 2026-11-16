-- Allow primary boss to grant access_template = 'owner' (等同老闆權限) to a field account.
-- Add current_user_is_boss_like() so delegated owners can 結案／審核／薪資等營運操作.

create or replace function public.current_user_is_boss_like()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role::text in ('boss', 'owner')
        or coalesce(p.access_template, '') = 'owner'
      )
  );
$$;

revoke all on function public.current_user_is_boss_like() from public;
grant execute on function public.current_user_is_boss_like() to authenticated;

create or replace function public.boss_set_member_access(
  p_target_user_id uuid,
  p_role_group_name text,
  p_access_template text,
  p_finance_authorized boolean,
  p_role_group_id uuid default null,
  p_features jsonb default null,
  p_permission_overrides jsonb default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_actor_org uuid;
  v_row public.profiles;
begin
  v_actor_role := public.current_user_role()::text;
  v_actor_org := public.current_user_org_id();
  if v_actor_role is distinct from 'boss' and v_actor_role is distinct from 'owner' then
    raise exception '僅老闆可設定權限';
  end if;
  if p_access_template is null or p_access_template not in ('owner', 'admin', 'member') then
    raise exception '身分模板無效';
  end if;
  -- owner template = 等同老闆營運權限（profiles.role 仍為 employee）

  select * into v_row from public.profiles where id = p_target_user_id;
  if not found then
    raise exception '找不到使用者';
  end if;
  if v_row.organization_id is distinct from v_actor_org then
    raise exception '不得跨組織設定';
  end if;
  if v_row.role::text in ('boss', 'owner') then
    raise exception '不可變更老闆帳號的身分組';
  end if;

  perform set_config('app.allow_privileged_profile_update', 'on', true);

  update public.profiles
  set
    role_group_name = nullif(trim(p_role_group_name), ''),
    role_group_id = p_role_group_id,
    access_template = p_access_template,
    finance_authorized = coalesce(p_finance_authorized, false),
    features = p_features,
    permission_overrides = p_permission_overrides
  where id = p_target_user_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.boss_set_member_access(uuid, text, text, boolean, uuid, jsonb, jsonb) from public;
grant execute on function public.boss_set_member_access(uuid, text, text, boolean, uuid, jsonb, jsonb) to authenticated;

-- site_members write: delegated boss (+ legacy admin role)
drop policy if exists "site_members_boss_write" on public.site_members;
create policy "site_members_boss_write"
  on public.site_members for all to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      public.current_user_is_boss_like()
      or public.current_user_role() = 'admin'
    )
  )
  with check (
    organization_id = public.current_user_org_id()
    and (
      public.current_user_is_boss_like()
      or public.current_user_role() = 'admin'
    )
  );

-- profile boss update (停用帳號等)
drop policy if exists "profiles_boss_update" on public.profiles;
create policy "profiles_boss_update"
  on public.profiles for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_is_boss_like()
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_is_boss_like()
  );

-- org spend settings
drop policy if exists "org_spend_settings_boss_write" on public.org_spend_settings;
create policy "org_spend_settings_boss_write"
  on public.org_spend_settings for all to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_is_boss_like()
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_is_boss_like()
  );

-- employee advances boss paths
drop policy if exists "employee_advances_select_own_or_boss" on public.employee_advances;
create policy "employee_advances_select_own_or_boss"
  on public.employee_advances for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      employee_id = auth.uid()
      or public.current_user_is_boss_like()
    )
  );

drop policy if exists "employee_advances_update_boss" on public.employee_advances;
create policy "employee_advances_update_boss"
  on public.employee_advances for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      public.current_user_is_boss_like()
      or (employee_id = auth.uid() and status = 'open')
    )
  )
  with check (organization_id = public.current_user_org_id());

-- salary module
drop policy if exists "pay_settings_select_own_or_boss" on public.employee_pay_settings;
create policy "pay_settings_select_own_or_boss"
  on public.employee_pay_settings for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      user_id = auth.uid()
      or public.current_user_is_boss_like()
    )
  );

drop policy if exists "pay_settings_boss_write" on public.employee_pay_settings;
create policy "pay_settings_boss_write"
  on public.employee_pay_settings for all to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_is_boss_like()
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_is_boss_like()
  );

drop policy if exists "salary_entries_select_own_or_boss" on public.salary_entries;
create policy "salary_entries_select_own_or_boss"
  on public.salary_entries for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      user_id = auth.uid()
      or public.current_user_is_boss_like()
    )
  );

drop policy if exists "salary_entries_boss_write" on public.salary_entries;
create policy "salary_entries_boss_write"
  on public.salary_entries for all to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_is_boss_like()
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_is_boss_like()
  );

drop policy if exists "salary_corrections_select_own_or_boss" on public.salary_entry_corrections;
create policy "salary_corrections_select_own_or_boss"
  on public.salary_entry_corrections for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      public.current_user_is_boss_like()
      or exists (
        select 1 from public.salary_entries e
        where e.id = salary_entry_id and e.user_id = auth.uid()
      )
    )
  );

drop policy if exists "salary_corrections_boss_insert" on public.salary_entry_corrections;
create policy "salary_corrections_boss_insert"
  on public.salary_entry_corrections for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_is_boss_like()
  );

notify pgrst, 'reload schema';
