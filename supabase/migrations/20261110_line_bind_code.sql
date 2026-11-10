-- Personal LINE ↔ profile binding via short-lived code (reply-only flow).
-- App: create_line_bind_code() → user messages OA「綁定 XXXXXX」
-- Webhook (service role): consume_line_bind_code(code, line_user_id)

create table if not exists public.line_bind_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint line_bind_codes_code_format check (code ~ '^[A-Z0-9]{6}$')
);

create unique index if not exists line_bind_codes_code_active_uidx
  on public.line_bind_codes (code)
  where consumed_at is null;

create index if not exists line_bind_codes_profile_idx
  on public.line_bind_codes (profile_id, created_at desc);

alter table public.line_bind_codes enable row level security;

drop policy if exists "line_bind_codes_select_own" on public.line_bind_codes;
create policy "line_bind_codes_select_own"
  on public.line_bind_codes for select to authenticated
  using (profile_id = auth.uid());

revoke all on table public.line_bind_codes from public, anon, authenticated;
grant select on table public.line_bind_codes to authenticated;

create or replace function public.create_line_bind_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.current_user_org_id();
  v_code text;
  v_expires timestamptz := now() + interval '10 minutes';
  v_attempt int := 0;
begin
  if v_uid is null or v_org is null then
    raise exception '尚未登入或無法決定組織';
  end if;

  -- Invalidate unused prior codes for this profile
  update public.line_bind_codes
  set consumed_at = now()
  where profile_id = v_uid
    and consumed_at is null;

  loop
    v_attempt := v_attempt + 1;
    -- 6 chars, easy to type; exclude 0/O/1/I
    v_code := upper(substr(replace(replace(encode(gen_random_bytes(8), 'hex'), '0', 'A'), '1', 'B'), 1, 6));
    begin
      insert into public.line_bind_codes (organization_id, profile_id, code, expires_at)
      values (v_org, v_uid, v_code, v_expires);
      exit;
    exception when unique_violation then
      if v_attempt >= 8 then
        raise;
      end if;
    end;
  end loop;

  return query select v_code, v_expires;
end;
$$;

revoke all on function public.create_line_bind_code() from public;
grant execute on function public.create_line_bind_code() to authenticated;

create or replace function public.consume_line_bind_code(
  p_code text,
  p_line_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_line text := trim(coalesce(p_line_user_id, ''));
  v_row public.line_bind_codes%rowtype;
  v_name text;
begin
  if v_code !~ '^[A-Z0-9]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if v_line = '' or length(v_line) < 10 then
    return jsonb_build_object('ok', false, 'error', 'invalid_line_user_id');
  end if;

  select * into v_row
  from public.line_bind_codes c
  where c.code = v_code
    and c.consumed_at is null
    and c.expires_at > now()
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'code_not_found_or_expired');
  end if;

  -- Free unique line_user_id if held by another profile
  update public.profiles
  set line_user_id = null
  where line_user_id = v_line
    and id is distinct from v_row.profile_id;

  update public.profiles
  set line_user_id = v_line
  where id = v_row.profile_id
  returning name into v_name;

  update public.line_bind_codes
  set consumed_at = now()
  where id = v_row.id;

  return jsonb_build_object(
    'ok', true,
    'profile_id', v_row.profile_id,
    'name', coalesce(v_name, ''),
    'line_user_id', v_line
  );
end;
$$;

-- Only service role (Edge Function) should consume codes
revoke all on function public.consume_line_bind_code(text, text) from public, anon, authenticated;
grant execute on function public.consume_line_bind_code(text, text) to service_role;

comment on function public.create_line_bind_code() is
  'Create a 10-minute LINE bind code for the current user';
comment on function public.consume_line_bind_code(text, text) is
  'Webhook-only: bind LINE user id to the profile that owns the code';
