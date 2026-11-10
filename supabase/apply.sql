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


-- ========== formal security patch ==========

-- Formal persistence + security hardening (idempotent where possible)
-- Apply on existing Supabase project after review. Does not delete data.

create or replace function public.current_user_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid()
$$;
revoke all on function public.current_user_org_id() from public;
grant execute on function public.current_user_org_id() to authenticated;

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role::text from public.profiles where id = auth.uid()
$$;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

create or replace function public.set_org_id_from_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.organization_id := public.current_user_org_id();
  if new.organization_id is null then
    raise exception '無法決定組織，請確認 profiles 已建立';
  end if;
  return new;
end;
$$;

create or replace function public.protect_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.role is distinct from old.role
     or new.finance_authorized is distinct from old.finance_authorized then
    raise exception 'privileged profile fields cannot be changed by clients';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileged_columns on public.profiles;
create trigger trg_protect_profile_privileged_columns
  before update on public.profiles for each row
  execute function public.protect_profile_privileged_columns();

alter table public.purchases add column if not exists approved_by uuid references public.profiles(id);
alter table public.purchases add column if not exists approved_at timestamptz;
alter table public.purchases add column if not exists rejected_reason text;

alter table public.organizations enable row level security;
drop policy if exists "organizations_member_read" on public.organizations;
create policy "organizations_member_read" on public.organizations for select to authenticated
  using (id = public.current_user_org_id());

revoke update on table public.profiles from authenticated, anon;
grant update (name, email, phone) on table public.profiles to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'sites','attendance','purchases','notices','repair_cases','quotations',
    'emergency_limit_events','materials'
  ]
  loop
    execute format('drop trigger if exists trg_set_org_%s on public.%I', t, t);
    execute format(
      'create trigger trg_set_org_%s before insert on public.%I for each row execute function public.set_org_id_from_profile()',
      t, t
    );
  end loop;
end $$;

drop policy if exists "profiles_read_same_org" on public.profiles;
create policy "profiles_read_same_org" on public.profiles for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid() and organization_id = public.current_user_org_id())
  with check (id = auth.uid() and organization_id = public.current_user_org_id());

drop policy if exists "sites_org_all" on public.sites;
create policy "sites_org_all" on public.sites for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "attendance_read_presence_or_own" on public.attendance;
create policy "attendance_read_presence_or_own" on public.attendance for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "attendance_write_own" on public.attendance;
create policy "attendance_write_own" on public.attendance for insert to authenticated
  with check (user_id = auth.uid() and organization_id = public.current_user_org_id());

drop policy if exists "attendance_update_own" on public.attendance;
create policy "attendance_update_own" on public.attendance for update to authenticated
  using (user_id = auth.uid() and organization_id = public.current_user_org_id())
  with check (user_id = auth.uid() and organization_id = public.current_user_org_id());

drop policy if exists "purchases_org_read" on public.purchases;
create policy "purchases_org_read" on public.purchases for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "purchases_insert_own" on public.purchases;
create policy "purchases_insert_own" on public.purchases for insert to authenticated
  with check (user_id = auth.uid() and organization_id = public.current_user_org_id());

drop policy if exists "purchases_update_approver" on public.purchases;
create policy "purchases_update_approver" on public.purchases for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('boss', 'owner', 'admin')
    )
  )
  with check (organization_id = public.current_user_org_id());

drop policy if exists "notices_own" on public.notices;
create policy "notices_own" on public.notices for all to authenticated
  using (user_id = auth.uid() and organization_id = public.current_user_org_id())
  with check (user_id = auth.uid() and organization_id = public.current_user_org_id());

drop policy if exists "repair_cases_org_all" on public.repair_cases;
create policy "repair_cases_org_all" on public.repair_cases for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "quotations_org_all" on public.quotations;
create policy "quotations_org_all" on public.quotations for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

create or replace function public.protect_frozen_quotation()
returns trigger language plpgsql as $$
begin
  if old.frozen is true then
    if new.tax_mode is distinct from old.tax_mode
       or new.tax_rate is distinct from old.tax_rate
       or new.tax_amount is distinct from old.tax_amount
       or new.amount_before_tax is distinct from old.amount_before_tax
       or new.amount_after_tax is distinct from old.amount_after_tax then
      raise exception 'published quotation tax snapshot is immutable';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_protect_frozen_quotation on public.quotations;
create trigger trg_protect_frozen_quotation
  before update on public.quotations for each row
  execute function public.protect_frozen_quotation();

