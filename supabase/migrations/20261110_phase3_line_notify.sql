-- Phase 3/4: org notices RPC, LINE bind grant, notification outbox
-- Idempotent. Apply after 20261110_formal_persistence_security.sql.

-- Allow self-update of LINE binding (not a privileged column)
grant update (name, email, phone, line_user_id) on table public.profiles to authenticated;

-- Outbox for LINE push jobs (processed by Edge Function; insert never blocks UX)
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  event_type text not null,
  recipient_profile_id uuid references public.profiles (id) on delete set null,
  line_user_id text,
  title text not null,
  body text not null default '',
  href text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists notification_outbox_pending_idx
  on public.notification_outbox (status, created_at)
  where status = 'pending';

drop trigger if exists trg_set_org_notification_outbox on public.notification_outbox;
create trigger trg_set_org_notification_outbox
  before insert on public.notification_outbox
  for each row execute function public.set_org_id_from_profile();

alter table public.notification_outbox enable row level security;

drop policy if exists "notification_outbox_org_read" on public.notification_outbox;
create policy "notification_outbox_org_read" on public.notification_outbox
  for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "notification_outbox_org_insert" on public.notification_outbox;
create policy "notification_outbox_org_insert" on public.notification_outbox
  for insert to authenticated
  with check (organization_id = public.current_user_org_id());

-- Service role / edge function updates status; authenticated cannot mutate rows after insert
revoke update, delete on table public.notification_outbox from authenticated, anon;

-- Create in-app notices for same-org recipients (bypasses notices_own insert limit)
create or replace function public.create_org_notices(
  p_recipient_ids uuid[],
  p_kind text,
  p_title text,
  p_detail text default '',
  p_href text default null,
  p_as_todo boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_uid uuid;
  v_count integer := 0;
  v_kind text := case when p_as_todo then 'todo' else coalesce(nullif(p_kind, ''), 'notice') end;
begin
  if v_org is null then
    raise exception '無法決定組織';
  end if;
  if p_recipient_ids is null or array_length(p_recipient_ids, 1) is null then
    return 0;
  end if;
  if v_kind not in ('notice', 'todo') then
    v_kind := 'notice';
  end if;

  foreach v_uid in array p_recipient_ids loop
    if exists (
      select 1 from public.profiles p
      where p.id = v_uid and p.organization_id = v_org
    ) then
      insert into public.notices (
        organization_id, user_id, kind, title, detail, status, unread, href
      ) values (
        v_org, v_uid, v_kind, p_title, coalesce(p_detail, ''), 'open', true, p_href
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.create_org_notices(uuid[], text, text, text, text, boolean) from public;
grant execute on function public.create_org_notices(uuid[], text, text, text, text, boolean) to authenticated;

-- Notify all profiles whose role is in the given list (boss/owner/admin/employee)
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
    and p.role::text = any (p_roles)
    and (not p_exclude_self or p.id is distinct from auth.uid());

  return public.create_org_notices(v_ids, p_kind, p_title, p_detail, p_href, p_as_todo);
end;
$$;

revoke all on function public.create_notices_for_roles(text[], text, text, text, text, boolean, boolean) from public;
grant execute on function public.create_notices_for_roles(text[], text, text, text, text, boolean, boolean) to authenticated;

-- Enqueue LINE outbox rows for recipients that have line_user_id
create or replace function public.enqueue_line_notifications(
  p_recipient_ids uuid[],
  p_event_type text,
  p_title text,
  p_body text default '',
  p_href text default null,
  p_payload jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_uid uuid;
  v_line text;
  v_count integer := 0;
begin
  if v_org is null then
    raise exception '無法決定組織';
  end if;
  if p_recipient_ids is null then
    return 0;
  end if;

  foreach v_uid in array p_recipient_ids loop
    select p.line_user_id into v_line
    from public.profiles p
    where p.id = v_uid and p.organization_id = v_org;

    if v_line is not null and length(trim(v_line)) > 0 then
      insert into public.notification_outbox (
        organization_id, event_type, recipient_profile_id, line_user_id,
        title, body, href, payload, status
      ) values (
        v_org, p_event_type, v_uid, trim(v_line),
        p_title, coalesce(p_body, ''), p_href, coalesce(p_payload, '{}'::jsonb), 'pending'
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enqueue_line_notifications(uuid[], text, text, text, text, jsonb) from public;
grant execute on function public.enqueue_line_notifications(uuid[], text, text, text, text, jsonb) to authenticated;

create or replace function public.list_approver_ids(p_exclude_self boolean default true)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(p.id), array[]::uuid[])
  from public.profiles p
  where p.organization_id = public.current_user_org_id()
    and p.role::text in ('boss', 'owner', 'admin')
    and (not p_exclude_self or p.id is distinct from auth.uid());
$$;

revoke all on function public.list_approver_ids(boolean) from public;
grant execute on function public.list_approver_ids(boolean) to authenticated;
