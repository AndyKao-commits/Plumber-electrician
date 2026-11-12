-- Soft-deleted accounts: rename for clarity; keep history FKs.
-- Also refresh admin_purge_member_profile soft-delete naming.

create or replace function public.admin_purge_member_profile(
  p_target_id uuid,
  p_confirm_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_confirm text := trim(coalesce(p_confirm_name, ''));
  v_features jsonb;
  v_overrides jsonb;
  v_allowed boolean := false;
  v_mode text;
  v_deleted_name text;
begin
  if v_uid is null then
    raise exception '尚未登入';
  end if;
  if p_target_id is null then
    raise exception '缺少目標帳號';
  end if;
  if v_confirm = '' then
    raise exception '請填寫被刪除者姓名以確認';
  end if;

  select * into v_actor from public.profiles where id = v_uid;
  if not found then
    raise exception '找不到管理者資料';
  end if;

  v_features := coalesce(v_actor.features, '{}'::jsonb);
  v_overrides := coalesce(v_actor.permission_overrides, '{}'::jsonb);
  if v_actor.role::text in ('boss', 'owner') then
    v_allowed := true;
  elsif (v_overrides ? 'account') and (v_overrides->>'account')::boolean is true then
    v_allowed := true;
  elsif (v_overrides ? 'account') and (v_overrides->>'account')::boolean is false then
    v_allowed := false;
  elsif (v_features ? 'account') and (v_features->>'account')::boolean is true then
    v_allowed := true;
  end if;
  if not v_allowed then
    raise exception '無權使用帳號管理';
  end if;

  select * into v_target from public.profiles where id = p_target_id;
  if not found then
    raise exception '找不到要刪除的帳號';
  end if;
  if v_target.organization_id is distinct from v_actor.organization_id then
    raise exception '不可刪除其他公司的帳號';
  end if;
  if v_target.id = v_actor.id then
    raise exception '不可刪除自己的帳號';
  end if;
  if v_target.role::text in ('boss', 'owner') then
    raise exception '不可刪除老闆帳號';
  end if;
  if v_confirm is distinct from trim(v_target.name) then
    raise exception '姓名不符，請輸入被刪除者正確姓名';
  end if;

  perform set_config('app.allow_privileged_profile_update', 'on', true);

  begin
    delete from public.profiles where id = v_target.id;
    v_mode := 'hard';
  exception when foreign_key_violation then
    v_deleted_name := trim(v_target.name);
    if v_deleted_name not like '%（已刪除）' then
      v_deleted_name := v_deleted_name || '（已刪除）';
    end if;
    update public.profiles
      set
        name = v_deleted_name,
        account_status = 'disabled',
        login_id = null,
        line_user_id = null,
        phone = null,
        email = null,
        must_change_password = false,
        finance_authorized = false,
        access_template = 'member',
        role_group_id = null,
        role_group_name = null,
        features = '{}'::jsonb,
        permission_overrides = '{}'::jsonb,
        profile_notes = coalesce(profile_notes || E'\n', '') ||
          ('[已刪除帳號 ' || to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM-DD HH24:MI') || ']')
    where id = v_target.id;
    v_mode := 'soft';
  end;

  insert into public.audit_logs (
    organization_id, action, actor_id, actor_name,
    target_type, target_id, before_json, after_json, result, message
  ) values (
    v_actor.organization_id,
    'account.delete',
    v_actor.id,
    v_actor.name,
    'profile',
    v_target.id::text,
    jsonb_build_object(
      'id', v_target.id,
      'name', v_target.name,
      'login_id', v_target.login_id,
      'phone', v_target.phone,
      'role', v_target.role::text
    )::text,
    jsonb_build_object('mode', v_mode)::text,
    'ok',
    case when v_mode = 'hard'
      then '已刪除帳號 ' || v_target.name
      else '已停用並清除登入資料（仍有歷史紀錄關聯）：' || v_target.name
    end
  );

  return jsonb_build_object(
    'ok', true,
    'mode', v_mode,
    'id', v_target.id,
    'name', v_target.name
  );
end;
$$;

revoke all on function public.admin_purge_member_profile(uuid, text) from public;
grant execute on function public.admin_purge_member_profile(uuid, text) to authenticated;

-- One-time: rename existing soft-deleted shells so they don't look like live teammates.
update public.profiles
set name = name || '（已刪除）'
where account_status = 'disabled'
  and login_id is null
  and phone is null
  and coalesce(email, '') = ''
  and name not like '%（已刪除）';

notify pgrst, 'reload schema';