drop policy if exists "emergency_limit_events_org_read" on public.emergency_limit_events;
create policy "emergency_limit_events_org_read" on public.emergency_limit_events for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "emergency_limit_events_insert_own_or_boss" on public.emergency_limit_events;
create policy "emergency_limit_events_insert_own_or_boss" on public.emergency_limit_events for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and created_by = auth.uid()
    and (
      employee_id = auth.uid()
      or public.current_user_role() in ('boss', 'owner', 'admin')
    )
  );

drop policy if exists "materials_org_all" on public.materials;
create policy "materials_org_all" on public.materials for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

alter table public.materials drop constraint if exists materials_qty_nonnegative;
alter table public.materials add constraint materials_qty_nonnegative check (qty >= 0);

-- ===== Phase 3/4 LINE notify (from migrations/20261110_phase3_line_notify.sql) =====
-- Phase 3/4: org notices RPC, LINE bind grant, notification outbox
-- Idempotent. Apply after 20261110_formal_persistence_security.sql.

-- Allow self-update of LINE binding (not a privileged column)
grant update (name, email, phone, line_user_id) on table public.profiles to authenticated;

-- Outbox for LINE push jobs (processed by Edge Function; insert never blocks UX)
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  event_type text not null,
  recipient_profile_id uuid references public.profiles (id) on delete set null,
  line_user_id text,
  title text not null,
  body text not null default '',
  href text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists notification_outbox_pending_idx
  on public.notification_outbox (status, created_at)
  where status = 'pending';

drop trigger if exists trg_set_org_notification_outbox on public.notification_outbox;
create trigger trg_set_org_notification_outbox
  before insert on public.notification_outbox
  for each row execute function public.set_org_id_from_profile();

alter table public.notification_outbox enable row level security;

drop policy if exists "notification_outbox_org_read" on public.notification_outbox;
create policy "notification_outbox_org_read" on public.notification_outbox
  for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "notification_outbox_org_insert" on public.notification_outbox;
create policy "notification_outbox_org_insert" on public.notification_outbox
  for insert to authenticated
  with check (organization_id = public.current_user_org_id());

-- Service role / edge function updates status; authenticated cannot mutate rows after insert
revoke update, delete on table public.notification_outbox from authenticated, anon;

