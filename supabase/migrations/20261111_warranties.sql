-- WAR-001: warranties + human assessments (never auto-free by calendar).

create table if not exists public.warranties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  title text not null,
  site_id uuid references public.sites (id) on delete set null,
  repair_case_id uuid references public.repair_cases (id) on delete set null,
  starts_on date,
  ends_on date,
  scope_notes text,
  exclusion_notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id)
);

create index if not exists warranties_org_idx
  on public.warranties (organization_id, created_at desc);

create table if not exists public.warranty_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  repair_case_id uuid not null references public.repair_cases (id) on delete cascade,
  warranty_id uuid references public.warranties (id) on delete set null,
  classification text not null check (classification in (
    'covered', 'partial', 'excluded', 'out_of_period', 'not_warranty'
  )),
  rationale text not null,
  assessed_at timestamptz not null default now(),
  assessed_by uuid not null references public.profiles (id),
  assessed_by_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists warranty_assessments_case_idx
  on public.warranty_assessments (repair_case_id, assessed_at desc);

alter table public.warranties enable row level security;
alter table public.warranty_assessments enable row level security;

drop policy if exists "warranties_org_all" on public.warranties;
create policy "warranties_org_all"
  on public.warranties for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "warranty_assessments_org_all" on public.warranty_assessments;
create policy "warranty_assessments_org_all"
  on public.warranty_assessments for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_warranties on public.warranties;
create trigger trg_set_org_warranties
  before insert on public.warranties
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_warranty_assessments on public.warranty_assessments;
create trigger trg_set_org_warranty_assessments
  before insert on public.warranty_assessments
  for each row execute function public.set_org_id_from_profile();
