-- Allow users to update V1 profile columns (column-level GRANT was missing).
-- Add web_gps as location_checkins source for LINE → website GPS flow.

revoke update on table public.profiles from authenticated, anon;
grant update (
  name,
  email,
  phone,
  line_user_id,
  nickname,
  birth_date,
  job_title,
  hired_at,
  account_status,
  profile_notes
) on table public.profiles to authenticated;

alter table public.location_checkins
  drop constraint if exists location_checkins_source_check;

alter table public.location_checkins
  add constraint location_checkins_source_check
  check (source in ('manual', 'line_location', 'line_site', 'web_gps'));

comment on constraint location_checkins_source_check on public.location_checkins is
  'manual / LINE location or site / website GPS from LINE share button';
