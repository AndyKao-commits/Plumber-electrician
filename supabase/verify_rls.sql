-- Run after formal persistence + phase3/line migrations.
-- Prefer verify_rls_one_shot.sql on mobile SQL Editor.

select 'helpers' as check_id,
  (to_regprocedure('public.current_user_org_id()') is not null) as org_helper,
  (to_regprocedure('public.current_user_role()') is not null) as role_helper,
  (to_regprocedure('public.set_org_id_from_profile()') is not null) as stamp_helper,
  (to_regprocedure('public.protect_profile_privileged_columns()') is not null) as profile_guard,
  (to_regprocedure('public.protect_frozen_quotation()') is not null) as quote_guard,
  (to_regprocedure('public.create_org_notices(uuid[],text,text,text,text,boolean)') is not null) as notice_rpc,
  (to_regprocedure('public.enqueue_line_notifications(uuid[],text,text,text,text,jsonb)') is not null) as line_rpc;

select 'rls_enabled' as check_id, count(*) as actual, 11 as expected
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relrowsecurity
  and c.relname in (
    'organizations','profiles','sites','attendance','purchases','notices',
    'repair_cases','quotations','emergency_limit_events','materials',
    'notification_outbox'
  );

select 'purchase_cols' as check_id, count(*) as actual, 3 as expected
from information_schema.columns
where table_schema = 'public'
  and table_name = 'purchases'
  and column_name in ('approved_by','approved_at','rejected_reason');

select 'materials_qty_check' as check_id, count(*) as actual, 1 as expected
from pg_constraint
where conname = 'materials_qty_nonnegative';

select 'org_triggers' as check_id, count(*) as actual, 9 as expected
from pg_trigger
where not tgisinternal and tgname like 'trg_set_org_%';

select 'line_bind_grant' as check_id,
  has_column_privilege('authenticated', 'public.profiles', 'line_user_id', 'UPDATE') as can_update_line;
