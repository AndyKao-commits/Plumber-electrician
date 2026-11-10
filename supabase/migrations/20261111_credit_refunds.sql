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
