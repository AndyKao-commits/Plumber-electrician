-- REP-001: expand repair_cases; assignments + visits (visit ≠ attendance).

alter table public.repair_cases
  add column if not exists case_number text,
  add column if not exists problem_description text,
  add column if not exists status text,
  add column if not exists customer_id uuid references public.customers (id) on delete set null,
  add column if not exists updated_at timestamptz;

update public.repair_cases
set
  problem_description = coalesce(nullif(problem_description, ''), title, '（未填問題）'),
  status = coalesce(status, 'pending_schedule'),
  case_number = coalesce(
    case_number,
    'RC-' || to_char(created_at, 'YYYYMMDD') || '-' || substr(id::text, 1, 4)
  ),
  updated_at = coalesce(updated_at, created_at)
where true;

alter table public.repair_cases
  alter column problem_description set not null,
  alter column status set default 'pending_schedule',
  alter column customer_name drop not null;

do $$ begin
  alter table public.repair_cases
    add constraint repair_cases_status_check
    check (status in (
      'pending_schedule', 'scheduled', 'in_progress', 'pending_confirm',
      'closed', 'paused', 'cancelled'
    ));
exception when duplicate_object then null;
end $$;

create unique index if not exists repair_cases_org_number_uidx
  on public.repair_cases (organization_id, case_number);

create table if not exists public.repair_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  repair_case_id uuid not null references public.repair_cases (id) on delete cascade,
  assignee_user_id uuid not null references public.profiles (id),
  assignee_name text not null,
  note text,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id)
);

create index if not exists repair_assignments_case_idx
  on public.repair_assignments (repair_case_id, assigned_at desc);

create table if not exists public.repair_visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  repair_case_id uuid not null references public.repair_cases (id) on delete cascade,
  visitor_user_id uuid not null references public.profiles (id),
  visitor_name text not null,
  note text,
  visited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  attendance_created boolean not null default false
    check (attendance_created = false)
);

create index if not exists repair_visits_case_idx
  on public.repair_visits (repair_case_id, visited_at desc);

alter table public.repair_assignments enable row level security;
alter table public.repair_visits enable row level security;

drop policy if exists "repair_assignments_org_all" on public.repair_assignments;
create policy "repair_assignments_org_all"
  on public.repair_assignments for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "repair_visits_org_all" on public.repair_visits;
create policy "repair_visits_org_all"
  on public.repair_visits for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_repair_assignments on public.repair_assignments;
create trigger trg_set_org_repair_assignments
  before insert on public.repair_assignments
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_repair_visits on public.repair_visits;
create trigger trg_set_org_repair_visits
  before insert on public.repair_visits
  for each row execute function public.set_org_id_from_profile();
