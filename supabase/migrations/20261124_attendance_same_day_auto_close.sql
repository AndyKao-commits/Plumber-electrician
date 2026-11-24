-- Attendance shifts are limited to their clock-in calendar day in Asia/Taipei.
-- Open shifts are closed at 23:59:59 and a cron job handles the midnight rollover.

create or replace function public.attendance_day_end(p_clock_in_at timestamptz)
returns timestamptz
language sql
immutable
strict
set search_path = public
as $$
  select (
    (
      (p_clock_in_at at time zone 'Asia/Taipei')::date
      + interval '1 day'
      - interval '1 second'
    ) at time zone 'Asia/Taipei'
  )
$$;

revoke all on function public.attendance_day_end(timestamptz) from public;
grant execute on function public.attendance_day_end(timestamptz)
  to authenticated, service_role;

create or replace function public.enforce_attendance_same_day()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_day_end timestamptz := public.attendance_day_end(new.clock_in_at);
begin
  if new.clock_out_at is not null and new.clock_out_at > v_day_end then
    new.clock_out_at := v_day_end;
  end if;

  if new.status = 'clocked_in'
     and (new.clock_in_at at time zone 'Asia/Taipei')::date
         < (now() at time zone 'Asia/Taipei')::date then
    new.status := 'clocked_out';
    new.clock_out_at := v_day_end;
    new.note := trim(coalesce(new.note, '') || ' [跨日自動下班]');
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_attendance_same_day() from public;

drop trigger if exists trg_attendance_same_day on public.attendance;
create trigger trg_attendance_same_day
  before insert or update of status, clock_in_at, clock_out_at
  on public.attendance
  for each row execute function public.enforce_attendance_same_day();

-- Repair existing cross-day and forgotten open shifts before adding the guard.
update public.attendance
set status = 'clocked_out',
    clock_out_at = public.attendance_day_end(clock_in_at),
    note = case
      when status = 'clocked_in'
        then trim(coalesce(note, '') || ' [跨日自動下班]')
      else note
    end
where (
    status = 'clocked_in'
    and (clock_in_at at time zone 'Asia/Taipei')::date
        < (now() at time zone 'Asia/Taipei')::date
  )
  or clock_out_at > public.attendance_day_end(clock_in_at);

alter table public.attendance
  drop constraint if exists attendance_same_day_check;

alter table public.attendance
  add constraint attendance_same_day_check
  check (
    clock_out_at is null
    or clock_out_at <= public.attendance_day_end(clock_in_at)
  );

create or replace function public.auto_close_expired_attendance(
  p_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_user uuid;
  v_closed integer := 0;
begin
  -- Signed-in users may only close their own stale shift. Service jobs and the
  -- LINE webhook may target one user; the scheduled postgres job closes all.
  if auth.role() = 'authenticated' then
    v_target_user := auth.uid();
  else
    v_target_user := p_user_id;
  end if;

  update public.attendance
  set status = 'clocked_out',
      clock_out_at = public.attendance_day_end(clock_in_at),
      note = trim(coalesce(note, '') || ' [跨日自動下班]')
  where status = 'clocked_in'
    and (clock_in_at at time zone 'Asia/Taipei')::date
        < (now() at time zone 'Asia/Taipei')::date
    and (v_target_user is null or user_id = v_target_user);

  get diagnostics v_closed = row_count;
  return v_closed;
end;
$$;

revoke all on function public.auto_close_expired_attendance(uuid) from public;
grant execute on function public.auto_close_expired_attendance(uuid)
  to authenticated, service_role;

comment on function public.auto_close_expired_attendance(uuid) is
  'Close stale attendance shifts at 23:59:59 of their Asia/Taipei clock-in day.';

-- Supabase provides pg_cron. Run at midnight Asia/Taipei (16:00 UTC) so team
-- presence is corrected even when nobody opens the app.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'attendance-auto-close-taipei';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'attendance-auto-close-taipei',
    '0 16 * * *',
    'select public.auto_close_expired_attendance(null);'
  );
end;
$$;

notify pgrst, 'reload schema';
