-- OPS: sync_operations — offline idempotency (client_operation_id + request_hash)

create table if not exists public.sync_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_operation_id text not null,
  operation_type text not null,
  request_hash text not null,
  status text not null default 'accepted'
    check (status in ('accepted', 'conflict', 'failed')),
  server_resource_id text,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_operations_client_op_unique
    unique (organization_id, user_id, client_operation_id)
);

create index if not exists sync_operations_user_created_idx
  on public.sync_operations (user_id, created_at desc);

create index if not exists sync_operations_org_status_idx
  on public.sync_operations (organization_id, status, created_at desc);

alter table public.sync_operations enable row level security;

drop policy if exists "sync_operations_select_own" on public.sync_operations;
create policy "sync_operations_select_own"
  on public.sync_operations for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and user_id = auth.uid()
  );

drop policy if exists "sync_operations_insert_own" on public.sync_operations;
create policy "sync_operations_insert_own"
  on public.sync_operations for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and user_id = auth.uid()
  );

drop policy if exists "sync_operations_update_own" on public.sync_operations;
create policy "sync_operations_update_own"
  on public.sync_operations for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and user_id = auth.uid()
  )
  with check (
    organization_id = public.current_user_org_id()
    and user_id = auth.uid()
  );

revoke all on table public.sync_operations from public, anon;
grant select, insert, update on table public.sync_operations to authenticated;

drop trigger if exists trg_set_org_sync_operations on public.sync_operations;
create trigger trg_set_org_sync_operations
  before insert on public.sync_operations
  for each row execute function public.set_org_id_from_profile();

comment on table public.sync_operations is
  '離線同步冪等：organization+user+client_operation_id 唯一；同鍵不同 hash → conflict';
