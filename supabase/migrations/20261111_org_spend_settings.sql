-- Boss-configurable spend limits: daily purchase, emergency caps, petty-cash review threshold.

create table if not exists public.org_spend_settings (
  organization_id uuid primary key references public.organizations (id),
  report_review_threshold_ntd numeric(14,2) not null default 3000
    check (report_review_threshold_ntd >= 0),
  emergency_single_limit_ntd numeric(14,2) not null default 5000
    check (emergency_single_limit_ntd > 0),
  emergency_daily_limit_ntd numeric(14,2) not null default 10000
    check (emergency_daily_limit_ntd > 0),
  daily_purchase_limit_ntd numeric(14,2) not null default 0
    check (daily_purchase_limit_ntd >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  constraint org_spend_settings_emergency_daily_ge_single
    check (emergency_daily_limit_ntd >= emergency_single_limit_ntd)
);

comment on table public.org_spend_settings is
  'Org spend limits: daily purchase, emergency single/daily, report review threshold (petty cash).';
comment on column public.org_spend_settings.report_review_threshold_ntd is
  'Field expense / petty cash amounts at or above this need boss review.';
comment on column public.org_spend_settings.daily_purchase_limit_ntd is
  'Per-person daily purchase sum cap; 0 = unlimited.';

alter table public.org_spend_settings enable row level security;

drop policy if exists "org_spend_settings_org_select" on public.org_spend_settings;
create policy "org_spend_settings_org_select"
  on public.org_spend_settings for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "org_spend_settings_boss_write" on public.org_spend_settings;
create policy "org_spend_settings_boss_write"
  on public.org_spend_settings for all to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner')
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('boss', 'owner')
  );
