-- Quote cases: case-centric workflow, export versions (immutable snapshots).
-- Avoid enum ADD VALUE + immediate use (55P04): use text workflow_status.

alter table public.quotations
  add column if not exists quote_number text,
  add column if not exists workflow_status text,
  add column if not exists customer_name text,
  add column if not exists site_address text,
  add column if not exists discount numeric(12,2) not null default 0,
  add column if not exists notes text,
  add column if not exists payment_terms text,
  add column if not exists valid_until date,
  add column if not exists current_version integer not null default 0,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_exported_at timestamptz;

-- Backfill workflow from legacy status
update public.quotations
set workflow_status = case
  when status::text = 'published' then 'exported'
  when status::text = 'void' then 'cancelled'
  else 'editing'
end
where workflow_status is null;

update public.quotations
set quote_number = 'Q-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where quote_number is null;

update public.quotations q
set customer_name = coalesce(
  q.customer_name,
  (select r.customer_name from public.repair_cases r where r.id = q.repair_case_id),
  (select s.customer_name from public.sites s where s.id = q.project_id),
  ''
)
where q.customer_name is null;

update public.quotations q
set site_address = coalesce(
  q.site_address,
  (select s.address from public.sites s where s.id = q.project_id),
  (select s.address from public.sites s
     join public.repair_cases r on r.site_id = s.id
    where r.id = q.repair_case_id),
  ''
)
where q.site_address is null;

alter table public.quotations
  alter column workflow_status set default 'editing';

alter table public.quotations
  alter column workflow_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'quotations_workflow_status_check'
  ) then
    alter table public.quotations
      add constraint quotations_workflow_status_check
      check (
        workflow_status in (
          'editing',
          'exported',
          'sent_to_customer',
          'accepted',
          'rejected',
          'cancelled'
        )
      );
  end if;
end $$;

create unique index if not exists quotations_quote_number_org_uidx
  on public.quotations (organization_id, quote_number);

create index if not exists quotations_org_workflow_idx
  on public.quotations (organization_id, workflow_status, updated_at desc);

-- Immutable export snapshots
create table if not exists public.quotation_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  version_no integer not null,
  quote_number text not null,
  snapshot jsonb not null,
  exported_at timestamptz not null default now(),
  exported_by uuid references public.profiles (id),
  export_format text not null default 'snapshot'
    check (export_format in ('snapshot', 'pdf', 'csv', 'print')),
  constraint quotation_versions_unique unique (quotation_id, version_no)
);

create index if not exists quotation_versions_quote_idx
  on public.quotation_versions (quotation_id, version_no desc);

alter table public.quotation_versions enable row level security;

drop policy if exists "quotation_versions_org_all" on public.quotation_versions;
create policy "quotation_versions_org_all"
  on public.quotation_versions for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_quotation_versions on public.quotation_versions;
create trigger trg_set_org_quotation_versions
  before insert on public.quotation_versions
  for each row execute function public.set_org_id_from_profile();

-- Versions are immutable
create or replace function public.protect_quotation_version_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'quotation versions are immutable';
end;
$$;

drop trigger if exists trg_protect_quotation_version on public.quotation_versions;
create trigger trg_protect_quotation_version
  before update or delete on public.quotation_versions
  for each row execute function public.protect_quotation_version_immutable();

-- Live quote items: block only when accepted / cancelled (not “frozen publish”)
create or replace function public.protect_frozen_quotation_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws text;
begin
  select coalesce(q.workflow_status, 'editing') into ws
  from public.quotations q
  where q.id = coalesce(new.quotation_id, old.quotation_id);

  if ws in ('accepted', 'cancelled') then
    raise exception 'accepted or cancelled quotation items are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Touch updated_at on quotation header changes
create or replace function public.touch_quotation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_quotation_updated_at on public.quotations;
create trigger trg_touch_quotation_updated_at
  before update on public.quotations
  for each row execute function public.touch_quotation_updated_at();

-- Recalc still includes discount on header (subtotal from items − discount + tax)
create or replace function public.recalc_quotation_amounts_from_items(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  items_sum numeric(12,2);
  discount_amt numeric(12,2);
  taxable numeric(12,2);
  tax_amt numeric(12,2);
  after_amt numeric(12,2);
  rate numeric(8,4);
begin
  select * into q from public.quotations where id = p_quote_id for update;
  if not found then
    return;
  end if;
  if coalesce(q.workflow_status, 'editing') in ('accepted', 'cancelled') then
    return;
  end if;

  select coalesce(sum(amount), 0) into items_sum
  from public.quotation_items
  where quotation_id = p_quote_id;

  discount_amt := coalesce(q.discount, 0);
  if discount_amt < 0 then discount_amt := 0; end if;
  taxable := greatest(items_sum - discount_amt, 0);

  rate := coalesce(q.tax_rate, 0.05);
  if q.tax_mode = 'zero' then
    tax_amt := 0;
    after_amt := round(taxable::numeric, 2);
    rate := 0;
  elsif q.tax_mode = 'exclusive' then
    tax_amt := round((taxable * rate)::numeric, 2);
    after_amt := round((taxable + tax_amt)::numeric, 2);
  else
    after_amt := round(taxable::numeric, 2);
    tax_amt := round((after_amt - after_amt / (1 + rate))::numeric, 2);
  end if;

  update public.quotations
  set
    amount_before_tax = items_sum,
    tax_amount = tax_amt,
    amount_after_tax = after_amt,
    tax_rate = rate,
    updated_at = now()
  where id = p_quote_id;
end;
$$;
