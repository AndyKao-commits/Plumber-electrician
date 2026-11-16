-- Salary V2: payment records + attendance-sourced daily wage fields.

alter table public.salary_entries
  add column if not exists source text,
  add column if not exists attendance_date date,
  add column if not exists day_fraction numeric(3,1);

do $$
begin
  alter table public.salary_entries
    drop constraint if exists salary_entries_source_check;
exception when undefined_object then
  null;
end $$;

alter table public.salary_entries
  add constraint salary_entries_source_check
  check (source is null or source in ('manual', 'attendance_daily'));

do $$
begin
  alter table public.salary_entries
    drop constraint if exists salary_entries_day_fraction_check;
exception when undefined_object then
  null;
end $$;

alter table public.salary_entries
  add constraint salary_entries_day_fraction_check
  check (
    day_fraction is null
    or day_fraction in (0.5, 1)
  );

create unique index if not exists salary_entries_daily_wage_uidx
  on public.salary_entries (
    organization_id,
    user_id,
    attendance_date
  )
  where source = 'attendance_daily'
    and category = 'base'
    and status is distinct from 'cancelled'
    and attendance_date is not null;

create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  employee_name text not null,
  settlement_year int not null check (settlement_year between 2000 and 2100),
  settlement_month int not null check (settlement_month between 1 and 12),
  amount numeric(14,0) not null check (amount > 0),
  paid_on date not null,
  note text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists salary_payments_employee_period_idx
  on public.salary_payments (
    organization_id,
    employee_id,
    settlement_year,
    settlement_month,
    paid_on desc
  );

alter table public.salary_payments enable row level security;

drop policy if exists "salary_payments_select_own_or_boss" on public.salary_payments;
create policy "salary_payments_select_own_or_boss"
  on public.salary_payments for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      employee_id = auth.uid()
      or public.current_user_is_boss_like()
    )
  );

drop policy if exists "salary_payments_boss_write" on public.salary_payments;
create policy "salary_payments_boss_write"
  on public.salary_payments for all to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_is_boss_like()
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_is_boss_like()
  );

drop trigger if exists trg_set_org_salary_payments on public.salary_payments;
create trigger trg_set_org_salary_payments
  before insert on public.salary_payments
  for each row execute function public.set_org_id_from_profile();

revoke all on table public.salary_payments from public, anon;
grant select, insert, update, delete on table public.salary_payments to authenticated;

notify pgrst, 'reload schema';
