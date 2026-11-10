-- FIELD-006 daily construction logs + warranty reminder support

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  log_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  body text not null default '',
  summary jsonb not null default '{}'::jsonb,
  current_version integer not null default 0,
  published_at timestamptz,
  published_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (site_id, log_date)
);

create index if not exists daily_logs_org_date_idx
  on public.daily_logs (organization_id, log_date desc);

create table if not exists public.daily_log_versions (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references public.daily_logs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version integer not null,
  body text not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  unique (daily_log_id, version)
);

alter table public.daily_logs enable row level security;
alter table public.daily_log_versions enable row level security;

drop policy if exists "daily_logs_select_org" on public.daily_logs;
create policy "daily_logs_select_org"
  on public.daily_logs for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "daily_logs_insert_org" on public.daily_logs;
create policy "daily_logs_insert_org"
  on public.daily_logs for insert to authenticated
  with check (organization_id = public.current_user_org_id());

drop policy if exists "daily_logs_update_org" on public.daily_logs;
create policy "daily_logs_update_org"
  on public.daily_logs for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "daily_log_versions_select_org" on public.daily_log_versions;
create policy "daily_log_versions_select_org"
  on public.daily_log_versions for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "daily_log_versions_insert_org" on public.daily_log_versions;
create policy "daily_log_versions_insert_org"
  on public.daily_log_versions for insert to authenticated
  with check (organization_id = public.current_user_org_id());

-- Versions are immutable: no update/delete for authenticated
revoke all on table public.daily_logs from public, anon;
revoke all on table public.daily_log_versions from public, anon;
grant select, insert, update on table public.daily_logs to authenticated;
grant select, insert on table public.daily_log_versions to authenticated;

comment on table public.daily_logs is
  'FIELD-006: one construction log per site per calendar day; draft then publish';
comment on table public.daily_log_versions is
  'Immutable published snapshots of daily_logs';
