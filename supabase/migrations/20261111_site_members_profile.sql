-- Employee authorized sites + profile field guards for V1.0.

create table if not exists public.site_members (
  organization_id uuid not null references public.organizations (id),
  site_id uuid not null references public.sites (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  primary key (site_id, user_id)
);

create index if not exists site_members_user_idx
  on public.site_members (organization_id, user_id);

comment on table public.site_members is
  'Employees only see sites they are assigned to; boss/owner/admin see all.';

alter table public.site_members enable row level security;

drop policy if exists "site_members_org_select" on public.site_members;
create policy "site_members_org_select"
  on public.site_members for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "site_members_boss_write" on public.site_members;
create policy "site_members_boss_write"
  on public.site_members for all to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner', 'admin')
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner', 'admin')
  );

drop trigger if exists trg_set_org_site_members on public.site_members;
create trigger trg_set_org_site_members
  before insert on public.site_members
  for each row execute function public.set_org_id_from_profile();

-- Boss may update teammate profiles (account_status etc.); privileged role/finance still blocked by trigger.
drop policy if exists "profiles_boss_update" on public.profiles;
create policy "profiles_boss_update"
  on public.profiles for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner')
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner')
  );

alter table public.profiles
  drop constraint if exists profiles_account_status_check;
alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'disabled'));
