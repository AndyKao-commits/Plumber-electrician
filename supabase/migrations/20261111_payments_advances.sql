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
