-- COM-001: complaints (standalone OK) + related repair cases (associate, never merge).

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  subject text not null,
  detail text,
  status text not null default 'open' check (status in (
    'open', 'investigating', 'escalated', 'resolved', 'closed'
  )),
  site_id uuid references public.sites (id) on delete set null,
  repair_case_id uuid references public.repair_cases (id) on delete set null,
  customer_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id)
);

create index if not exists complaints_org_idx
  on public.complaints (organization_id, created_at desc);

create table if not exists public.related_repair_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  from_repair_case_id uuid not null references public.repair_cases (id) on delete cascade,
  to_repair_case_id uuid not null references public.repair_cases (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint related_repair_cases_distinct check (from_repair_case_id <> to_repair_case_id),
  constraint related_repair_cases_unique unique (from_repair_case_id, to_repair_case_id)
);

create index if not exists related_repair_cases_to_idx
  on public.related_repair_cases (to_repair_case_id);

alter table public.complaints enable row level security;
alter table public.related_repair_cases enable row level security;

drop policy if exists "complaints_org_all" on public.complaints;
create policy "complaints_org_all"
  on public.complaints for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "related_repair_cases_org_all" on public.related_repair_cases;
create policy "related_repair_cases_org_all"
  on public.related_repair_cases for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_complaints on public.complaints;
create trigger trg_set_org_complaints
  before insert on public.complaints
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_related_repair_cases on public.related_repair_cases;
create trigger trg_set_org_related_repair_cases
  before insert on public.related_repair_cases
  for each row execute function public.set_org_id_from_profile();
