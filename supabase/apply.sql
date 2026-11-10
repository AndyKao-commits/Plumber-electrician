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
    'quotation_items','emergency_limit_events','materials'
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

-- ===== construction reports =====
-- Construction field reports: text and/or linked photo (at least one required in app layer)

create table if not exists public.construction_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '',
  photo_upload_id uuid references public.photo_uploads (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint construction_reports_has_content check (
    length(trim(body)) > 0 or photo_upload_id is not null
  )
);

create index if not exists construction_reports_site_created_idx
  on public.construction_reports (site_id, created_at desc);

create index if not exists construction_reports_org_created_idx
  on public.construction_reports (organization_id, created_at desc);

alter table public.construction_reports enable row level security;

drop policy if exists "construction_reports_select_org" on public.construction_reports;
create policy "construction_reports_select_org"
  on public.construction_reports for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "construction_reports_insert_own" on public.construction_reports;
create policy "construction_reports_insert_own"
  on public.construction_reports for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and author_id = auth.uid()
  );

revoke all on table public.construction_reports from public, anon;
grant select, insert on table public.construction_reports to authenticated;

comment on table public.construction_reports is
  'Field construction reports; text and/or photo_upload_id required';

-- ===== defects + purchase inbound =====
-- Site defects (open → fixed → reinspected → closed) + purchase inbound linkage

create table if not exists public.site_defects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  reported_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  detail text not null default '',
  severity text not null default 'normal'
    check (severity in ('normal', 'safety')),
  status text not null default 'open'
    check (status in ('open', 'fixed', 'reinspected', 'closed')),
  fixed_at timestamptz,
  fixed_by uuid references public.profiles (id),
  fixed_note text,
  reinspected_at timestamptz,
  reinspected_by uuid references public.profiles (id),
  reinspect_note text,
  closed_at timestamptz,
  closed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists site_defects_site_status_idx
  on public.site_defects (site_id, status, created_at desc);

alter table public.site_defects enable row level security;

drop policy if exists "site_defects_select_org" on public.site_defects;
create policy "site_defects_select_org"
  on public.site_defects for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "site_defects_insert_own" on public.site_defects;
create policy "site_defects_insert_own"
  on public.site_defects for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and reported_by = auth.uid()
  );

drop policy if exists "site_defects_update_org" on public.site_defects;
create policy "site_defects_update_org"
  on public.site_defects for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

revoke all on table public.site_defects from public, anon;
grant select, insert, update on table public.site_defects to authenticated;

-- Track inventory inbound against a purchase (idempotent)
alter table public.purchases
  add column if not exists inbound_material_id uuid references public.materials (id),
  add column if not exists inbound_qty numeric(14,4),
  add column if not exists inbound_at timestamptz;

comment on table public.site_defects is
  'Site defects workflow: open → fixed → reinspected → closed; safety severity blocks casual close in app';

-- OPS: sync_operations (offline idempotency)
create table if not exists public.sync_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_operation_id text not null,
  operation_type text not null,
  request_hash text not null,
  status text not null default 'accepted'
    check (status in ('accepted', 'conflict', 'failed')),
  server_resource_id text,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_operations_client_op_unique
    unique (organization_id, user_id, client_operation_id)
);

create index if not exists sync_operations_user_created_idx
  on public.sync_operations (user_id, created_at desc);

create index if not exists sync_operations_org_status_idx
  on public.sync_operations (organization_id, status, created_at desc);

alter table public.sync_operations enable row level security;

drop policy if exists "sync_operations_select_own" on public.sync_operations;
create policy "sync_operations_select_own"
  on public.sync_operations for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and user_id = auth.uid()
  );

drop policy if exists "sync_operations_insert_own" on public.sync_operations;
create policy "sync_operations_insert_own"
  on public.sync_operations for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and user_id = auth.uid()
  );

drop policy if exists "sync_operations_update_own" on public.sync_operations;
create policy "sync_operations_update_own"
  on public.sync_operations for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and user_id = auth.uid()
  )
  with check (
    organization_id = public.current_user_org_id()
    and user_id = auth.uid()
  );

revoke all on table public.sync_operations from public, anon;
grant select, insert, update on table public.sync_operations to authenticated;

