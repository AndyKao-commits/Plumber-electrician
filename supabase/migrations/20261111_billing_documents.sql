-- FIN-003: billing milestones + formal billing documents (請款 ≠ 發票 ≠ 收款)

create table if not exists public.billing_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  code text not null,
  title text not null,
  sequence integer not null default 1,
  planned_amount numeric(12,2) not null default 0,
  status text not null default 'planned'
    check (status in ('planned', 'billed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint billing_milestones_code_uidx unique (quotation_id, code)
);

create index if not exists billing_milestones_quote_idx
  on public.billing_milestones (quotation_id, sequence);

create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  milestone_id uuid not null references public.billing_milestones (id),
  document_number text not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'void')),
  tax_mode text not null check (tax_mode in ('exclusive', 'inclusive', 'zero')),
  tax_rate numeric(8,4) not null default 0.05,
  amount_before_tax numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  amount_after_tax numeric(12,2) not null default 0,
  notes text,
  snapshot jsonb,
  issued_at timestamptz,
  issued_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint billing_documents_number_org_uidx unique (organization_id, document_number)
);

-- Only one issued formal document per milestone (FIN-05)
create unique index if not exists billing_documents_issued_milestone_uidx
  on public.billing_documents (milestone_id)
  where status = 'issued';

create index if not exists billing_documents_quote_idx
  on public.billing_documents (quotation_id, updated_at desc);

create table if not exists public.billing_document_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  billing_document_id uuid not null references public.billing_documents (id) on delete cascade,
  line_no integer not null,
  description text not null,
  qty numeric(12,3) not null default 1,
  unit text not null default '式',
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint billing_document_items_line_uidx unique (billing_document_id, line_no)
);

alter table public.billing_milestones enable row level security;
alter table public.billing_documents enable row level security;
alter table public.billing_document_items enable row level security;

drop policy if exists "billing_milestones_org_all" on public.billing_milestones;
create policy "billing_milestones_org_all"
  on public.billing_milestones for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "billing_documents_org_all" on public.billing_documents;
create policy "billing_documents_org_all"
  on public.billing_documents for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "billing_document_items_org_all" on public.billing_document_items;
create policy "billing_document_items_org_all"
  on public.billing_document_items for all to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop trigger if exists trg_set_org_billing_milestones on public.billing_milestones;
create trigger trg_set_org_billing_milestones
  before insert on public.billing_milestones
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_billing_documents on public.billing_documents;
create trigger trg_set_org_billing_documents
  before insert on public.billing_documents
  for each row execute function public.set_org_id_from_profile();

drop trigger if exists trg_set_org_billing_document_items on public.billing_document_items;
create trigger trg_set_org_billing_document_items
  before insert on public.billing_document_items
  for each row execute function public.set_org_id_from_profile();

create or replace function public.assert_billing_parent_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws text;
begin
  select workflow_status into ws from public.quotations where id = new.quotation_id;
  if ws is distinct from 'accepted' then
    raise exception 'billing requires an accepted quotation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assert_billing_milestone_parent on public.billing_milestones;
create trigger trg_assert_billing_milestone_parent
  before insert on public.billing_milestones
  for each row execute function public.assert_billing_parent_accepted();

create or replace function public.protect_issued_billing_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'issued' then
    if new.status = 'void' then
      -- allow voiding issued docs
      return new;
    end if;
    if new.document_number is distinct from old.document_number
      or new.milestone_id is distinct from old.milestone_id
      or new.quotation_id is distinct from old.quotation_id
      or new.amount_after_tax is distinct from old.amount_after_tax
      or new.amount_before_tax is distinct from old.amount_before_tax
      or new.tax_amount is distinct from old.tax_amount
      or new.tax_mode is distinct from old.tax_mode
      or new.snapshot is distinct from old.snapshot
      or new.title is distinct from old.title
    then
      raise exception 'issued billing documents are immutable';
    end if;
  end if;
  if tg_op = 'DELETE' and old.status = 'issued' then
    raise exception 'issued billing documents cannot be deleted';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_protect_issued_billing on public.billing_documents;
create trigger trg_protect_issued_billing
  before update or delete on public.billing_documents
  for each row execute function public.protect_issued_billing_document();

create or replace function public.protect_issued_billing_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  st text;
begin
  select status into st
  from public.billing_documents
  where id = coalesce(new.billing_document_id, old.billing_document_id);
  if st in ('issued', 'void') then
    raise exception 'issued billing document items are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_billing_items on public.billing_document_items;
create trigger trg_protect_billing_items
  before insert or update or delete on public.billing_document_items
  for each row execute function public.protect_issued_billing_items();
