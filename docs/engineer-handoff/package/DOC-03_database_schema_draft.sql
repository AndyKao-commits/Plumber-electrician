-- 工程管家 core schema (Supabase)
-- Reflects confirmed decisions: org isolation, equal project access,
-- overnight shifts, purchase limits, moving-average inventory later.

create type public.user_role as enum ('boss', 'employee');
create type public.pay_type as enum ('monthly', 'daily', 'hourly');
create type public.project_kind as enum ('formal', 'repair');
create type public.project_status as enum ('active', 'pending_close', 'closed', 'warranty');
create type public.attendance_status as enum ('clocked_in', 'clocked_out');
create type public.job_type as enum ('project', 'repair', 'purchase', 'office', 'other');
create type public.purchase_mode as enum ('normal', 'emergency');
create type public.purchase_status as enum (
  'draft', 'pending_approval', 'approved', 'purchased', 'rejected', 'cancelled'
);

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
create policy "profiles_read_same_org"
  on public.profiles for select to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

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

create policy "attendance_read_presence_or_own"
  on public.attendance for select to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

create policy "attendance_write_own"
  on public.attendance for insert to authenticated
  with check (user_id = auth.uid());

create policy "attendance_update_own"
  on public.attendance for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "purchases_org_read"
  on public.purchases for select to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );

create policy "purchases_insert_own"
  on public.purchases for insert to authenticated
  with check (user_id = auth.uid());

create policy "notices_own"
  on public.notices for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
