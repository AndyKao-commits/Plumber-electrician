-- Make access_template = 'owner' a true owner-equivalent authorization role.
-- The original profiles.role = 'boss' account remains protected from deletion/demotion.
-- Business self-approval prohibitions remain enforced separately.

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when role::text in ('boss', 'owner') then 'boss'
    when coalesce(access_template, '') = 'owner' then 'boss'
    when coalesce(access_template, '') = 'admin' then 'admin'
    when coalesce(access_template, '') = 'member' then 'member'
    else role::text
  end
  from public.profiles
  where id = auth.uid()
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

comment on function public.current_user_role() is
  'Effective authorization role. Delegated owner template resolves to boss while the stored profile role remains employee.';

-- These two older policy families inspected profiles.role directly, so make
-- them use the effective role helper as well.
drop policy if exists "attendance_corrections_select_own_or_approver"
  on public.attendance_corrections;
create policy "attendance_corrections_select_own_or_approver"
  on public.attendance_corrections for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('boss', 'owner', 'admin')
    )
  );

drop policy if exists "attendance_corrections_update_approver"
  on public.attendance_corrections;
create policy "attendance_corrections_update_approver"
  on public.attendance_corrections for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner', 'admin')
  )
  with check (organization_id = public.current_user_org_id());

drop policy if exists "location_checkins_select_own_or_boss"
  on public.location_checkins;
create policy "location_checkins_select_own_or_boss"
  on public.location_checkins for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('boss', 'owner', 'admin')
    )
  );

drop policy if exists "location_checkins_update_boss"
  on public.location_checkins;
create policy "location_checkins_update_boss"
  on public.location_checkins for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner', 'admin')
  )
  with check (organization_id = public.current_user_org_id());

-- Delegated owners must also receive approval notifications.
create or replace function public.list_approver_ids(
  p_exclude_self boolean default true
)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(p.id), array[]::uuid[])
  from public.profiles p
  where p.organization_id = public.current_user_org_id()
    and (
      p.role::text in ('boss', 'owner', 'admin')
      or coalesce(p.access_template, '') = 'owner'
    )
    and (not p_exclude_self or p.id is distinct from auth.uid());
$$;

revoke all on function public.list_approver_ids(boolean) from public;
grant execute on function public.list_approver_ids(boolean) to authenticated;

create or replace function public.create_notices_for_roles(
  p_roles text[],
  p_kind text,
  p_title text,
  p_detail text default '',
  p_href text default null,
  p_as_todo boolean default true,
  p_exclude_self boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_ids uuid[];
begin
  if v_org is null then
    raise exception '無法決定組織';
  end if;

  select coalesce(array_agg(p.id), array[]::uuid[])
    into v_ids
  from public.profiles p
  where p.organization_id = v_org
    and (
      p.role::text = any (p_roles)
      or (
        coalesce(p.access_template, '') = 'owner'
        and (
          'boss' = any (p_roles)
          or 'owner' = any (p_roles)
        )
      )
    )
    and (not p_exclude_self or p.id is distinct from auth.uid());

  return public.create_org_notices(
    v_ids,
    p_kind,
    p_title,
    p_detail,
    p_href,
    p_as_todo
  );
end;
$$;

revoke all on function public.create_notices_for_roles(
  text[], text, text, text, text, boolean, boolean
) from public;
grant execute on function public.create_notices_for_roles(
  text[], text, text, text, text, boolean, boolean
) to authenticated;

-- Database enforcement for approval transitions. UI checks are not a
-- security boundary: Owner may self-approve, Admin may approve others only.
create or replace function public.protect_purchase_approval_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
begin
  if new.organization_id is distinct from old.organization_id
     or new.user_id is distinct from old.user_id then
    raise exception 'purchase ownership fields are immutable';
  end if;

  if new.status is distinct from old.status
     and new.status::text in ('approved', 'rejected') then
    if v_role not in ('boss', 'owner', 'admin') then
      raise exception '無權核准此採購';
    end if;
    if new.user_id = auth.uid() and v_role not in ('boss', 'owner') then
      raise exception '只有老闆身分可以自行核准自己的採購';
    end if;
    if new.approved_by is distinct from auth.uid() or new.approved_at is null then
      raise exception '核准人與核准時間不完整';
    end if;
  end if;

  if (
    new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
    or new.rejected_reason is distinct from old.rejected_reason
  ) and v_role not in ('boss', 'owner', 'admin') then
    raise exception '無權變更採購核准欄位';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_purchase_approval_transition() from public;

drop trigger if exists trg_protect_purchase_approval_transition on public.purchases;
create trigger trg_protect_purchase_approval_transition
  before update on public.purchases
  for each row execute function public.protect_purchase_approval_transition();

-- Owner/Admin may update another employee's attendance after approving a
-- correction. Owner may also approve their own correction.
drop policy if exists "attendance_update_own" on public.attendance;
create policy "attendance_update_own"
  on public.attendance for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('boss', 'owner', 'admin')
    )
  )
  with check (
    organization_id = public.current_user_org_id()
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('boss', 'owner', 'admin')
    )
  );

