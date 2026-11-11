-- V1.0 field expense / cash receipt reports + audit log.

create table if not exists public.expense_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  site_id uuid not null references public.sites (id),
  site_name text not null,
  item text not null,
  amount numeric(14,2) not null check (amount > 0),
  note text,
  receipt_photo_path text,
  status text not null check (
    status in ('pending_review', 'confirmed', 'returned', 'cancelled')
  ),
  reported_by uuid not null references public.profiles (id),
  reported_by_name text not null,
  reported_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text
);

create table if not exists public.cash_receipt_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  site_id uuid not null references public.sites (id),
  site_name text not null,
  amount numeric(14,2) not null check (amount > 0),
  source_note text,
  proof_photo_path text,
  status text not null check (
    status in ('pending_confirm', 'confirmed', 'returned', 'cancelled')
  ),
  reported_by uuid not null references public.profiles (id),
  reported_by_name text not null,
  reported_at timestamptz not null default now(),
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  confirm_note text
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  action text not null,
  actor_id uuid not null references public.profiles (id),
  actor_name text not null,
  target_type text not null,
  target_id text not null,
  before_json text,
  after_json text,
  result text not null check (result in ('ok', 'error')),
  message text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists nickname text,
  add column if not exists birth_date date,
  add column if not exists job_title text,
  add column if not exists hired_at date,
  add column if not exists account_status text not null default 'active',
  add column if not exists profile_notes text;

create index if not exists expense_reports_status_idx
  on public.expense_reports (organization_id, status, reported_at desc);
create index if not exists cash_receipt_reports_status_idx
  on public.cash_receipt_reports (organization_id, status, reported_at desc);
create index if not exists audit_logs_created_idx
  on public.audit_logs (organization_id, created_at desc);

alter table public.expense_reports enable row level security;
alter table public.cash_receipt_reports enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "expense_reports_org_all" on public.expense_reports;
create policy "expense_reports_org_all"
  on public.expense_reports for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "cash_receipt_reports_org_all" on public.cash_receipt_reports;
create policy "cash_receipt_reports_org_all"
  on public.cash_receipt_reports for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "audit_logs_org_select" on public.audit_logs;
create policy "audit_logs_org_select"
  on public.audit_logs for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "audit_logs_org_insert" on public.audit_logs;
create policy "audit_logs_org_insert"
  on public.audit_logs for insert to authenticated
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_expense_reports on public.expense_reports;
create trigger trg_set_org_expense_reports
  before insert on public.expense_reports
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_cash_receipt_reports on public.cash_receipt_reports;
create trigger trg_set_org_cash_receipt_reports
  before insert on public.cash_receipt_reports
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_audit_logs on public.audit_logs;
create trigger trg_set_org_audit_logs
  before insert on public.audit_logs
  for each row execute function public.set_org_id_from_profile();
