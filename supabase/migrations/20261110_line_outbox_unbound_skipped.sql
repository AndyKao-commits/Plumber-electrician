-- When recipient has no line_user_id, still write an outbox row as skipped
-- so operators can see "notify attempted but no LINE bind" without guessing.

create or replace function public.enqueue_line_notifications(
  p_recipient_ids uuid[],
  p_event_type text,
  p_title text,
  p_body text default '',
  p_href text default null,
  p_payload jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_uid uuid;
  v_line text;
  v_count integer := 0;
begin
  if v_org is null then
    raise exception '無法決定組織';
  end if;
  if p_recipient_ids is null then
    return 0;
  end if;

  foreach v_uid in array p_recipient_ids loop
    if not exists (
      select 1 from public.profiles p
      where p.id = v_uid and p.organization_id = v_org
    ) then
      continue;
    end if;

    select p.line_user_id into v_line
    from public.profiles p
    where p.id = v_uid and p.organization_id = v_org;

    if v_line is not null and length(trim(v_line)) > 0 then
      insert into public.notification_outbox (
        organization_id, event_type, recipient_profile_id, line_user_id,
        title, body, href, payload, status, error, processed_at
      ) values (
        v_org, p_event_type, v_uid, trim(v_line),
        p_title, coalesce(p_body, ''), p_href, coalesce(p_payload, '{}'::jsonb),
        'pending', null, null
      );
    else
      insert into public.notification_outbox (
        organization_id, event_type, recipient_profile_id, line_user_id,
        title, body, href, payload, status, error, processed_at
      ) values (
        v_org, p_event_type, v_uid, null,
        p_title, coalesce(p_body, ''), p_href, coalesce(p_payload, '{}'::jsonb),
        'skipped', 'missing line_user_id', now()
      );
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enqueue_line_notifications(uuid[], text, text, text, text, jsonb) from public;
grant execute on function public.enqueue_line_notifications(uuid[], text, text, text, text, jsonb) to authenticated;
