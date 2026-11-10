-- 工程管家：一次套用 schema + seed
-- 在 Supabase SQL Editor 貼上本檔全文執行即可。

-- 工程管家 core schema (Supabase)
-- Reflects confirmed decisions: org isolation, equal project access,
-- overnight shifts, purchase limits, moving-average inventory later.

do $$ begin
  create type public.user_role as enum ('boss', 'employee');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.pay_type as enum ('monthly', 'daily', 'hourly');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.project_kind as enum ('formal', 'repair');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.project_status as enum ('active', 'pending_close', 'closed', 'warranty');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.attendance_status as enum ('clocked_in', 'clocked_out');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.job_type as enum ('project', 'repair', 'purchase', 'office', 'other');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.purchase_mode as enum ('normal', 'emergency');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.purchase_status as enum (
    'draft', 'pending_approval', 'approved', 'purchased', 'rejected', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Taipei',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id),
  name text not null,
  role public.user_role not null default 'employee',
  email text,
  phone text,
  pay_type public.pay_type,
  line_user_id text unique,
  finance_authorized boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  kind public.project_kind not null default 'formal',
  status public.project_status not null default 'active',
  address text,
  customer_name text,
  notes text,
  warranty_until date,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id)
);

-- Shift-centric attendance (overnight allowed; no midnight auto-close)
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.attendance_status not null default 'clocked_in',
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  site_id uuid references public.sites (id) on delete set null,
  job_type public.job_type,
  latitude double precision,
  longitude double precision,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references public.profiles (id),
  site_id uuid references public.sites (id) on delete set null,
  mode public.purchase_mode not null default 'normal',
  status public.purchase_status not null default 'draft',
  title text not null,
  goods_amount numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  other_buyer_fees numeric(12,2) not null default 0,
  final_payable numeric(12,2) not null default 0,
  business_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('notice', 'todo')),
  title text not null,
  detail text not null default '',
  status text not null default 'open',
  unread boolean not null default true,
  href text,
  created_at timestamptz not null default now()
);

create index if not exists attendance_user_status_idx
  on public.attendance (user_id, status);
create index if not exists sites_org_updated_idx
  on public.sites (organization_id, updated_at desc);
create index if not exists purchases_user_business_date_idx
  on public.purchases (user_id, business_date, mode);

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.attendance enable row level security;
alter table public.purchases enable row level security;
alter table public.notices enable row level security;

-- Equal project access within organization; sensitive payroll still restricted.
drop policy if exists "profiles_read_same_org" on public.profiles;
create policy "profiles_read_same_org"
  on public.profiles for select to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "sites_org_all" on public.sites;
create policy "sites_org_all"
  on public.sites for all to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

drop policy if exists "attendance_read_presence_or_own" on public.attendance;
create policy "attendance_read_presence_or_own"
  on public.attendance for select to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

drop policy if exists "attendance_write_own" on public.attendance;
create policy "attendance_write_own"
  on public.attendance for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "attendance_update_own" on public.attendance;
create policy "attendance_update_own"
  on public.attendance for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "purchases_org_read" on public.purchases;
create policy "purchases_org_read"
  on public.purchases for select to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

drop policy if exists "purchases_insert_own" on public.purchases;
create policy "purchases_insert_own"
  on public.purchases for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "notices_own" on public.notices;
create policy "notices_own"
  on public.notices for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DOC-09 P0.12 additions (same-batch RLS required for every new tenant table)

do $$ begin
  create type public.tax_mode as enum ('inclusive', 'exclusive', 'zero');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.quote_status as enum ('draft', 'published', 'void');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.emergency_limit_event_type as enum ('RESERVE', 'RELEASE', 'ADJUST');
exception when duplicate_object then null;
end $$;

create table if not exists public.repair_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  site_id uuid references public.sites (id) on delete set null,
  customer_name text not null,
  title text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.repair_cases enable row level security;
drop policy if exists "repair_cases_org_all" on public.repair_cases;
create policy "repair_cases_org_all"
  on public.repair_cases for all to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  project_id uuid references public.sites (id) on delete restrict,
  repair_case_id uuid references public.repair_cases (id) on delete restrict,
  title text not null,
  status public.quote_status not null default 'draft',
  tax_mode public.tax_mode not null,
  tax_rate numeric(8,4) not null default 0.05,
  amount_before_tax numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  amount_after_tax numeric(12,2) not null default 0,
  frozen boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  created_by uuid references public.profiles (id),
  constraint quotations_project_xor_repair check (
    (project_id is not null and repair_case_id is null)
    or (project_id is null and repair_case_id is not null)
  )
);

alter table public.quotations enable row level security;
drop policy if exists "quotations_org_all" on public.quotations;
create policy "quotations_org_all"
  on public.quotations for all to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

