-- PET-001 / REV-05: petty cash accounts, top-up requests, disbursements, ledger.

create table if not exists public.petty_cash_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  custodian_user_id uuid not null references public.profiles (id),
  label text not null,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.petty_cash_top_up_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  account_id uuid not null references public.petty_cash_accounts (id),
  amount numeric(14,2) not null check (amount > 0),
  reason text not null,
  status text not null check (
    status in ('pending_approval', 'approved', 'rejected', 'disbursed')
  ),
  requested_by uuid not null references public.profiles (id),
  requested_at timestamptz not null default now(),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  rejected_reason text,
  disbursement_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.petty_cash_disbursements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  request_id uuid not null references public.petty_cash_top_up_requests (id),
  account_id uuid not null references public.petty_cash_accounts (id),
  amount numeric(14,2) not null check (amount > 0),
  disbursed_by uuid not null references public.profiles (id),
  disbursed_at timestamptz not null default now(),
  note text,
  constraint petty_cash_disbursements_request_uidx unique (request_id)
);

alter table public.petty_cash_top_up_requests
  drop constraint if exists petty_cash_top_up_requests_disbursement_fk;
alter table public.petty_cash_top_up_requests
  add constraint petty_cash_top_up_requests_disbursement_fk
  foreign key (disbursement_id) references public.petty_cash_disbursements (id);

create table if not exists public.petty_cash_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  account_id uuid not null references public.petty_cash_accounts (id),
  entry_type text not null check (entry_type in ('top_up', 'expense', 'adjust')),
  amount numeric(14,2) not null,
  balance_after numeric(14,2) not null,
  source_type text not null check (source_type in ('disbursement', 'manual')),
  source_id uuid not null,
  note text,
  posted_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id)
);

create index if not exists petty_cash_requests_status_idx
  on public.petty_cash_top_up_requests (organization_id, status, requested_at desc);

alter table public.petty_cash_accounts enable row level security;
alter table public.petty_cash_top_up_requests enable row level security;
alter table public.petty_cash_disbursements enable row level security;
alter table public.petty_cash_ledger_entries enable row level security;

drop policy if exists "petty_cash_accounts_org_all" on public.petty_cash_accounts;
create policy "petty_cash_accounts_org_all"
  on public.petty_cash_accounts for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "petty_cash_requests_org_all" on public.petty_cash_top_up_requests;
create policy "petty_cash_requests_org_all"
  on public.petty_cash_top_up_requests for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "petty_cash_disbursements_org_all" on public.petty_cash_disbursements;
create policy "petty_cash_disbursements_org_all"
  on public.petty_cash_disbursements for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "petty_cash_ledger_org_all" on public.petty_cash_ledger_entries;
create policy "petty_cash_ledger_org_all"
  on public.petty_cash_ledger_entries for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_petty_cash_accounts on public.petty_cash_accounts;
create trigger trg_set_org_petty_cash_accounts
  before insert on public.petty_cash_accounts
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_petty_cash_requests on public.petty_cash_top_up_requests;
create trigger trg_set_org_petty_cash_requests
  before insert on public.petty_cash_top_up_requests
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_petty_cash_disbursements on public.petty_cash_disbursements;
create trigger trg_set_org_petty_cash_disbursements
  before insert on public.petty_cash_disbursements
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_petty_cash_ledger on public.petty_cash_ledger_entries;
create trigger trg_set_org_petty_cash_ledger
  before insert on public.petty_cash_ledger_entries
  for each row execute function public.set_org_id_from_profile();
