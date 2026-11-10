-- Soft-delete for quotation cases and export versions (audit retained).

alter table public.quotations
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id),
  add column if not exists delete_reason text,
  add column if not exists customer_phone text,
  add column if not exists construction_notes text;

alter table public.quotation_versions
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id),
  add column if not exists delete_reason text;

create index if not exists quotations_not_deleted_idx
  on public.quotations (organization_id, updated_at desc)
  where deleted_at is null;

create index if not exists quotation_versions_not_deleted_idx
  on public.quotation_versions (quotation_id, version_no desc)
  where deleted_at is null;

-- Allow soft-delete updates on versions; still block hard delete / content rewrite
create or replace function public.protect_quotation_version_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'quotation versions cannot be hard-deleted';
  end if;

  -- Soft delete only: set deleted_* while keeping snapshot immutable
  if tg_op = 'UPDATE' then
    if new.snapshot is distinct from old.snapshot
      or new.version_no is distinct from old.version_no
      or new.quote_number is distinct from old.quote_number
      or new.quotation_id is distinct from old.quotation_id
      or new.organization_id is distinct from old.organization_id
      or new.exported_at is distinct from old.exported_at
      or new.exported_by is distinct from old.exported_by
      or new.export_format is distinct from old.export_format
    then
      raise exception 'quotation version content is immutable';
    end if;
    -- allow deleted_at / deleted_by / delete_reason changes
    return new;
  end if;

  return new;
end;
$$;