drop trigger if exists trg_set_org_sync_operations on public.sync_operations;
create trigger trg_set_org_sync_operations
  before insert on public.sync_operations
  for each row execute function public.set_org_id_from_profile();

comment on table public.sync_operations is
  '離線同步冪等：organization+user+client_operation_id 唯一；同鍵不同 hash → conflict';

-- LINE flow drafts + photo batch metadata
create table if not exists public.line_flow_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  line_user_id text not null,
  flow_type text not null
    check (flow_type in ('photo_upload', 'todos')),
  flow_status text not null default 'collecting'
    check (flow_status in (
      'idle', 'collecting', 'awaiting_confirmation', 'processing',
      'completed', 'cancelled', 'paused', 'expired'
    )),
  current_step text,
  draft_payload jsonb not null default '{}'::jsonb,
  last_activity_at timestamptz not null default now(),
  paused_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists line_flow_drafts_one_active_uidx
  on public.line_flow_drafts (line_user_id)
  where flow_status in ('collecting', 'awaiting_confirmation', 'processing', 'paused');

create index if not exists line_flow_drafts_profile_idx
  on public.line_flow_drafts (profile_id, updated_at desc);

create index if not exists line_flow_drafts_org_idx
  on public.line_flow_drafts (organization_id, flow_status);

alter table public.line_flow_drafts enable row level security;

drop policy if exists "line_flow_drafts_select_own" on public.line_flow_drafts;
create policy "line_flow_drafts_select_own"
  on public.line_flow_drafts for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and profile_id = auth.uid()
  );

revoke all on table public.line_flow_drafts from public, anon;
grant select on table public.line_flow_drafts to authenticated;

alter table public.photo_uploads
  add column if not exists batch_id uuid,
  add column if not exists photo_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'photo_uploads_photo_type_check'
  ) then
    alter table public.photo_uploads
      add constraint photo_uploads_photo_type_check
      check (
        photo_type is null
        or photo_type in ('before', 'during', 'after', 'acceptance', 'unclassified')
      );
  end if;
end $$;

create index if not exists photo_uploads_batch_idx
  on public.photo_uploads (batch_id, created_at);

-- LINE phase 2 flow types + service-role org stamp fix
create or replace function public.set_org_id_from_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_user_org_id();
  end if;
  if new.organization_id is null then
    raise exception '無法決定組織，請確認 profiles 已建立';
  end if;
  return new;
end;
$$;

alter table public.line_flow_drafts
  drop constraint if exists line_flow_drafts_flow_type_check;

alter table public.line_flow_drafts
  add constraint line_flow_drafts_flow_type_check
  check (flow_type in ('photo_upload', 'todos', 'attendance', 'purchase'));
-- FIN-02: quotation line items (material / labor / other)
-- Header amounts are derived from sum(items); frozen quotes reject item mutations.

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
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_quotation_items on public.quotation_items;
create trigger trg_set_org_quotation_items
  before insert on public.quotation_items
  for each row execute function public.set_org_id_from_profile();

create or replace function public.protect_frozen_quotation_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  frozen_flag boolean;
begin
  select q.frozen into frozen_flag
  from public.quotations q
  where q.id = coalesce(new.quotation_id, old.quotation_id);

  if coalesce(frozen_flag, false) then
    raise exception 'published quotation items are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_frozen_quotation_items on public.quotation_items;
create trigger trg_protect_frozen_quotation_items
  before insert or update or delete on public.quotation_items
  for each row execute function public.protect_frozen_quotation_items();

