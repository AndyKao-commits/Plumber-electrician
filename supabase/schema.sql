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
  -- Same UUID as auth.users while login exists; may outlive Auth after soft-delete.
  id uuid primary key,
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

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'quotation_item_kind'
  ) then
    create type public.quotation_item_kind as enum ('material', 'labor', 'other');
  end if;
end $$;

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  line_no integer not null default 1,
  kind public.quotation_item_kind not null default 'other',
  description text not null,
  qty numeric(12,3) not null default 1,
  unit text not null default '式',
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotation_items_qty_nonneg check (qty >= 0),
  constraint quotation_items_unit_price_nonneg check (unit_price >= 0),
  constraint quotation_items_amount_nonneg check (amount >= 0),
  constraint quotation_items_line_unique unique (quotation_id, line_no)
);

create index if not exists quotation_items_quote_idx
  on public.quotation_items (quotation_id, line_no);

alter table public.quotation_items enable row level security;
drop policy if exists "quotation_items_org_all" on public.quotation_items;
create policy "quotation_items_org_all"
  on public.quotation_items for all to authenticated
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
