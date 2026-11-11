-- Salary module V1: per-employee pay settings + line items with confirm/pay flow.

create table if not exists public.employee_pay_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  pay_type text not null check (pay_type in ('monthly', 'daily', 'hourly')),
  base_amount numeric(14,0) not null default 0 check (base_amount >= 0),
  effective_from date not null,
  note text,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employee_pay_settings_user_from_uidx
  on public.employee_pay_settings (organization_id, user_id, effective_from);

create index if not exists employee_pay_settings_user_idx
  on public.employee_pay_settings (user_id, effective_from desc);

create table if not exists public.salary_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null,
  period_year int not null check (period_year between 2000 and 2100),
  period_month int not null check (period_month between 1 and 12),
  entry_date date not null,
  category text not null check (
    category in (
      'base',
      'overtime',
      'sales_bonus',
      'case_bonus',
      'other_bonus',
      'deduction',
      'adjustment'
    )
  ),
  amount numeric(14,0) not null check (amount <> 0),
  title text not null,
  note text,
  site_id uuid references public.sites (id) on delete set null,
  site_name text,
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'confirmed', 'paid', 'cancelled')),
  created_by uuid not null references public.profiles (id),
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  paid_by uuid references public.profiles (id),
  paid_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists salary_entries_user_period_idx
  on public.salary_entries (organization_id, user_id, period_year, period_month, status);

create index if not exists salary_entries_period_idx
  on public.salary_entries (organization_id, period_year, period_month, status);

-- Immutable correction log when changing confirmed/paid amounts.
create table if not exists public.salary_entry_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  salary_entry_id uuid not null references public.salary_entries (id) on delete cascade,
  before_json text not null,
  after_json text not null,
  reason text not null,
  corrected_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists salary_entry_corrections_entry_idx
  on public.salary_entry_corrections (salary_entry_id, created_at desc);

alter table public.employee_pay_settings enable row level security;
alter table public.salary_entries enable row level security;
alter table public.salary_entry_corrections enable row level security;

drop policy if exists "pay_settings_select_own_or_boss" on public.employee_pay_settings;
create policy "pay_settings_select_own_or_boss"
  on public.employee_pay_settings for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      user_id = auth.uid()
      or public.current_user_role() = 'boss'
    )
  );

drop policy if exists "pay_settings_boss_write" on public.employee_pay_settings;
create policy "pay_settings_boss_write"
  on public.employee_pay_settings for all to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() = 'boss'
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_role() = 'boss'
  );

drop policy if exists "salary_entries_select_own_or_boss" on public.salary_entries;
create policy "salary_entries_select_own_or_boss"
  on public.salary_entries for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      user_id = auth.uid()
      or public.current_user_role() = 'boss'
    )
  );

drop policy if exists "salary_entries_boss_write" on public.salary_entries;
create policy "salary_entries_boss_write"
  on public.salary_entries for all to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() = 'boss'
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_role() = 'boss'
  );

drop policy if exists "salary_corrections_select_own_or_boss" on public.salary_entry_corrections;
create policy "salary_corrections_select_own_or_boss"
  on public.salary_entry_corrections for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      public.current_user_role() = 'boss'
      or exists (
        select 1 from public.salary_entries e
        where e.id = salary_entry_id and e.user_id = auth.uid()
      )
    )
  );

drop policy if exists "salary_corrections_boss_insert" on public.salary_entry_corrections;
create policy "salary_corrections_boss_insert"
  on public.salary_entry_corrections for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_role() = 'boss'
  );

revoke all on table public.employee_pay_settings from public, anon;
revoke all on table public.salary_entries from public, anon;
revoke all on table public.salary_entry_corrections from public, anon;
grant select, insert, update, delete on table public.employee_pay_settings to authenticated;
grant select, insert, update on table public.salary_entries to authenticated;
grant select, insert on table public.salary_entry_corrections to authenticated;

drop trigger if exists trg_set_org_employee_pay_settings on public.employee_pay_settings;
create trigger trg_set_org_employee_pay_settings
  before insert on public.employee_pay_settings
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_salary_entries on public.salary_entries;
create trigger trg_set_org_salary_entries
  before insert on public.salary_entries
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_salary_entry_corrections on public.salary_entry_corrections;
create trigger trg_set_org_salary_entry_corrections
  before insert on public.salary_entry_corrections
  for each row execute function public.set_org_id_from_profile();

comment on table public.employee_pay_settings is
  '員工薪資設定：月薪／日薪／時薪基準；變更僅影響生效日之後';
comment on table public.salary_entries is
  '薪資明細項目：老闆登錄／確認／支付；員工僅可讀自己的資料';
comment on table public.salary_entry_corrections is
  '已確認薪資更正紀錄：保留操作者、時間與原因，不可默默覆寫';