create or replace function public.recalc_quotation_amounts_from_items(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  items_sum numeric(12,2);
  tax_amt numeric(12,2);
  after_amt numeric(12,2);
  rate numeric(8,4);
begin
  select * into q from public.quotations where id = p_quote_id for update;
  if not found then
    return;
  end if;
  if q.frozen or q.status = 'published' then
    return;
  end if;

  select coalesce(sum(amount), 0) into items_sum
  from public.quotation_items
  where quotation_id = p_quote_id;

  rate := coalesce(q.tax_rate, 0.05);
  if q.tax_mode = 'zero' then
    tax_amt := 0;
    after_amt := round(items_sum::numeric, 2);
    rate := 0;
  elsif q.tax_mode = 'exclusive' then
    tax_amt := round((items_sum * rate)::numeric, 2);
    after_amt := round((items_sum + tax_amt)::numeric, 2);
  else
    -- inclusive: items sum is tax-included total
    after_amt := round(items_sum::numeric, 2);
    tax_amt := round((after_amt - after_amt / (1 + rate))::numeric, 2);
  end if;

  update public.quotations
  set
    amount_before_tax = items_sum,
    tax_amount = tax_amt,
    amount_after_tax = after_amt,
    tax_rate = rate
  where id = p_quote_id
    and frozen = false;
end;
$$;

create or replace function public.trg_recalc_quotation_amounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_quotation_amounts_from_items(
    coalesce(new.quotation_id, old.quotation_id)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recalc_quotation_amounts on public.quotation_items;
create trigger trg_recalc_quotation_amounts
  after insert or update or delete on public.quotation_items
  for each row execute function public.trg_recalc_quotation_amounts();

-- Quote cases: case-centric workflow, export versions (immutable snapshots).
-- Avoid enum ADD VALUE + immediate use (55P04): use text workflow_status.

alter table public.quotations
  add column if not exists quote_number text,
  add column if not exists workflow_status text,
  add column if not exists customer_name text,
  add column if not exists site_address text,
  add column if not exists discount numeric(12,2) not null default 0,
  add column if not exists notes text,
  add column if not exists payment_terms text,
  add column if not exists valid_until date,
  add column if not exists current_version integer not null default 0,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_exported_at timestamptz;

-- Backfill workflow from legacy status
update public.quotations
set workflow_status = case
  when status::text = 'published' then 'exported'
  when status::text = 'void' then 'cancelled'
  else 'editing'
end
where workflow_status is null;

update public.quotations
set quote_number = 'Q-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where quote_number is null;

update public.quotations q
set customer_name = coalesce(
  q.customer_name,
  (select r.customer_name from public.repair_cases r where r.id = q.repair_case_id),
  (select s.customer_name from public.sites s where s.id = q.project_id),
  ''
)
where q.customer_name is null;

update public.quotations q
set site_address = coalesce(
  q.site_address,
  (select s.address from public.sites s where s.id = q.project_id),
  (select s.address from public.sites s
     join public.repair_cases r on r.site_id = s.id
    where r.id = q.repair_case_id),
  ''
)
where q.site_address is null;

alter table public.quotations
  alter column workflow_status set default 'editing';

alter table public.quotations
  alter column workflow_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'quotations_workflow_status_check'
  ) then
    alter table public.quotations
      add constraint quotations_workflow_status_check
      check (
        workflow_status in (
          'editing',
          'exported',
          'sent_to_customer',
          'accepted',
          'rejected',
          'cancelled'
        )
      );
  end if;
end $$;

create unique index if not exists quotations_quote_number_org_uidx
  on public.quotations (organization_id, quote_number);

create index if not exists quotations_org_workflow_idx
  on public.quotations (organization_id, workflow_status, updated_at desc);

-- Immutable export snapshots
create table if not exists public.quotation_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  version_no integer not null,
  quote_number text not null,
  snapshot jsonb not null,
  exported_at timestamptz not null default now(),
  exported_by uuid references public.profiles (id),
  export_format text not null default 'snapshot'
    check (export_format in ('snapshot', 'pdf', 'csv', 'print')),
  constraint quotation_versions_unique unique (quotation_id, version_no)
);

create index if not exists quotation_versions_quote_idx
  on public.quotation_versions (quotation_id, version_no desc);

alter table public.quotation_versions enable row level security;

drop policy if exists "quotation_versions_org_all" on public.quotation_versions;
create policy "quotation_versions_org_all"
  on public.quotation_versions for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_quotation_versions on public.quotation_versions;
create trigger trg_set_org_quotation_versions
  before insert on public.quotation_versions
  for each row execute function public.set_org_id_from_profile();

-- Versions are immutable
create or replace function public.protect_quotation_version_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'quotation versions are immutable';
end;
$$;

drop trigger if exists trg_protect_quotation_version on public.quotation_versions;
create trigger trg_protect_quotation_version
  before update or delete on public.quotation_versions
  for each row execute function public.protect_quotation_version_immutable();

