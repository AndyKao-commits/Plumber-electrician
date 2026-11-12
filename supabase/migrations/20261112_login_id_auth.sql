-- Custom login ids (帳號) alongside optional real email for Supabase Auth.

alter table public.profiles
  add column if not exists login_id text;

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
  );

create unique index if not exists profiles_login_id_unique
  on public.profiles (login_id)
  where login_id is not null;

comment on column public.profiles.login_id is
  'Optional custom account name; Auth email may be login_id@login.eg.local';

-- Replace older overloads with one function (defaults keep 1–2 arg calls working).
drop function if exists public.complete_signup(text, text);
drop function if exists public.complete_signup(text, text, text);

create or replace function public.complete_signup(
  p_name text,
  p_org_name text default null,
  p_login_id text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_org uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_org_name text := nullif(trim(coalesce(p_org_name, '')), '');
  v_login text := nullif(lower(trim(coalesce(p_login_id, ''))), '');
  v_count integer;
  v_role public.user_role;
  v_finance boolean;
  v_row public.profiles;
begin
  if v_uid is null then
    raise exception '尚未登入，無法完成註冊';
  end if;
  if v_name is null then
    raise exception '請填寫姓名';
  end if;
  if v_login is not null and v_login !~ '^[a-z][a-z0-9._-]{2,31}$' then
    raise exception '帳號格式無效';
  end if;

  select email into v_email from auth.users where id = v_uid;

  select * into v_row from public.profiles where id = v_uid;
  if found then
    if v_login is not null and v_row.login_id is null then
      update public.profiles
      set login_id = v_login
      where id = v_uid
      returning * into v_row;
    end if;
    return v_row;
  end if;

  if v_org_name is not null then
    insert into public.organizations (name)
    values (v_org_name)
    returning id into v_org;
  else
    select id into v_org
    from public.organizations
    order by created_at asc
    limit 1;

    if v_org is null then
      insert into public.organizations (name)
      values ('水電工程行')
      returning id into v_org;
    end if;
  end if;

  select count(*) into v_count from public.profiles where organization_id = v_org;
  if v_count = 0 then
    v_role := 'boss';
    v_finance := true;
  else
    v_role := 'employee';
    v_finance := false;
  end if;

  insert into public.profiles (
    id, organization_id, name, role, email, login_id, finance_authorized
  ) values (
    v_uid, v_org, v_name, v_role, v_email, v_login, v_finance
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.complete_signup(text, text, text) from public;
grant execute on function public.complete_signup(text, text, text) to authenticated;

comment on function public.complete_signup(text, text, text) is
  'After auth.signUp, create profile. Optional login_id for custom account names.';

notify pgrst, 'reload schema';
