-- FIN-02: quotation line items (material / labor / other)
-- Header amounts are derived from sum(items); frozen quotes reject item mutations.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'quotation_item_kind'
  ) then
    create type public.quotation_item_kind as enum ('material', 'labor', 'other');
  end if;
end $$;

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  line_no integer not null default 1,
  kind public.quotation_item_kind not null default 'other',
  description text not null,
  qty numeric(12,3) not null default 1,
  unit text not null default '式',
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotation_items_qty_nonneg check (qty >= 0),
  constraint quotation_items_unit_price_nonneg check (unit_price >= 0),
  constraint quotation_items_amount_nonneg check (amount >= 0),
  constraint quotation_items_line_unique unique (quotation_id, line_no)
);

create index if not exists quotation_items_quote_idx
  on public.quotation_items (quotation_id, line_no);

alter table public.quotation_items enable row level security;

drop policy if exists "quotation_items_org_all" on public.quotation_items;
create policy "quotation_items_org_all"
  on public.quotation_items for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_quotation_items on public.quotation_items;
create trigger trg_set_org_quotation_items
  before insert on public.quotation_items
  for each row execute function public.set_org_id_from_profile();

create or replace function public.protect_frozen_quotation_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  frozen_flag boolean;
begin
  select q.frozen into frozen_flag
  from public.quotations q
  where q.id = coalesce(new.quotation_id, old.quotation_id);

  if coalesce(frozen_flag, false) then
    raise exception 'published quotation items are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_frozen_quotation_items on public.quotation_items;
create trigger trg_protect_frozen_quotation_items
  before insert or update or delete on public.quotation_items
  for each row execute function public.protect_frozen_quotation_items();

create or replace function public.recalc_quotation_amounts_from_items(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  items_sum numeric(12,2);
  tax_amt numeric(12,2);
  after_amt numeric(12,2);
  rate numeric(8,4);
begin
  select * into q from public.quotations where id = p_quote_id for update;
  if not found then
    return;
  end if;
  if q.frozen or q.status = 'published' then
    return;
  end if;

  select coalesce(sum(amount), 0) into items_sum
  from public.quotation_items
  where quotation_id = p_quote_id;

  rate := coalesce(q.tax_rate, 0.05);
  if q.tax_mode = 'zero' then
    tax_amt := 0;
    after_amt := round(items_sum::numeric, 2);
    rate := 0;
  elsif q.tax_mode = 'exclusive' then
    tax_amt := round((items_sum * rate)::numeric, 2);
    after_amt := round((items_sum + tax_amt)::numeric, 2);
  else
    -- inclusive: items sum is tax-included total
    after_amt := round(items_sum::numeric, 2);
    tax_amt := round((after_amt - after_amt / (1 + rate))::numeric, 2);
  end if;

  update public.quotations
  set
    amount_before_tax = items_sum,
    tax_amount = tax_amt,
    amount_after_tax = after_amt,
    tax_rate = rate
  where id = p_quote_id
    and frozen = false;
end;
$$;

create or replace function public.trg_recalc_quotation_amounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_quotation_amounts_from_items(
    coalesce(new.quotation_id, old.quotation_id)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recalc_quotation_amounts on public.quotation_items;
create trigger trg_recalc_quotation_amounts
  after insert or update or delete on public.quotation_items
  for each row execute function public.trg_recalc_quotation_amounts();
