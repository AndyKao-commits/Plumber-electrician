-- LINE phase 2: attendance + purchase flow types
-- Also allow service-role inserts that already set organization_id
-- (webhook has no auth.uid(); trigger previously overwrote/nullified org).

create or replace function public.set_org_id_from_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_user_org_id();
  end if;
  if new.organization_id is null then
    raise exception '無法決定組織，請確認 profiles 已建立';
  end if;
  return new;
end;
$$;

alter table public.line_flow_drafts
  drop constraint if exists line_flow_drafts_flow_type_check;

alter table public.line_flow_drafts
  add constraint line_flow_drafts_flow_type_check
  check (flow_type in ('photo_upload', 'todos', 'attendance', 'purchase'));

comment on constraint line_flow_drafts_flow_type_check on public.line_flow_drafts is
  'Phase1: photo_upload/todos; Phase2: attendance/purchase';
