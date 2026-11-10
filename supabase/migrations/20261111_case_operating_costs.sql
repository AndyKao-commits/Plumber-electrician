-- FIN-006: confirmed operating costs for project/repair finance summary.
-- Separate from AR/cash; not accounting revenue. Free warranty still keeps cost.

create table if not exists public.case_operating_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  kind text not null check (kind in ('material', 'labor_ops', 'other')),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'confirmed' check (status in ('confirmed', 'void')),
  warranty_free boolean not null default false,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id)
);

create index if not exists case_operating_costs_quote_idx
  on public.case_operating_costs (quotation_id, confirmed_at desc);

alter table public.case_operating_costs enable row level security;

drop policy if exists "case_operating_costs_org_all" on public.case_operating_costs;
create policy "case_operating_costs_org_all"
  on public.case_operating_costs for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_case_operating_costs on public.case_operating_costs;
create trigger trg_set_org_case_operating_costs
  before insert on public.case_operating_costs
  for each row execute function public.set_org_id_from_profile();
