-- Construction field reports: text and/or linked photo (at least one required in app layer)

create table if not exists public.construction_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '',
  photo_upload_id uuid references public.photo_uploads (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint construction_reports_has_content check (
    length(trim(body)) > 0 or photo_upload_id is not null
  )
);

create index if not exists construction_reports_site_created_idx
  on public.construction_reports (site_id, created_at desc);

create index if not exists construction_reports_org_created_idx
  on public.construction_reports (organization_id, created_at desc);

alter table public.construction_reports enable row level security;

drop policy if exists "construction_reports_select_org" on public.construction_reports;
create policy "construction_reports_select_org"
  on public.construction_reports for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "construction_reports_insert_own" on public.construction_reports;
create policy "construction_reports_insert_own"
  on public.construction_reports for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and author_id = auth.uid()
  );

revoke all on table public.construction_reports from public, anon;
grant select, insert on table public.construction_reports to authenticated;

comment on table public.construction_reports is
  'Field construction reports; text and/or photo_upload_id required';
