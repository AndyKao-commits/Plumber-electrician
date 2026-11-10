-- One result set for mobile SQL Editor (run whole script once)
select 'helpers' as check_id,
  (to_regprocedure('public.current_user_org_id()') is not null)::text as a,
  (to_regprocedure('public.current_user_role()') is not null)::text as b,
  (to_regprocedure('public.set_org_id_from_profile()') is not null)::text as c,
  (to_regprocedure('public.protect_profile_privileged_columns()') is not null)::text as d,
  (to_regprocedure('public.protect_frozen_quotation()') is not null)::text as e
union all
select 'rls_enabled',
  (select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relrowsecurity and c.relname in (
      'organizations','profiles','sites','attendance','purchases','notices',
      'repair_cases','quotations','emergency_limit_events','materials')),
  'expect_10', null, null, null
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
  'expect_8', null, null, null;
