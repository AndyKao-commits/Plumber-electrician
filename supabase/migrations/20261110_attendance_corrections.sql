-- FIELD-004: attendance corrections — keep original punches; approve to set effective hours

create table if not exists public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attendance_id uuid references public.attendance (id) on delete set null,
  proposed_clock_in_at timestamptz not null,
  proposed_clock_out_at timestamptz,
  proposed_site_id uuid references public.sites (id) on delete set null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  -- Original snapshot (never mutated after insert)
  original_clock_in_at timestamptz,
  original_clock_out_at timestamptz,
  original_site_id uuid,
  -- Effective hours after approval (derived; originals untouched)
  effective_clock_in_at timestamptz,
  effective_clock_out_at timestamptz,
  effective_site_id uuid,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint attendance_corrections_reason_len check (length(trim(reason)) >= 2),
  constraint attendance_corrections_times check (
    proposed_clock_out_at is null
    or proposed_clock_out_at >= proposed_clock_in_at
  )
);

create index if not exists attendance_corrections_user_created_idx
  on public.attendance_corrections (user_id, created_at desc);

create index if not exists attendance_corrections_org_status_idx
  on public.attendance_corrections (organization_id, status, created_at desc);

alter table public.attendance_corrections enable row level security;

drop policy if exists "attendance_corrections_select_own_or_approver" on public.attendance_corrections;
create policy "attendance_corrections_select_own_or_approver"
  on public.attendance_corrections for select to authenticated
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

drop policy if exists "attendance_corrections_insert_own" on public.attendance_corrections;
create policy "attendance_corrections_insert_own"
  on public.attendance_corrections for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and user_id = auth.uid()
  );

-- Updates (approve/reject) via security definer RPC preferred; also allow approver update
drop policy if exists "attendance_corrections_update_approver" on public.attendance_corrections;
create policy "attendance_corrections_update_approver"
  on public.attendance_corrections for update to authenticated
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

revoke all on table public.attendance_corrections from public, anon;
grant select, insert, update on table public.attendance_corrections to authenticated;

drop trigger if exists trg_set_org_attendance_corrections on public.attendance_corrections;
create trigger trg_set_org_attendance_corrections
  before insert on public.attendance_corrections
  for each row execute function public.set_org_id_from_profile();

comment on table public.attendance_corrections is
  '補打卡：保留原始出勤列；核准後只寫 effective_* 於本表';
