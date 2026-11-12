-- Allow soft-deleted member shells to keep history while Auth users are fully removed.
-- Previously profiles.id → auth.users(id) ON DELETE CASCADE blocked Auth cleanup
-- (and would cascade-wipe history if Auth were force-deleted).

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

comment on column public.profiles.id is
  'Same UUID as auth.users when the login still exists; may outlive Auth after soft-delete.';

notify pgrst, 'reload schema';
