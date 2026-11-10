-- CRM-001: customers, contacts, many-to-many site links.
-- Customer name-only create; multiple customers may share one site.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

create index if not exists customers_org_name_idx
  on public.customers (organization_id, name);

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists customer_contacts_customer_idx
  on public.customer_contacts (customer_id, created_at desc);

create table if not exists public.customer_site_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  customer_id uuid not null references public.customers (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint customer_site_links_unique unique (customer_id, site_id)
);

create index if not exists customer_site_links_site_idx
  on public.customer_site_links (site_id);

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.customer_site_links enable row level security;

drop policy if exists "customers_org_all" on public.customers;
create policy "customers_org_all"
  on public.customers for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "customer_contacts_org_all" on public.customer_contacts;
create policy "customer_contacts_org_all"
  on public.customer_contacts for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "customer_site_links_org_all" on public.customer_site_links;
create policy "customer_site_links_org_all"
  on public.customer_site_links for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_customers on public.customers;
create trigger trg_set_org_customers
  before insert on public.customers
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_customer_contacts on public.customer_contacts;
create trigger trg_set_org_customer_contacts
  before insert on public.customer_contacts
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_customer_site_links on public.customer_site_links;
create trigger trg_set_org_customer_site_links
  before insert on public.customer_site_links
  for each row execute function public.set_org_id_from_profile();
