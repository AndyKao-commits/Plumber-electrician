-- Attendance site picks create footprint rows (source=attendance_site).

alter table public.location_checkins
  drop constraint if exists location_checkins_source_check;

alter table public.location_checkins
  add constraint location_checkins_source_check
  check (
    source in (
      'manual',
      'line_location',
      'line_site',
      'web_gps',
      'attendance_site'
    )
  );

comment on constraint location_checkins_source_check on public.location_checkins is
  'manual / LINE location / LINE site / web GPS / attendance site visit';