-- REV-04 immutable emergency limit events
create table if not exists public.emergency_limit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.profiles (id),
  business_date date not null,
  event_type public.emergency_limit_event_type not null,
  amount_delta numeric(12,2) not null,
  purchase_id uuid references public.purchases (id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id)
);

create index if not exists emergency_limit_events_day_idx
  on public.emergency_limit_events (organization_id, employee_id, business_date);

alter table public.emergency_limit_events enable row level security;
drop policy if exists "emergency_limit_events_org_read" on public.emergency_limit_events;
create policy "emergency_limit_events_org_read"
  on public.emergency_limit_events for select to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );
drop policy if exists "emergency_limit_events_insert_own_or_boss" on public.emergency_limit_events;
create policy "emergency_limit_events_insert_own_or_boss"
  on public.emergency_limit_events for insert to authenticated
  with check (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
    and created_by = auth.uid()
  );

-- REV-05 petty cash skeleton (approve ≠ disbursement)
create table if not exists public.petty_cash_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.petty_cash_top_up_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  account_id uuid not null references public.petty_cash_accounts (id),
  amount numeric(12,2) not null,
  status text not null default 'pending',
  requested_by uuid not null references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.petty_cash_disbursements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  account_id uuid not null references public.petty_cash_accounts (id),
  top_up_request_id uuid references public.petty_cash_top_up_requests (id),
  amount numeric(12,2) not null,
  disbursed_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.petty_cash_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  account_id uuid not null references public.petty_cash_accounts (id),
  entry_type text not null,
  amount numeric(12,2) not null,
  balance_after numeric(12,2) not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.petty_cash_accounts enable row level security;
alter table public.petty_cash_top_up_requests enable row level security;
alter table public.petty_cash_disbursements enable row level security;
alter table public.petty_cash_ledger_entries enable row level security;

drop policy if exists "petty_cash_accounts_org" on public.petty_cash_accounts;
create policy "petty_cash_accounts_org"
  on public.petty_cash_accounts for all to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

drop policy if exists "petty_cash_top_ups_org" on public.petty_cash_top_up_requests;
create policy "petty_cash_top_ups_org"
  on public.petty_cash_top_up_requests for all to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

drop policy if exists "petty_cash_disbursements_org" on public.petty_cash_disbursements;
create policy "petty_cash_disbursements_org"
  on public.petty_cash_disbursements for all to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

drop policy if exists "petty_cash_ledger_org" on public.petty_cash_ledger_entries;
create policy "petty_cash_ledger_org"
  on public.petty_cash_ledger_entries for all to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  unit text not null,
  qty numeric(14,4) not null default 0,
  unit_cost numeric(14,4) not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.materials enable row level security;
drop policy if exists "materials_org_all" on public.materials;
create policy "materials_org_all"
  on public.materials for all to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

-- ========== seed ==========

-- Optional demo seed AFTER schema.sql (or use apply.sql once).
-- If you see "organizations does not exist", run schema.sql / apply.sql first.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception '請先執行 supabase/schema.sql（或一次跑完 supabase/apply.sql）。organizations 資料表尚不存在。';
  end if;
end $$;

insert into public.organizations (id, name)
values ('11111111-1111-1111-1111-111111111111', '示範水電行')
on conflict (id) do nothing;

-- 2) After creating Auth users (boss@example.com / ming@example.com),
-- insert matching profiles with the same auth.users.id values:
--
-- insert into public.profiles (
--   id, organization_id, name, role, email, pay_type, finance_authorized
-- ) values
--   ('<boss-auth-uuid>', '11111111-1111-1111-1111-111111111111', '老闆', 'boss', 'boss@example.com', 'monthly', true),
--   ('<ming-auth-uuid>', '11111111-1111-1111-1111-111111111111', '師傅阿明', 'employee', 'ming@example.com', 'daily', false);

insert into public.sites (
  id, organization_id, name, kind, status, address, customer_name
) values
  (
    '22222222-2222-2222-2222-222222222221',
    '11111111-1111-1111-1111-111111111111',
    '忠孝東路住家整修',
    'formal',
    'active',
    '台北市大安區忠孝東路四段',
    '林先生'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    '臨時漏水維修',
    'repair',
    'active',
    '新北市板橋區文化路',
    '陳小姐'
  )
on conflict (id) do nothing;

insert into public.repair_cases (
  id, organization_id, site_id, customer_name, title
) values (
  '33333333-3333-3333-3333-333333333331',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '陳小姐',
  '廚房水管漏水'
)
on conflict (id) do nothing;

insert into public.materials (
  id, organization_id, name, unit, qty, unit_cost
) values
  (
    '44444444-4444-4444-4444-444444444441',
    '11111111-1111-1111-1111-111111111111',
    'PVC 管 4 分',
    '支',
    20,
    45
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    '11111111-1111-1111-1111-111111111111',
    '電線 2.0mm',
    '米',
    100,
    12.5
  )
on conflict (id) do nothing;
