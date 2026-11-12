-- Soft-deleted quotations may drop project_id so closed sites can be hard-deleted.
-- (Re-apply: earlier migration may not have landed on production.)

alter table public.quotations
  drop constraint if exists quotations_project_xor_repair;

alter table public.quotations
  add constraint quotations_project_xor_repair check (
    deleted_at is not null
    or (project_id is not null and repair_case_id is null)
    or (project_id is null and repair_case_id is not null)
  );

alter table public.quotations
  drop constraint if exists quotations_project_id_fkey;

alter table public.quotations
  add constraint quotations_project_id_fkey
  foreign key (project_id) references public.sites (id) on delete set null;

-- Detach any soft-deleted quotes still pointing at sites (unblocks pending deletes).
update public.quotations
set project_id = null
where deleted_at is not null
  and project_id is not null;

notify pgrst, 'reload schema';