-- Live quote items: block only when accepted / cancelled (not “frozen publish”)
create or replace function public.protect_frozen_quotation_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws text;
begin
  select coalesce(q.workflow_status, 'editing') into ws
  from public.quotations q
  where q.id = coalesce(new.quotation_id, old.quotation_id);

  if ws in ('accepted', 'cancelled') then
    raise exception 'accepted or cancelled quotation items are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Touch updated_at on quotation header changes
create or replace function public.touch_quotation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_quotation_updated_at on public.quotations;
create trigger trg_touch_quotation_updated_at
  before update on public.quotations
  for each row execute function public.touch_quotation_updated_at();

-- Recalc still includes discount on header (subtotal from items − discount + tax)
create or replace function public.recalc_quotation_amounts_from_items(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  items_sum numeric(12,2);
  discount_amt numeric(12,2);
  taxable numeric(12,2);
  tax_amt numeric(12,2);
  after_amt numeric(12,2);
  rate numeric(8,4);
begin
  select * into q from public.quotations where id = p_quote_id for update;
  if not found then
    return;
  end if;
  if coalesce(q.workflow_status, 'editing') in ('accepted', 'cancelled') then
    return;
  end if;

  select coalesce(sum(amount), 0) into items_sum
  from public.quotation_items
  where quotation_id = p_quote_id;

  discount_amt := coalesce(q.discount, 0);
  if discount_amt < 0 then discount_amt := 0; end if;
  taxable := greatest(items_sum - discount_amt, 0);

  rate := coalesce(q.tax_rate, 0.05);
  if q.tax_mode = 'zero' then
    tax_amt := 0;
    after_amt := round(taxable::numeric, 2);
    rate := 0;
  elsif q.tax_mode = 'exclusive' then
    tax_amt := round((taxable * rate)::numeric, 2);
    after_amt := round((taxable + tax_amt)::numeric, 2);
  else
    after_amt := round(taxable::numeric, 2);
    tax_amt := round((after_amt - after_amt / (1 + rate))::numeric, 2);
  end if;

  update public.quotations
  set
    amount_before_tax = items_sum,
    tax_amount = tax_amt,
    amount_after_tax = after_amt,
    tax_rate = rate,
    updated_at = now()
  where id = p_quote_id;
end;
$$;


-- ===== Quote soft-delete (cases + versions) =====
alter table public.quotations
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id),
  add column if not exists delete_reason text,
  add column if not exists customer_phone text,
  add column if not exists construction_notes text;

alter table public.quotation_versions
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id),
  add column if not exists delete_reason text;

create index if not exists quotations_not_deleted_idx
  on public.quotations (organization_id, updated_at desc)
  where deleted_at is null;

create index if not exists quotation_versions_not_deleted_idx
  on public.quotation_versions (quotation_id, version_no desc)
  where deleted_at is null;

create or replace function public.protect_quotation_version_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'quotation versions cannot be hard-deleted';
  end if;

  if tg_op = 'UPDATE' then
    if new.snapshot is distinct from old.snapshot
      or new.version_no is distinct from old.version_no
      or new.quote_number is distinct from old.quote_number
      or new.quotation_id is distinct from old.quotation_id
      or new.organization_id is distinct from old.organization_id
      or new.exported_at is distinct from old.exported_at
      or new.exported_by is distinct from old.exported_by
      or new.export_format is distinct from old.export_format
    then
      raise exception 'quotation version content is immutable';
    end if;
    return new;
  end if;

  return new;
end;
$$;
-- FIN-002: change orders (追加／追減). Only accepted ones affect effective contract.

create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  change_number text not null,
  kind text not null check (kind in ('addition', 'reduction')),
  title text not null,
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'sent_to_customer',
        'accepted',
        'rejected',
        'cancelled'
      )
    ),
  tax_mode text not null check (tax_mode in ('exclusive', 'inclusive', 'zero')),
  tax_rate numeric(8,4) not null default 0.05,
  amount_before_tax numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  amount_after_tax numeric(12,2) not null default 0,
  notes text,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint change_orders_number_org_uidx unique (organization_id, change_number)
);

create index if not exists change_orders_quote_idx
  on public.change_orders (quotation_id, updated_at desc);

create index if not exists change_orders_org_status_idx
  on public.change_orders (organization_id, status, updated_at desc);

