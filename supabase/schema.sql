-- 工程管家 core schema (Supabase)
-- Apply in Supabase SQL editor when ready to leave demo/local mode.

create type public.user_role as enum ('boss', 'employee');
create type public.pay_type as enum ('monthly', 'daily', 'hourly');
create type public.project_kind as enum ('formal', 'repair');
create type public.project_status as enum ('active', 'pending_close', 'closed', 'warranty');
create type public.attendance_status as enum ('clocked_in', 'clocked_out');
create type public.job_type as enum ('project', 'repair', 'purchase', 'office', 'other');

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role public.user_role not null default 'employee',
  email text,
  phone text,
  pay_type public.pay_type,
  line_user_id text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.project_kind not null default 'formal',
  status public.project_status not null default 'active',
  address text,
  customer_name text,
  notes text,
  warranty_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
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

create index if not exists attendance_user_status_idx
  on public.attendance (user_id, status);

create index if not exists sites_updated_at_idx
  on public.sites (updated_at desc);

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.attendance enable row level security;

-- Authenticated users can read company sites (MVP: whole company visibility).
create policy "profiles_read_own_or_boss"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'boss'
    )
  );

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "sites_read_authenticated"
  on public.sites for select to authenticated
  using (true);

create policy "sites_insert_authenticated"
  on public.sites for insert to authenticated
  with check (true);

create policy "sites_update_authenticated"
  on public.sites for update to authenticated
  using (true)
  with check (true);

create policy "attendance_read_own_or_boss"
  on public.attendance for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'boss'
    )
  );

create policy "attendance_insert_own"
  on public.attendance for insert to authenticated
  with check (user_id = auth.uid());

create policy "attendance_update_own"
  on public.attendance for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
