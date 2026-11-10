-- Open self-serve signup: auth user completes profile via security definer RPC.
-- First member of an org becomes boss (Owner); later joiners become employee (Member).

create or replace function public.complete_signup(
  p_name text,
  p_org_name text default null
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

  select email into v_email from auth.users where id = v_uid;

  -- Idempotent: already has profile
  select * into v_row from public.profiles where id = v_uid;
  if found then
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
    id, organization_id, name, role, email, finance_authorized
  ) values (
    v_uid, v_org, v_name, v_role, v_email, v_finance
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.complete_signup(text, text) from public;
grant execute on function public.complete_signup(text, text) to authenticated;

comment on function public.complete_signup(text, text) is
  'After auth.signUp/signIn, create profile. Empty org name joins oldest org (or creates default). Named org creates new company as first Owner.';
