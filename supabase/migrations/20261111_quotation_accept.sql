-- After publish: customer acceptance → counts toward effective contract amount.
-- Boss-only publish remains an app-layer permission; this migration adds accept fields.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'quote_status'
      and e.enumlabel = 'accepted'
  ) then
    alter type public.quote_status add value 'accepted';
  end if;
end $$;

alter table public.quotations
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by uuid references public.profiles (id),
  add column if not exists acceptance_note text;

create index if not exists quotations_accepted_idx
  on public.quotations (organization_id, status)
  where status = 'accepted';
