-- One result set for mobile SQL Editor (run whole script once)
-- After 20261110_formal_persistence_security + 20261110_phase3_line_notify
select 'helpers' as check_id,
  (to_regprocedure('public.current_user_org_id()') is not null)::text as a,
  (to_regprocedure('public.current_user_role()') is not null)::text as b,
  (to_regprocedure('public.set_org_id_from_profile()') is not null)::text as c,
  (to_regprocedure('public.protect_profile_privileged_columns()') is not null)::text as d,
  (to_regprocedure('public.protect_frozen_quotation()') is not null)::text as e
union all
select 'notice_line_rpcs',
  (to_regprocedure('public.create_org_notices(uuid[],text,text,text,text,boolean)') is not null)::text,
  (to_regprocedure('public.create_notices_for_roles(text[],text,text,text,text,boolean,boolean)') is not null)::text,
  (to_regprocedure('public.enqueue_line_notifications(uuid[],text,text,text,text,jsonb)') is not null)::text,
  (to_regprocedure('public.list_approver_ids(boolean)') is not null)::text,
  null
union all
select 'rls_enabled',
  (select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relrowsecurity and c.relname in (
      'organizations','profiles','sites','attendance','purchases','notices',
      'repair_cases','quotations','emergency_limit_events','materials',
      'notification_outbox')),
  'expect_11', null, null, null
union all
select 'purchase_cols',
  (select count(*)::text from information_schema.columns
    where table_schema='public' and table_name='purchases'
      and column_name in ('approved_by','approved_at','rejected_reason')),
  'expect_3', null, null, null
union all
select 'materials_qty_check',
  (select count(*)::text from pg_constraint where conname='materials_qty_nonnegative'),
  'expect_1', null, null, null
union all
select 'org_triggers',
  (select count(*)::text from pg_trigger
    where not tgisinternal and tgname like 'trg_set_org_%'),
  'expect_9', null, null, null
union all
select 'line_bind_grant',
  (has_column_privilege('authenticated', 'public.profiles', 'line_user_id', 'UPDATE'))::text,
  'expect_true', null, null, null;
union all
select 'outbox_retry_cols',
  (select count(*)::text from information_schema.columns
    where table_schema='public' and table_name='notification_outbox'
      and column_name in ('attempts','next_retry_at','last_attempt_at')),
  'expect_3', null, null, null
union all
select 'complete_signup_rpc',
  (to_regprocedure('public.complete_signup(text,text)') is not null)::text,
  'expect_true', null, null, null;