create table if not exists public.change_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  change_order_id uuid not null references public.change_orders (id) on delete cascade,
  line_no integer not null,
  kind text not null check (kind in ('material', 'labor', 'other')),
  description text not null,
  qty numeric(12,3) not null default 1,
  unit text not null default '式',
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint change_order_items_line_uidx unique (change_order_id, line_no)
);

create index if not exists change_order_items_co_idx
  on public.change_order_items (change_order_id, line_no);

alter table public.change_orders enable row level security;
alter table public.change_order_items enable row level security;

drop policy if exists "change_orders_org_all" on public.change_orders;
create policy "change_orders_org_all"
  on public.change_orders for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "change_order_items_org_all" on public.change_order_items;
create policy "change_order_items_org_all"
  on public.change_order_items for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_change_orders on public.change_orders;
create trigger trg_set_org_change_orders
  before insert on public.change_orders
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_change_order_items on public.change_order_items;
create trigger trg_set_org_change_order_items
  before insert on public.change_order_items
  for each row execute function public.set_org_id_from_profile();

create or replace function public.protect_accepted_change_order_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  st text;
begin
  select status into st
  from public.change_orders
  where id = coalesce(new.change_order_id, old.change_order_id);

  if st in ('accepted', 'cancelled') then
    raise exception 'accepted or cancelled change order items are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_change_order_items on public.change_order_items;
create trigger trg_protect_change_order_items
  before insert or update or delete on public.change_order_items
  for each row execute function public.protect_accepted_change_order_items();

create or replace function public.recalc_change_order_amounts(p_co_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  items_sum numeric(12,2);
  discount_amt numeric(12,2);
  taxable numeric(12,2);
  tax_amt numeric(12,2);
  after_amt numeric(12,2);
  rate numeric(8,4);
begin
  select * into c from public.change_orders where id = p_co_id for update;
  if not found then
    return;
  end if;
  if c.status in ('accepted', 'cancelled') then
    return;
  end if;

  select coalesce(sum(amount), 0) into items_sum
  from public.change_order_items
  where change_order_id = p_co_id;

  discount_amt := coalesce(c.discount, 0);
  if discount_amt < 0 then discount_amt := 0; end if;
  taxable := greatest(items_sum - discount_amt, 0);

  rate := coalesce(c.tax_rate, 0.05);
  if c.tax_mode = 'zero' then
    tax_amt := 0;
    after_amt := round(taxable::numeric, 2);
    rate := 0;
  elsif c.tax_mode = 'exclusive' then
    tax_amt := round((taxable * rate)::numeric, 2);
    after_amt := round((taxable + tax_amt)::numeric, 2);
  else
    after_amt := round(taxable::numeric, 2);
    tax_amt := round((after_amt - after_amt / (1 + rate))::numeric, 2);
  end if;

  update public.change_orders
  set
    amount_before_tax = items_sum,
    tax_amount = tax_amt,
    amount_after_tax = after_amt,
    tax_rate = rate,
    updated_at = now()
  where id = p_co_id;
end;
$$;

create or replace function public.trg_recalc_change_order_amounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_change_order_amounts(
    coalesce(new.change_order_id, old.change_order_id)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recalc_co_on_items on public.change_order_items;
create trigger trg_recalc_co_on_items
  after insert or update or delete on public.change_order_items
  for each row execute function public.trg_recalc_change_order_amounts();

-- Parent quote must be accepted before creating change orders (app enforces;
-- DB soft-check via trigger for inserts)
create or replace function public.assert_change_order_parent_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws text;
begin
  if tg_op = 'INSERT' then
    select workflow_status into ws
    from public.quotations
    where id = new.quotation_id;
    if ws is distinct from 'accepted' then
      raise exception 'change orders require an accepted quotation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assert_co_parent_accepted on public.change_orders;
create trigger trg_assert_co_parent_accepted
  before insert on public.change_orders
  for each row execute function public.assert_change_order_parent_accepted();

-- FIN-003: billing milestones + formal billing documents (請款 ≠ 發票 ≠ 收款)

create table if not exists public.billing_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  code text not null,
  title text not null,
  sequence integer not null default 1,
  planned_amount numeric(12,2) not null default 0,
  status text not null default 'planned'
    check (status in ('planned', 'billed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint billing_milestones_code_uidx unique (quotation_id, code)
);

create index if not exists billing_milestones_quote_idx
  on public.billing_milestones (quotation_id, sequence);

create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  milestone_id uuid not null references public.billing_milestones (id),
  document_number text not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'void')),
  tax_mode text not null check (tax_mode in ('exclusive', 'inclusive', 'zero')),
  tax_rate numeric(8,4) not null default 0.05,
  amount_before_tax numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  amount_after_tax numeric(12,2) not null default 0,
  notes text,
  snapshot jsonb,
  issued_at timestamptz,
  issued_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint billing_documents_number_org_uidx unique (organization_id, document_number)
);

