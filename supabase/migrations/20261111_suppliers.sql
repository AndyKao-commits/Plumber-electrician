-- SUP-001: suppliers, credit limit, purchase supplier link + paid_at.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  credit_limit numeric(14,2),
  payment_terms_days integer not null default 30 check (payment_terms_days >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.purchases
  add column if not exists supplier_id uuid references public.suppliers (id) on delete set null,
  add column if not exists paid_at timestamptz;

create index if not exists purchases_supplier_idx
  on public.purchases (supplier_id, status);

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_org_all" on public.suppliers;
create policy "suppliers_org_all"
  on public.suppliers for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_suppliers on public.suppliers;
create trigger trg_set_org_suppliers
  before insert on public.suppliers
  for each row execute function public.set_org_id_from_profile();
