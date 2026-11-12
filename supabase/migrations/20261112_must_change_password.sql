-- First-login password change + phone login_id support.

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'True when admin created the account with default phone password; cleared after first password change.';

-- Allow phone digits (8–15) or letter-started custom ids.
do $$
begin
  alter table public.profiles
    drop constraint if exists profiles_login_id_format;
exception when undefined_object then
  null;
end $$;

alter table public.profiles
  add constraint profiles_login_id_format
  check (
    login_id is null
    or login_id ~ '^[a-z][a-z0-9._-]{2,31}$'
    or login_id ~ '^[0-9]{8,15}$'
  );

create or replace function public.mark_password_changed()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.profiles;
begin
  if v_uid is null then
    raise exception '尚未登入';
  end if;
  perform set_config('app.allow_privileged_profile_update', 'on', true);
  update public.profiles
    set must_change_password = false
  where id = v_uid
  returning * into v_row;
  if not found then
    raise exception '找不到個人資料';
  end if;
  return v_row;
end;
$$;

revoke all on function public.mark_password_changed() from public;
grant execute on function public.mark_password_changed() to authenticated;

-- Include must_change_password / login_id in privileged column guard.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
     or new.permission_overrides is distinct from old.permission_overrides
     or new.login_id is distinct from old.login_id
     or new.must_change_password is distinct from old.must_change_password then
    raise exception 'privileged profile fields cannot be changed by clients';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