-- Only one issued formal document per milestone (FIN-05)
create unique index if not exists billing_documents_issued_milestone_uidx
  on public.billing_documents (milestone_id)
  where status = 'issued';

create index if not exists billing_documents_quote_idx
  on public.billing_documents (quotation_id, updated_at desc);

create table if not exists public.billing_document_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  billing_document_id uuid not null references public.billing_documents (id) on delete cascade,
  line_no integer not null,
  description text not null,
  qty numeric(12,3) not null default 1,
  unit text not null default '式',
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint billing_document_items_line_uidx unique (billing_document_id, line_no)
);

alter table public.billing_milestones enable row level security;
alter table public.billing_documents enable row level security;
alter table public.billing_document_items enable row level security;

drop policy if exists "billing_milestones_org_all" on public.billing_milestones;
create policy "billing_milestones_org_all"
  on public.billing_milestones for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "billing_documents_org_all" on public.billing_documents;
create policy "billing_documents_org_all"
  on public.billing_documents for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "billing_document_items_org_all" on public.billing_document_items;
create policy "billing_document_items_org_all"
  on public.billing_document_items for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_billing_milestones on public.billing_milestones;
create trigger trg_set_org_billing_milestones
  before insert on public.billing_milestones
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_billing_documents on public.billing_documents;
create trigger trg_set_org_billing_documents
  before insert on public.billing_documents
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_billing_document_items on public.billing_document_items;
create trigger trg_set_org_billing_document_items
  before insert on public.billing_document_items
  for each row execute function public.set_org_id_from_profile();

create or replace function public.assert_billing_parent_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws text;
begin
  select workflow_status into ws from public.quotations where id = new.quotation_id;
  if ws is distinct from 'accepted' then
    raise exception 'billing requires an accepted quotation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assert_billing_milestone_parent on public.billing_milestones;
create trigger trg_assert_billing_milestone_parent
  before insert on public.billing_milestones
  for each row execute function public.assert_billing_parent_accepted();

create or replace function public.protect_issued_billing_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'issued' then
    if new.status = 'void' then
      -- allow voiding issued docs
      return new;
    end if;
    if new.document_number is distinct from old.document_number
      or new.milestone_id is distinct from old.milestone_id
      or new.quotation_id is distinct from old.quotation_id
      or new.amount_after_tax is distinct from old.amount_after_tax
      or new.amount_before_tax is distinct from old.amount_before_tax
      or new.tax_amount is distinct from old.tax_amount
      or new.tax_mode is distinct from old.tax_mode
      or new.snapshot is distinct from old.snapshot
      or new.title is distinct from old.title
    then
      raise exception 'issued billing documents are immutable';
    end if;
  end if;
  if tg_op = 'DELETE' and old.status = 'issued' then
    raise exception 'issued billing documents cannot be deleted';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_protect_issued_billing on public.billing_documents;
create trigger trg_protect_issued_billing
  before update or delete on public.billing_documents
  for each row execute function public.protect_issued_billing_document();

create or replace function public.protect_issued_billing_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  st text;
begin
  select status into st
  from public.billing_documents
  where id = coalesce(new.billing_document_id, old.billing_document_id);
  if st in ('issued', 'void') then
    raise exception 'issued billing document items are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_billing_items on public.billing_document_items;
create trigger trg_protect_billing_items
  before insert or update or delete on public.billing_document_items
  for each row execute function public.protect_issued_billing_items();

-- FIN-004: payments, allocations, customer advances, advance applications
-- 收款 ≠ 請款 ≠ 預收抵充（抵充不新增現金）