-- Create in-app notices for same-org recipients (bypasses notices_own insert limit)
create or replace function public.create_org_notices(
  p_recipient_ids uuid[],
  p_kind text,
  p_title text,
  p_detail text default '',
  p_href text default null,
  p_as_todo boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_uid uuid;
  v_count integer := 0;
  v_kind text := case when p_as_todo then 'todo' else coalesce(nullif(p_kind, ''), 'notice') end;
begin
  if v_org is null then
    raise exception '無法決定組織';
  end if;
  if p_recipient_ids is null or array_length(p_recipient_ids, 1) is null then
    return 0;
  end if;
  if v_kind not in ('notice', 'todo') then
    v_kind := 'notice';
  end if;

  foreach v_uid in array p_recipient_ids loop
    if exists (
      select 1 from public.profiles p
      where p.id = v_uid and p.organization_id = v_org
    ) then
      insert into public.notices (
        organization_id, user_id, kind, title, detail, status, unread, href
      ) values (
        v_org, v_uid, v_kind, p_title, coalesce(p_detail, ''), 'open', true, p_href
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.create_org_notices(uuid[], text, text, text, text, boolean) from public;
grant execute on function public.create_org_notices(uuid[], text, text, text, text, boolean) to authenticated;

-- Notify all profiles whose role is in the given list (boss/owner/admin/employee)
create or replace function public.create_notices_for_roles(
  p_roles text[],
  p_kind text,
  p_title text,
  p_detail text default '',
  p_href text default null,
  p_as_todo boolean default true,
  p_exclude_self boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_ids uuid[];
begin
  if v_org is null then
    raise exception '無法決定組織';
  end if;

  select coalesce(array_agg(p.id), array[]::uuid[])
    into v_ids
  from public.profiles p
  where p.organization_id = v_org
    and p.role::text = any (p_roles)
    and (not p_exclude_self or p.id is distinct from auth.uid());

  return public.create_org_notices(v_ids, p_kind, p_title, p_detail, p_href, p_as_todo);
end;
$$;

revoke all on function public.create_notices_for_roles(text[], text, text, text, text, boolean, boolean) from public;
grant execute on function public.create_notices_for_roles(text[], text, text, text, text, boolean, boolean) to authenticated;

-- Enqueue LINE outbox rows for recipients that have line_user_id
create or replace function public.enqueue_line_notifications(
  p_recipient_ids uuid[],
  p_event_type text,
  p_title text,
  p_body text default '',
  p_href text default null,
  p_payload jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_uid uuid;
  v_line text;
  v_count integer := 0;
begin
  if v_org is null then
    raise exception '無法決定組織';
  end if;
  if p_recipient_ids is null then
    return 0;
  end if;

  foreach v_uid in array p_recipient_ids loop
    select p.line_user_id into v_line
    from public.profiles p
    where p.id = v_uid and p.organization_id = v_org;

    if v_line is not null and length(trim(v_line)) > 0 then
      insert into public.notification_outbox (
        organization_id, event_type, recipient_profile_id, line_user_id,
        title, body, href, payload, status
      ) values (
        v_org, p_event_type, v_uid, trim(v_line),
        p_title, coalesce(p_body, ''), p_href, coalesce(p_payload, '{}'::jsonb), 'pending'
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enqueue_line_notifications(uuid[], text, text, text, text, jsonb) from public;
grant execute on function public.enqueue_line_notifications(uuid[], text, text, text, text, jsonb) to authenticated;

create or replace function public.list_approver_ids(p_exclude_self boolean default true)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(p.id), array[]::uuid[])
  from public.profiles p
  where p.organization_id = public.current_user_org_id()
    and p.role::text in ('boss', 'owner', 'admin')
    and (not p_exclude_self or p.id is distinct from auth.uid());
$$;

revoke all on function public.list_approver_ids(boolean) from public;
grant execute on function public.list_approver_ids(boolean) to authenticated;

-- ===== LINE outbox retry (from migrations/20261110_line_outbox_retry.sql) =====
-- LINE outbox retry metadata (idempotent)
-- Keeps failed rows retryable until max attempts; never stores secrets.

alter table public.notification_outbox
  add column if not exists attempts integer not null default 0;

alter table public.notification_outbox
  add column if not exists next_retry_at timestamptz;

alter table public.notification_outbox
  add column if not exists last_attempt_at timestamptz;

create index if not exists notification_outbox_retry_idx
  on public.notification_outbox (status, next_retry_at, created_at)
  where status in ('pending', 'failed');

-- Allow service role to flip failed → pending on retry; clients still cannot update.
comment on column public.notification_outbox.attempts is
  'LINE push attempt count; Edge Function increments; max handled in function';
comment on column public.notification_outbox.next_retry_at is
  'When failed rows become eligible again; null means immediately eligible if status=pending';
comment on column public.notification_outbox.error is
  'Last failure reason (sanitized; never includes channel token)';

-- ===== Open signup (from migrations/20261110_open_signup.sql) =====
-- Open self-serve signup: auth user completes profile via security definer RPC.
-- First member of an org becomes boss (Owner); later joiners become employee (Member).

create or replace function public.complete_signup(
  p_name text,
  p_org_name text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_org uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_org_name text := nullif(trim(coalesce(p_org_name, '')), '');
  v_count integer;
  v_role public.user_role;
  v_finance boolean;
  v_row public.profiles;
begin
  if v_uid is null then
    raise exception '尚未登入，無法完成註冊';
  end if;
  if v_name is null then
    raise exception '請填寫姓名';
  end if;

  select email into v_email from auth.users where id = v_uid;

  -- Idempotent: already has profile
  select * into v_row from public.profiles where id = v_uid;
  if found then
    return v_row;
  end if;

  if v_org_name is not null then
    insert into public.organizations (name)
    values (v_org_name)
    returning id into v_org;
  else
    select id into v_org
    from public.organizations
    order by created_at asc
    limit 1;

    if v_org is null then
      insert into public.organizations (name)
      values ('水電工程行')
      returning id into v_org;
    end if;
  end if;

  select count(*) into v_count from public.profiles where organization_id = v_org;
  if v_count = 0 then
    v_role := 'boss';
    v_finance := true;
  else
    v_role := 'employee';
    v_finance := false;
  end if;

  insert into public.profiles (
    id, organization_id, name, role, email, finance_authorized
  ) values (
    v_uid, v_org, v_name, v_role, v_email, v_finance
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.complete_signup(text, text) from public;
grant execute on function public.complete_signup(text, text) to authenticated;

comment on function public.complete_signup(text, text) is
  'After auth.signUp/signIn, create profile. Empty org name joins oldest org (or creates default). Named org creates new company as first Owner.';

-- ===== LINE bind code =====
-- Personal LINE ↔ profile binding via short-lived code (reply-only flow).
-- App: create_line_bind_code() → user messages OA「綁定 XXXXXX」
-- Webhook (service role): consume_line_bind_code(code, line_user_id)

create table if not exists public.line_bind_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint line_bind_codes_code_format check (code ~ '^[A-Z0-9]{6}$')
);

create unique index if not exists line_bind_codes_code_active_uidx
  on public.line_bind_codes (code)
  where consumed_at is null;

create index if not exists line_bind_codes_profile_idx
  on public.line_bind_codes (profile_id, created_at desc);

alter table public.line_bind_codes enable row level security;

drop policy if exists "line_bind_codes_select_own" on public.line_bind_codes;
create policy "line_bind_codes_select_own"
  on public.line_bind_codes for select to authenticated
  using (profile_id = auth.uid());

revoke all on table public.line_bind_codes from public, anon, authenticated;
grant select on table public.line_bind_codes to authenticated;

create or replace function public.create_line_bind_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.current_user_org_id();
  v_code text;
  v_expires timestamptz := now() + interval '10 minutes';
  v_attempt int := 0;
begin
  if v_uid is null or v_org is null then
    raise exception '尚未登入或無法決定組織';
  end if;

  -- Invalidate unused prior codes for this profile
  update public.line_bind_codes
  set consumed_at = now()
  where profile_id = v_uid
    and consumed_at is null;

  loop
    v_attempt := v_attempt + 1;
    -- 6 chars, easy to type; exclude 0/O/1/I
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text || v_uid::text || v_attempt::text), 1, 6));
    begin
      insert into public.line_bind_codes (organization_id, profile_id, code, expires_at)
      values (v_org, v_uid, v_code, v_expires);
      exit;
    exception when unique_violation then
      if v_attempt >= 8 then
        raise;
      end if;
    end;
  end loop;

  return query select v_code, v_expires;
end;
$$;

revoke all on function public.create_line_bind_code() from public;
grant execute on function public.create_line_bind_code() to authenticated;

create or replace function public.consume_line_bind_code(
  p_code text,
  p_line_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_line text := trim(coalesce(p_line_user_id, ''));
  v_row public.line_bind_codes%rowtype;
  v_name text;
begin
  if v_code !~ '^[A-Z0-9]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if v_line = '' or length(v_line) < 10 then
    return jsonb_build_object('ok', false, 'error', 'invalid_line_user_id');
  end if;

  select * into v_row
  from public.line_bind_codes c
  where c.code = v_code
    and c.consumed_at is null
    and c.expires_at > now()
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'code_not_found_or_expired');
  end if;

  -- Free unique line_user_id if held by another profile
  update public.profiles
  set line_user_id = null
  where line_user_id = v_line
    and id is distinct from v_row.profile_id;

  update public.profiles
  set line_user_id = v_line
  where id = v_row.profile_id
  returning name into v_name;

  update public.line_bind_codes
  set consumed_at = now()
  where id = v_row.id;

  return jsonb_build_object(
    'ok', true,
    'profile_id', v_row.profile_id,
    'name', coalesce(v_name, ''),
    'line_user_id', v_line
  );
end;
$$;

-- Only service role (Edge Function) should consume codes
revoke all on function public.consume_line_bind_code(text, text) from public, anon, authenticated;
grant execute on function public.consume_line_bind_code(text, text) to service_role;

comment on function public.create_line_bind_code() is
  'Create a 10-minute LINE bind code for the current user';
comment on function public.consume_line_bind_code(text, text) is
  'Webhook-only: bind LINE user id to the profile that owns the code';

-- ===== LINE photo uploads =====
-- LINE / app construction photo uploads (private storage + metadata)

create table if not exists public.photo_uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  site_id uuid references public.sites (id) on delete set null,
  storage_path text not null,
  content_type text,
  byte_size integer,
  line_message_id text,
  source text not null default 'line',
  status text not null default 'pending'
    check (status in ('pending', 'linked', 'discarded')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists photo_uploads_org_created_idx
  on public.photo_uploads (organization_id, created_at desc);

create index if not exists photo_uploads_uploader_idx
  on public.photo_uploads (uploaded_by, created_at desc);

alter table public.photo_uploads enable row level security;

drop policy if exists "photo_uploads_select_org" on public.photo_uploads;
create policy "photo_uploads_select_org"
  on public.photo_uploads for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "photo_uploads_update_org" on public.photo_uploads;
create policy "photo_uploads_update_org"
  on public.photo_uploads for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

-- Inserts come from Edge Function (service role). Authenticated may also insert own rows.
drop policy if exists "photo_uploads_insert_own" on public.photo_uploads;
create policy "photo_uploads_insert_own"
  on public.photo_uploads for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and uploaded_by = auth.uid()
  );

revoke all on table public.photo_uploads from public, anon;
grant select, insert, update on table public.photo_uploads to authenticated;

-- Private storage bucket for construction photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-photos',
  'site-photos',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies: org members can read paths under their org id prefix
drop policy if exists "site_photos_select_org" on storage.objects;
create policy "site_photos_select_org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'site-photos'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

drop policy if exists "site_photos_insert_own" on storage.objects;
create policy "site_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-photos'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

comment on table public.photo_uploads is
  'Construction photos; LINE webhook writes pending rows for bound users';
