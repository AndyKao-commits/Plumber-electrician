-- Optional demo seed after schema.sql
-- Create Auth users in Supabase Dashboard first, then replace UUIDs below.

-- 1) Create organization
insert into public.organizations (id, name)
values ('11111111-1111-1111-1111-111111111111', '示範水電行')
on conflict (id) do nothing;

-- 2) After creating Auth users (boss@example.com / ming@example.com),
-- insert matching profiles with the same auth.users.id values:
--
-- insert into public.profiles (
--   id, organization_id, name, role, email, pay_type, finance_authorized
-- ) values
--   ('<boss-auth-uuid>', '11111111-1111-1111-1111-111111111111', '老闆', 'boss', 'boss@example.com', 'monthly', true),
--   ('<ming-auth-uuid>', '11111111-1111-1111-1111-111111111111', '師傅阿明', 'employee', 'ming@example.com', 'daily', false);

insert into public.sites (
  id, organization_id, name, kind, status, address, customer_name
) values
  (
    '22222222-2222-2222-2222-222222222221',
    '11111111-1111-1111-1111-111111111111',
    '忠孝東路住家整修',
    'formal',
    'active',
    '台北市大安區忠孝東路四段',
    '林先生'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    '臨時漏水維修',
    'repair',
    'active',
    '新北市板橋區文化路',
    '陳小姐'
  )
on conflict (id) do nothing;

insert into public.repair_cases (
  id, organization_id, site_id, customer_name, title
) values (
  '33333333-3333-3333-3333-333333333331',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '陳小姐',
  '廚房水管漏水'
)
on conflict (id) do nothing;

insert into public.materials (
  id, organization_id, name, unit, qty, unit_cost
) values
  (
    '44444444-4444-4444-4444-444444444441',
    '11111111-1111-1111-1111-111111111111',
    'PVC 管 4 分',
    '支',
    20,
    45
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    '11111111-1111-1111-1111-111111111111',
    '電線 2.0mm',
    '米',
    100,
    12.5
  )
on conflict (id) do nothing;