create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  payment_number text not null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash', 'transfer', 'check', 'other')),
  status text not null default 'confirmed'
    check (status in ('confirmed', 'void')),
  received_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint customer_payments_number_org_uidx unique (organization_id, payment_number)
);

create index if not exists customer_payments_quote_idx
  on public.customer_payments (quotation_id, received_at desc);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  payment_id uuid not null references public.customer_payments (id) on delete cascade,
  billing_document_id uuid not null references public.billing_documents (id),
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id)
);

create index if not exists payment_allocations_payment_idx
  on public.payment_allocations (payment_id);
create index if not exists payment_allocations_billing_idx
  on public.payment_allocations (billing_document_id);

create table if not exists public.customer_advances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  advance_number text not null,
  amount numeric(12,2) not null check (amount > 0),
  remaining_amount numeric(12,2) not null check (remaining_amount >= 0),
  status text not null default 'open'
    check (status in ('open', 'closed', 'void')),
  received_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint customer_advances_number_org_uidx unique (organization_id, advance_number)
);

create index if not exists customer_advances_quote_idx
  on public.customer_advances (quotation_id, created_at desc);

create table if not exists public.advance_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  advance_id uuid not null references public.customer_advances (id),
  billing_document_id uuid not null references public.billing_documents (id),
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id)
);

create index if not exists advance_applications_advance_idx
  on public.advance_applications (advance_id);
create index if not exists advance_applications_billing_idx
  on public.advance_applications (billing_document_id);

alter table public.customer_payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.customer_advances enable row level security;
alter table public.advance_applications enable row level security;

drop policy if exists "customer_payments_org_all" on public.customer_payments;
create policy "customer_payments_org_all"
  on public.customer_payments for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "payment_allocations_org_all" on public.payment_allocations;
create policy "payment_allocations_org_all"
  on public.payment_allocations for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "customer_advances_org_all" on public.customer_advances;
create policy "customer_advances_org_all"
  on public.customer_advances for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "advance_applications_org_all" on public.advance_applications;
create policy "advance_applications_org_all"
  on public.advance_applications for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_customer_payments on public.customer_payments;
create trigger trg_set_org_customer_payments
  before insert on public.customer_payments
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_payment_allocations on public.payment_allocations;
create trigger trg_set_org_payment_allocations
  before insert on public.payment_allocations
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_customer_advances on public.customer_advances;
create trigger trg_set_org_customer_advances
  before insert on public.customer_advances
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_advance_applications on public.advance_applications;
create trigger trg_set_org_advance_applications
  before insert on public.advance_applications
  for each row execute function public.set_org_id_from_profile();

-- FIN-005: customer credit notes (折讓) + refunds (退款). Preserve originals; no double deduct.

create table if not exists public.customer_credit_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  billing_document_id uuid references public.billing_documents (id),
  credit_number text not null,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  status text not null default 'issued' check (status in ('issued', 'void')),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint customer_credit_notes_number_org_uidx unique (organization_id, credit_number)
);

create index if not exists customer_credit_notes_quote_idx
  on public.customer_credit_notes (quotation_id, issued_at desc);

create table if not exists public.customer_refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  payment_id uuid not null references public.customer_payments (id),
  refund_number text not null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash', 'transfer', 'check', 'other')),
  status text not null default 'confirmed' check (status in ('confirmed', 'void')),
  reason text not null,
  refunded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint customer_refunds_number_org_uidx unique (organization_id, refund_number)
);

create index if not exists customer_refunds_payment_idx
  on public.customer_refunds (payment_id);
create index if not exists customer_refunds_quote_idx
  on public.customer_refunds (quotation_id, refunded_at desc);

alter table public.customer_credit_notes enable row level security;
alter table public.customer_refunds enable row level security;

drop policy if exists "customer_credit_notes_org_all" on public.customer_credit_notes;
create policy "customer_credit_notes_org_all"
  on public.customer_credit_notes for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "customer_refunds_org_all" on public.customer_refunds;
create policy "customer_refunds_org_all"
  on public.customer_refunds for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_customer_credit_notes on public.customer_credit_notes;
create trigger trg_set_org_customer_credit_notes
  before insert on public.customer_credit_notes
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_customer_refunds on public.customer_refunds;
create trigger trg_set_org_customer_refunds
  before insert on public.customer_refunds
  for each row execute function public.set_org_id_from_profile();

