-- Employee advances (代墊): personal pay first, boss batch-settles into expense_reports.

create table if not exists public.employee_advances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  employee_name text not null,
  site_id uuid references public.sites (id) on delete set null,
  site_name text not null default '雜項（無工地）',
  location_text text,
  item text not null,
  amount numeric(14,2) not null check (amount > 0),
  note text,
  receipt_photo_path text,
  status text not null default 'open'
    check (status in ('open', 'settled', 'cancelled')),
  reported_at timestamptz not null default now(),
  settled_at timestamptz,
  settled_by uuid references public.profiles (id),
  expense_report_id uuid references public.expense_reports (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists employee_advances_org_status_idx
  on public.employee_advances (organization_id, status, reported_at desc);

create index if not exists employee_advances_employee_idx
  on public.employee_advances (employee_id, reported_at desc);

alter table public.employee_advances enable row level security;

drop policy if exists "employee_advances_select_own_or_boss" on public.employee_advances;
create policy "employee_advances_select_own_or_boss"
  on public.employee_advances for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      employee_id = auth.uid()
      or public.current_user_role() in ('boss', 'owner')
    )
  );

drop policy if exists "employee_advances_insert_own" on public.employee_advances;
create policy "employee_advances_insert_own"
  on public.employee_advances for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and employee_id = auth.uid()
  );

drop policy if exists "employee_advances_update_boss" on public.employee_advances;
create policy "employee_advances_update_boss"
  on public.employee_advances for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      public.current_user_role() in ('boss', 'owner')
      or (employee_id = auth.uid() and status = 'open')
    )
  )
  with check (organization_id = public.current_user_org_id());

revoke all on table public.employee_advances from public, anon;
grant select, insert, update on table public.employee_advances to authenticated;

drop trigger if exists trg_set_org_employee_advances on public.employee_advances;
create trigger trg_set_org_employee_advances
  before insert on public.employee_advances
  for each row execute function public.set_org_id_from_profile();

comment on table public.employee_advances is
  '員工代墊：登記後由老闆批量核銷成 expense_reports（confirmed）';
