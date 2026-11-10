-- FIN-002: change orders (追加／追減). Only accepted ones affect effective contract.

create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  change_number text not null,
  kind text not null check (kind in ('addition', 'reduction')),
  title text not null,
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'sent_to_customer',
        'accepted',
        'rejected',
        'cancelled'
      )
    ),
  tax_mode text not null check (tax_mode in ('exclusive', 'inclusive', 'zero')),
  tax_rate numeric(8,4) not null default 0.05,
  amount_before_tax numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  amount_after_tax numeric(12,2) not null default 0,
  notes text,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint change_orders_number_org_uidx unique (organization_id, change_number)
);

create index if not exists change_orders_quote_idx
  on public.change_orders (quotation_id, updated_at desc);

create index if not exists change_orders_org_status_idx
  on public.change_orders (organization_id, status, updated_at desc);

create table if not exists public.change_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  change_order_id uuid not null references public.change_orders (id) on delete cascade,
  line_no integer not null,
  kind text not null check (kind in ('material', 'labor', 'other')),
  description text not null,
  qty numeric(12,3) not null default 1,
  unit text not null default '式',
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint change_order_items_line_uidx unique (change_order_id, line_no)
);

create index if not exists change_order_items_co_idx
  on public.change_order_items (change_order_id, line_no);

alter table public.change_orders enable row level security;
alter table public.change_order_items enable row level security;

drop policy if exists "change_orders_org_all" on public.change_orders;
create policy "change_orders_org_all"
  on public.change_orders for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "change_order_items_org_all" on public.change_order_items;
create policy "change_order_items_org_all"
  on public.change_order_items for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_change_orders on public.change_orders;
create trigger trg_set_org_change_orders
  before insert on public.change_orders
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_change_order_items on public.change_order_items;
create trigger trg_set_org_change_order_items
  before insert on public.change_order_items
  for each row execute function public.set_org_id_from_profile();

create or replace function public.protect_accepted_change_order_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  st text;
begin
  select status into st
  from public.change_orders
  where id = coalesce(new.change_order_id, old.change_order_id);

  if st in ('accepted', 'cancelled') then
    raise exception 'accepted or cancelled change order items are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_change_order_items on public.change_order_items;
create trigger trg_protect_change_order_items
  before insert or update or delete on public.change_order_items
  for each row execute function public.protect_accepted_change_order_items();

create or replace function public.recalc_change_order_amounts(p_co_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  items_sum numeric(12,2);
  discount_amt numeric(12,2);
  taxable numeric(12,2);
  tax_amt numeric(12,2);
  after_amt numeric(12,2);
  rate numeric(8,4);
begin
  select * into c from public.change_orders where id = p_co_id for update;
  if not found then
    return;
  end if;
  if c.status in ('accepted', 'cancelled') then
    return;
  end if;

  select coalesce(sum(amount), 0) into items_sum
  from public.change_order_items
  where change_order_id = p_co_id;

  discount_amt := coalesce(c.discount, 0);
  if discount_amt < 0 then discount_amt := 0; end if;
  taxable := greatest(items_sum - discount_amt, 0);

  rate := coalesce(c.tax_rate, 0.05);
  if c.tax_mode = 'zero' then
    tax_amt := 0;
    after_amt := round(taxable::numeric, 2);
    rate := 0;
  elsif c.tax_mode = 'exclusive' then
    tax_amt := round((taxable * rate)::numeric, 2);
    after_amt := round((taxable + tax_amt)::numeric, 2);
  else
    after_amt := round(taxable::numeric, 2);
    tax_amt := round((after_amt - after_amt / (1 + rate))::numeric, 2);
  end if;

  update public.change_orders
  set
    amount_before_tax = items_sum,
    tax_amount = tax_amt,
    amount_after_tax = after_amt,
    tax_rate = rate,
    updated_at = now()
  where id = p_co_id;
end;
$$;

create or replace function public.trg_recalc_change_order_amounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_change_order_amounts(
    coalesce(new.change_order_id, old.change_order_id)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recalc_co_on_items on public.change_order_items;
create trigger trg_recalc_co_on_items
  after insert or update or delete on public.change_order_items
  for each row execute function public.trg_recalc_change_order_amounts();

-- Parent quote must be accepted before creating change orders (app enforces;
-- DB soft-check via trigger for inserts)
create or replace function public.assert_change_order_parent_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws text;
begin
  if tg_op = 'INSERT' then
    select workflow_status into ws
    from public.quotations
    where id = new.quotation_id;
    if ws is distinct from 'accepted' then
      raise exception 'change orders require an accepted quotation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assert_co_parent_accepted on public.change_orders;
create trigger trg_assert_co_parent_accepted
  before insert on public.change_orders
  for each row execute function public.assert_change_order_parent_accepted();
