-- Post-migration smoke checks (run in SQL Editor as postgres / service role)
-- Expect: all queries return rows / true as noted; no ERROR.

-- 1) helpers exist
select
  to_regprocedure('public.current_user_org_id()') is not null as has_org_fn,
  to_regprocedure('public.current_user_role()') is not null as has_role_fn,
  to_regprocedure('public.set_org_id_from_profile()') is not null as has_set_org_fn,
  to_regprocedure('public.protect_profile_privileged_columns()') is not null as has_profile_guard,
  to_regprocedure('public.protect_frozen_quotation()') is not null as has_quote_guard;

-- 2) RLS enabled on tenant tables
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'organizations','profiles','sites','attendance','purchases','notices',
    'repair_cases','quotations','emergency_limit_events','materials'
  )
order by 1;

-- 3) purchase approval columns
select column_name
from information_schema.columns
where table_schema='public' and table_name='purchases'
  and column_name in ('approved_by','approved_at','rejected_reason')
order by 1;

-- 4) materials non-negative constraint
select conname
from pg_constraint
where conname = 'materials_qty_nonnegative';

-- 5) org stamp triggers present
select tgname
from pg_trigger
where not tgisinternal
  and tgname like 'trg_set_org_%'
order by 1;
