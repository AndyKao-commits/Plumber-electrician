-- Formal persistence + security hardening (idempotent where possible)
-- Apply on existing Supabase project after review. Does not delete data.

create or replace function public.current_user_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid()
$$;
revoke all on function public.current_user_org_id() from public;
grant execute on function public.current_user_org_id() to authenticated;

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role::text from public.profiles where id = auth.uid()
$$;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

create or replace function public.set_org_id_from_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.organization_id := public.current_user_org_id();
  if new.organization_id is null then
    raise exception '無法決定組織，請確認 profiles 已建立';
  end if;
  return new;
end;
$$;

create or replace function public.protect_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.role is distinct from old.role
     or new.finance_authorized is distinct from old.finance_authorized then
    raise exception 'privileged profile fields cannot be changed by clients';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileged_columns on public.profiles;
create trigger trg_protect_profile_privileged_columns
  before update on public.profiles for each row
  execute function public.protect_profile_privileged_columns();

alter table public.purchases add column if not exists approved_by uuid references public.profiles(id);
alter table public.purchases add column if not exists approved_at timestamptz;
alter table public.purchases add column if not exists rejected_reason text;

alter table public.organizations enable row level security;
drop policy if exists "organizations_member_read" on public.organizations;
create policy "organizations_member_read" on public.organizations for select to authenticated
  using (id = public.current_user_org_id());

revoke update on table public.profiles from authenticated, anon;
grant update (name, email, phone) on table public.profiles to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'sites','attendance','purchases','notices','repair_cases','quotations',
    'emergency_limit_events','materials'
  ]
  loop
    execute format('drop trigger if exists trg_set_org_%s on public.%I', t, t);
    execute format(
      'create trigger trg_set_org_%s before insert on public.%I for each row execute function public.set_org_id_from_profile()',
      t, t
    );
  end loop;
end $$;

drop policy if exists "profiles_read_same_org" on public.profiles;
create policy "profiles_read_same_org" on public.profiles for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid() and organization_id = public.current_user_org_id())
  with check (id = auth.uid() and organization_id = public.current_user_org_id());

drop policy if exists "sites_org_all" on public.sites;
create policy "sites_org_all" on public.sites for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "attendance_read_presence_or_own" on public.attendance;
create policy "attendance_read_presence_or_own" on public.attendance for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "attendance_write_own" on public.attendance;
create policy "attendance_write_own" on public.attendance for insert to authenticated
  with check (user_id = auth.uid() and organization_id = public.current_user_org_id());

drop policy if exists "attendance_update_own" on public.attendance;
create policy "attendance_update_own" on public.attendance for update to authenticated
  using (user_id = auth.uid() and organization_id = public.current_user_org_id())
  with check (user_id = auth.uid() and organization_id = public.current_user_org_id());

drop policy if exists "purchases_org_read" on public.purchases;
create policy "purchases_org_read" on public.purchases for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "purchases_insert_own" on public.purchases;
create policy "purchases_insert_own" on public.purchases for insert to authenticated
  with check (user_id = auth.uid() and organization_id = public.current_user_org_id());

drop policy if exists "purchases_update_approver" on public.purchases;
create policy "purchases_update_approver" on public.purchases for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('boss', 'owner', 'admin')
    )
  )
  with check (organization_id = public.current_user_org_id());

drop policy if exists "notices_own" on public.notices;
create policy "notices_own" on public.notices for all to authenticated
  using (user_id = auth.uid() and organization_id = public.current_user_org_id())
  with check (user_id = auth.uid() and organization_id = public.current_user_org_id());

drop policy if exists "repair_cases_org_all" on public.repair_cases;
create policy "repair_cases_org_all" on public.repair_cases for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "quotations_org_all" on public.quotations;
create policy "quotations_org_all" on public.quotations for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

create or replace function public.protect_frozen_quotation()
returns trigger language plpgsql as $$
begin
  if old.frozen is true then
    if new.tax_mode is distinct from old.tax_mode
       or new.tax_rate is distinct from old.tax_rate
       or new.tax_amount is distinct from old.tax_amount
       or new.amount_before_tax is distinct from old.amount_before_tax
       or new.amount_after_tax is distinct from old.amount_after_tax then
      raise exception 'published quotation tax snapshot is immutable';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_protect_frozen_quotation on public.quotations;
create trigger trg_protect_frozen_quotation
  before update on public.quotations for each row
  execute function public.protect_frozen_quotation();

drop policy if exists "emergency_limit_events_org_read" on public.emergency_limit_events;
create policy "emergency_limit_events_org_read" on public.emergency_limit_events for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "emergency_limit_events_insert_own_or_boss" on public.emergency_limit_events;
create policy "emergency_limit_events_insert_own_or_boss" on public.emergency_limit_events for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and created_by = auth.uid()
    and (
      employee_id = auth.uid()
      or public.current_user_role() in ('boss', 'owner', 'admin')
    )
  );

drop policy if exists "materials_org_all" on public.materials;
create policy "materials_org_all" on public.materials for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

alter table public.materials drop constraint if exists materials_qty_nonnegative;
alter table public.materials add constraint materials_qty_nonnegative check (qty >= 0);
