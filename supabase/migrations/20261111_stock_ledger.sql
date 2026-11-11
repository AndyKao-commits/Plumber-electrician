-- INV-002: immutable stock ledger, locations, balances, reservations.

create table if not exists public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  kind text not null check (kind in ('warehouse', 'site')),
  name text not null,
  site_id uuid references public.sites (id) on delete set null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists stock_locations_one_default_uidx
  on public.stock_locations (organization_id)
  where is_default;

create table if not exists public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  material_id uuid not null references public.materials (id),
  location_id uuid not null references public.stock_locations (id),
  qty numeric(14,4) not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now(),
  constraint stock_balances_mat_loc_uidx unique (organization_id, material_id, location_id)
);

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  material_id uuid not null references public.materials (id),
  location_id uuid references public.stock_locations (id) on delete set null,
  qty numeric(14,4) not null check (qty > 0),
  status text not null check (status in ('active', 'released', 'consumed')),
  note text,
  client_operation_id text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  released_at timestamptz,
  constraint stock_reservations_op_org_uidx unique (organization_id, client_operation_id)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  movement_type text not null check (
    movement_type in (
      'inbound', 'transfer', 'reserve', 'release', 'usage', 'adjust', 'reversal'
    )
  ),
  material_id uuid not null references public.materials (id),
  material_name text not null,
  qty numeric(14,4) not null check (qty > 0),
  unit_cost numeric(14,4) not null check (unit_cost >= 0),
  from_location_id uuid references public.stock_locations (id) on delete set null,
  to_location_id uuid references public.stock_locations (id) on delete set null,
  reservation_id uuid references public.stock_reservations (id) on delete set null,
  note text,
  client_operation_id text not null,
  posted_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  reversal_of uuid references public.stock_movements (id) on delete set null,
  constraint stock_movements_op_org_uidx unique (organization_id, client_operation_id)
);

create index if not exists stock_movements_material_idx
  on public.stock_movements (material_id, posted_at desc);

create index if not exists stock_reservations_material_idx
  on public.stock_reservations (material_id, status);

alter table public.stock_locations enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists "stock_locations_org_all" on public.stock_locations;
create policy "stock_locations_org_all"
  on public.stock_locations for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "stock_balances_org_all" on public.stock_balances;
create policy "stock_balances_org_all"
  on public.stock_balances for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "stock_reservations_org_all" on public.stock_reservations;
create policy "stock_reservations_org_all"
  on public.stock_reservations for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "stock_movements_org_select" on public.stock_movements;
create policy "stock_movements_org_select"
  on public.stock_movements for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "stock_movements_org_insert" on public.stock_movements;
create policy "stock_movements_org_insert"
  on public.stock_movements for insert to authenticated
  with check (organization_id = public.current_user_org_id());

-- Immutable ledger: no update/delete via RLS (no policies for update/delete).

drop trigger if exists trg_set_org_stock_locations on public.stock_locations;
create trigger trg_set_org_stock_locations
  before insert on public.stock_locations
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_stock_balances on public.stock_balances;
create trigger trg_set_org_stock_balances
  before insert on public.stock_balances
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_stock_reservations on public.stock_reservations;
create trigger trg_set_org_stock_reservations
  before insert on public.stock_reservations
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_stock_movements on public.stock_movements;
create trigger trg_set_org_stock_movements
  before insert on public.stock_movements
  for each row execute function public.set_org_id_from_profile();
