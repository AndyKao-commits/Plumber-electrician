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
