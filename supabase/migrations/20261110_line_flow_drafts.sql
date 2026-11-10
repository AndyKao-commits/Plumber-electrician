-- LINE conversation flow drafts (reply-only; timeout judged on next user action)

create table if not exists public.line_flow_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  line_user_id text not null,
  flow_type text not null
    check (flow_type in ('photo_upload', 'todos')),
  flow_status text not null default 'collecting'
    check (flow_status in (
      'idle', 'collecting', 'awaiting_confirmation', 'processing',
      'completed', 'cancelled', 'paused', 'expired'
    )),
  current_step text,
  draft_payload jsonb not null default '{}'::jsonb,
  last_activity_at timestamptz not null default now(),
  paused_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active / paused flow per LINE user
create unique index if not exists line_flow_drafts_one_active_uidx
  on public.line_flow_drafts (line_user_id)
  where flow_status in ('collecting', 'awaiting_confirmation', 'processing', 'paused');

create index if not exists line_flow_drafts_profile_idx
  on public.line_flow_drafts (profile_id, updated_at desc);

create index if not exists line_flow_drafts_org_idx
  on public.line_flow_drafts (organization_id, flow_status);

alter table public.line_flow_drafts enable row level security;

drop policy if exists "line_flow_drafts_select_own" on public.line_flow_drafts;
create policy "line_flow_drafts_select_own"
  on public.line_flow_drafts for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and profile_id = auth.uid()
  );

-- Mutations via service role (webhook). Authenticated read-only for transparency.
revoke all on table public.line_flow_drafts from public, anon;
grant select on table public.line_flow_drafts to authenticated;

-- Photo batch metadata for LINE multi-image sessions
alter table public.photo_uploads
  add column if not exists batch_id uuid,
  add column if not exists photo_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'photo_uploads_photo_type_check'
  ) then
    alter table public.photo_uploads
      add constraint photo_uploads_photo_type_check
      check (
        photo_type is null
        or photo_type in ('before', 'during', 'after', 'acceptance', 'unclassified')
      );
  end if;
end $$;

create index if not exists photo_uploads_batch_idx
  on public.photo_uploads (batch_id, created_at);

comment on table public.line_flow_drafts is
  'LINE reply-only conversation drafts; timeout evaluated on next user action (no push)';
comment on column public.photo_uploads.batch_id is
  'LINE photo upload session batch id';
comment on column public.photo_uploads.photo_type is
  'before|during|after|acceptance|unclassified';
