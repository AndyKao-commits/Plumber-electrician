-- Location footprints (到點打卡／足跡) + allow LINE flow_type=location

alter table public.line_flow_drafts
  drop constraint if exists line_flow_drafts_flow_type_check;

alter table public.line_flow_drafts
  add constraint line_flow_drafts_flow_type_check
  check (
    flow_type in (
      'photo_upload',
      'todos',
      'attendance',
      'purchase',
      'location'
    )
  );

comment on constraint line_flow_drafts_flow_type_check on public.line_flow_drafts is
  'photo/todos/attendance/purchase + location footprints';

create table if not exists public.location_checkins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  source text not null default 'manual'
    check (source in ('manual', 'line_location', 'line_site')),
  site_id uuid references public.sites (id) on delete set null,
  label text,
  address text,
  latitude double precision,
  longitude double precision,
  note text,
  attendance_id uuid references public.attendance (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint location_checkins_has_place check (
    site_id is not null
    or (latitude is not null and longitude is not null)
    or (address is not null and length(trim(address)) > 0)
    or (label is not null and length(trim(label)) > 0)
  )
);

create index if not exists location_checkins_user_recorded_idx
  on public.location_checkins (user_id, recorded_at desc);

create index if not exists location_checkins_org_recorded_idx
  on public.location_checkins (organization_id, recorded_at desc);

alter table public.location_checkins enable row level security;

drop policy if exists "location_checkins_select_own_or_boss" on public.location_checkins;
create policy "location_checkins_select_own_or_boss"
  on public.location_checkins for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.organization_id = public.current_user_org_id()
          and p.role::text in ('boss', 'owner', 'admin')
      )
    )
  );

drop policy if exists "location_checkins_insert_own" on public.location_checkins;
create policy "location_checkins_insert_own"
  on public.location_checkins for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and user_id = auth.uid()
  );

drop policy if exists "location_checkins_update_boss" on public.location_checkins;
create policy "location_checkins_update_boss"
  on public.location_checkins for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = public.current_user_org_id()
        and p.role::text in ('boss', 'owner', 'admin')
    )
  )
  with check (organization_id = public.current_user_org_id());

revoke all on table public.location_checkins from public, anon;
grant select, insert, update on table public.location_checkins to authenticated;

drop trigger if exists trg_set_org_location_checkins on public.location_checkins;
create trigger trg_set_org_location_checkins
  before insert on public.location_checkins
  for each row execute function public.set_org_id_from_profile();

comment on table public.location_checkins is
  '到點打卡／足跡：使用者主動紀錄時間與位置；不影響薪資與上下班狀態';
