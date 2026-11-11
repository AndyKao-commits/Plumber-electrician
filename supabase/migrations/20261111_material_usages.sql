-- REP-002: formal material usages for repairs (deduct once; no negative stock).

create table if not exists public.material_usages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  material_id uuid not null references public.materials (id),
  material_name text not null,
  qty numeric(12,4) not null check (qty > 0),
  unit_cost numeric(12,4) not null check (unit_cost >= 0),
  total_cost numeric(12,2) not null check (total_cost >= 0),
  repair_case_id uuid references public.repair_cases (id) on delete set null,
  site_id uuid references public.sites (id) on delete set null,
  note text,
  client_operation_id text not null,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint material_usages_op_org_uidx unique (organization_id, client_operation_id)
);

create index if not exists material_usages_repair_idx
  on public.material_usages (repair_case_id, posted_at desc);

create index if not exists material_usages_material_idx
  on public.material_usages (material_id, posted_at desc);

alter table public.material_usages enable row level security;

drop policy if exists "material_usages_org_all" on public.material_usages;
create policy "material_usages_org_all"
  on public.material_usages for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_material_usages on public.material_usages;
create trigger trg_set_org_material_usages
  before insert on public.material_usages
  for each row execute function public.set_org_id_from_profile();
