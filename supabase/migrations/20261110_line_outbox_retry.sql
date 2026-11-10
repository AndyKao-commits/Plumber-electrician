-- LINE outbox retry metadata (idempotent)
-- Keeps failed rows retryable until max attempts; never stores secrets.

alter table public.notification_outbox
  add column if not exists attempts integer not null default 0;

alter table public.notification_outbox
  add column if not exists next_retry_at timestamptz;

alter table public.notification_outbox
  add column if not exists last_attempt_at timestamptz;

create index if not exists notification_outbox_retry_idx
  on public.notification_outbox (status, next_retry_at, created_at)
  where status in ('pending', 'failed');

-- Allow service role to flip failed → pending on retry; clients still cannot update.
comment on column public.notification_outbox.attempts is
  'LINE push attempt count; Edge Function increments; max handled in function';
comment on column public.notification_outbox.next_retry_at is
  'When failed rows become eligible again; null means immediately eligible if status=pending';
comment on column public.notification_outbox.error is
  'Last failure reason (sanitized; never includes channel token)';
