-- Allow security-definer boss_set_member_access to update privileged profile
-- columns. The BEFORE UPDATE trigger otherwise blocks every change, including
-- the intentional RPC path.

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Local (transaction-scoped) bypass set by boss_set_member_access only.
  if current_setting('app.allow_privileged_profile_update', true) = 'on' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.role is distinct from old.role
     or new.finance_authorized is distinct from old.finance_authorized
     or new.access_template is distinct from old.access_template
     or new.role_group_name is distinct from old.role_group_name
     or new.role_group_id is distinct from old.role_group_id
     or new.features is distinct from old.features
     or new.permission_overrides is distinct from old.permission_overrides then
    raise exception 'privileged profile fields cannot be changed by clients';
  end if;
  return new;
end;
$$;

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
  if p_access_template = 'owner' then
    raise exception '不可將他人設為老闆身分';
  end if;

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

  -- Transaction-local: lets protect_profile_privileged_columns allow this update.
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

notify pgrst, 'reload schema';
