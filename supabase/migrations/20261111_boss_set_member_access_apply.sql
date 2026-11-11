-- Idempotent apply for role-group access RPC (fixes production schema-cache miss).

alter table public.profiles
  add column if not exists role_group_name text,
  add column if not exists access_template text;

do $$
begin
  alter table public.profiles
    drop constraint if exists profiles_access_template_check;
exception when undefined_object then
  null;
end $$;

alter table public.profiles
  add constraint profiles_access_template_check
  check (
    access_template is null
    or access_template in ('owner', 'admin', 'member')
  );

create table if not exists public.org_role_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  template text not null check (template in ('owner', 'admin', 'member', 'finance')),
  finance_authorized boolean not null default false,
  permissions jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  unique (organization_id, name)
);

alter table public.org_role_groups
  add column if not exists permissions jsonb;

alter table public.org_role_groups enable row level security;

drop policy if exists "org_role_groups_org_select" on public.org_role_groups;
create policy "org_role_groups_org_select"
  on public.org_role_groups for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "org_role_groups_boss_write" on public.org_role_groups;
create policy "org_role_groups_boss_write"
  on public.org_role_groups for all to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner')
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner')
  );

drop trigger if exists trg_set_org_org_role_groups on public.org_role_groups;
create trigger trg_set_org_org_role_groups
  before insert on public.org_role_groups
  for each row execute function public.set_org_id_from_profile();

alter table public.profiles
  add column if not exists role_group_id uuid,
  add column if not exists features jsonb,
  add column if not exists permission_overrides jsonb;

do $$
begin
  alter table public.profiles
    drop constraint if exists profiles_role_group_id_fkey;
exception when undefined_object then
  null;
end $$;

alter table public.profiles
  add constraint profiles_role_group_id_fkey
  foreign key (role_group_id) references public.org_role_groups (id) on delete set null;

create or replace function public.protect_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
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

-- Drop older overloads so only one callable signature remains.
drop function if exists public.boss_set_member_access(uuid, text, text, boolean);
drop function if exists public.boss_set_member_access(uuid, text, text, boolean, uuid, jsonb, jsonb);

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