create or replace function public.protect_attendance_correction_review()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
begin
  if new.organization_id is distinct from old.organization_id
     or new.user_id is distinct from old.user_id then
    raise exception 'attendance correction ownership fields are immutable';
  end if;

  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected') then
    if v_role not in ('boss', 'owner', 'admin') then
      raise exception '無權核准補打卡';
    end if;
    if new.user_id = auth.uid() and v_role not in ('boss', 'owner') then
      raise exception '只有老闆身分可以自行核准自己的補打卡';
    end if;
    if new.reviewed_by is distinct from auth.uid() or new.reviewed_at is null then
      raise exception '補打卡核准人與時間不完整';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_attendance_correction_review() from public;

drop trigger if exists trg_protect_attendance_correction_review
  on public.attendance_corrections;
create trigger trg_protect_attendance_correction_review
  before update on public.attendance_corrections
  for each row execute function public.protect_attendance_correction_review();

-- Quote security: members may edit drafts, but formal export, customer-state
-- changes and soft deletion require Owner/Admin.
create or replace function public.protect_quotation_privileged_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_manager boolean := v_role in ('boss', 'owner', 'admin');
begin
  if new.organization_id is distinct from old.organization_id
     or new.created_by is distinct from old.created_by then
    raise exception 'quotation ownership fields are immutable';
  end if;

  if new.workflow_status is distinct from old.workflow_status
     and new.workflow_status in (
       'exported',
       'sent_to_customer',
       'accepted',
       'rejected',
       'cancelled'
     )
     and not v_manager then
    raise exception '無權變更正式報價狀態';
  end if;

  if new.status is distinct from old.status
     and new.status::text <> 'draft'
     and not v_manager then
    raise exception '無權發布正式報價';
  end if;

  if (
    new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by
    or new.delete_reason is distinct from old.delete_reason
  ) then
    if not v_manager then
      raise exception '無權刪除報價';
    end if;
    if new.deleted_at is not null and new.deleted_by is distinct from auth.uid() then
      raise exception '報價刪除者必須是目前使用者';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_quotation_privileged_transition() from public;

drop trigger if exists trg_protect_quotation_privileged_transition
  on public.quotations;
create trigger trg_protect_quotation_privileged_transition
  before update on public.quotations
  for each row execute function public.protect_quotation_privileged_transition();

drop policy if exists "quotation_versions_org_all" on public.quotation_versions;

drop policy if exists "quotation_versions_org_select"
  on public.quotation_versions;
create policy "quotation_versions_org_select"
  on public.quotation_versions for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "quotation_versions_manager_insert"
  on public.quotation_versions;
create policy "quotation_versions_manager_insert"
  on public.quotation_versions for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner', 'admin')
    and exported_by = auth.uid()
  );

drop policy if exists "quotation_versions_manager_update"
  on public.quotation_versions;
create policy "quotation_versions_manager_update"
  on public.quotation_versions for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner', 'admin')
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner', 'admin')
  );

create or replace function public.authorize_quotation_version_soft_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
    new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by
    or new.delete_reason is distinct from old.delete_reason
  ) then
    if public.current_user_role() not in ('boss', 'owner', 'admin') then
      raise exception '無權刪除報價版本';
    end if;
    if new.deleted_at is not null and new.deleted_by is distinct from auth.uid() then
      raise exception '報價版本刪除者必須是目前使用者';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.authorize_quotation_version_soft_delete() from public;

drop trigger if exists trg_authorize_quotation_version_soft_delete
  on public.quotation_versions;
create trigger trg_authorize_quotation_version_soft_delete
  before update on public.quotation_versions
  for each row execute function public.authorize_quotation_version_soft_delete();

notify pgrst, 'reload schema';
