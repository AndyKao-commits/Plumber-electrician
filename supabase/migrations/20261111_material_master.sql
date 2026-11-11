-- INV-001: material SKU, tracking mode, units, serials (org-isolated).

alter table public.materials
  add column if not exists sku text,
  add column if not exists tracking_mode text not null default 'quantity',
  add column if not exists base_unit_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'materials_tracking_mode_chk'
  ) then
    alter table public.materials
      add constraint materials_tracking_mode_chk
      check (tracking_mode in ('quantity', 'serial'));
  end if;
end $$;

create unique index if not exists materials_org_sku_uidx
  on public.materials (organization_id, sku)
  where sku is not null;

update public.materials
set base_unit_code = coalesce(base_unit_code, unit)
where base_unit_code is null;

create table if not exists public.material_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  material_id uuid not null references public.materials (id) on delete cascade,
  code text not null,
  label text not null,
  factor_to_base numeric(14,6) not null check (factor_to_base > 0),
  is_base boolean not null default false,
  constraint material_units_code_uidx unique (organization_id, material_id, code)
);

create table if not exists public.material_serials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  material_id uuid not null references public.materials (id),
  serial_number text not null,
  status text not null check (status in ('in_stock', 'issued', 'scrapped')),
  unit_cost numeric(14,4) not null check (unit_cost >= 0),
  location_id uuid references public.stock_locations (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint material_serials_org_serial_uidx unique (organization_id, serial_number)
);

create index if not exists material_serials_material_idx
  on public.material_serials (material_id, status);

alter table public.material_units enable row level security;
alter table public.material_serials enable row level security;

drop policy if exists "material_units_org_all" on public.material_units;
create policy "material_units_org_all"
  on public.material_units for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "material_serials_org_all" on public.material_serials;
create policy "material_serials_org_all"
  on public.material_serials for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_material_units on public.material_units;
create trigger trg_set_org_material_units
  before insert on public.material_units
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_material_serials on public.material_serials;
create trigger trg_set_org_material_serials
  before insert on public.material_serials
  for each row execute function public.set_org_id_from_profile();
