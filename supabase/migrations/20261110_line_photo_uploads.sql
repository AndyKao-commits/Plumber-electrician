-- LINE / app construction photo uploads (private storage + metadata)

create table if not exists public.photo_uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  site_id uuid references public.sites (id) on delete set null,
  storage_path text not null,
  content_type text,
  byte_size integer,
  line_message_id text,
  source text not null default 'line',
  status text not null default 'pending'
    check (status in ('pending', 'linked', 'discarded')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists photo_uploads_org_created_idx
  on public.photo_uploads (organization_id, created_at desc);

create index if not exists photo_uploads_uploader_idx
  on public.photo_uploads (uploaded_by, created_at desc);

alter table public.photo_uploads enable row level security;

drop policy if exists "photo_uploads_select_org" on public.photo_uploads;
create policy "photo_uploads_select_org"
  on public.photo_uploads for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "photo_uploads_update_org" on public.photo_uploads;
create policy "photo_uploads_update_org"
  on public.photo_uploads for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

-- Inserts come from Edge Function (service role). Authenticated may also insert own rows.
drop policy if exists "photo_uploads_insert_own" on public.photo_uploads;
create policy "photo_uploads_insert_own"
  on public.photo_uploads for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and uploaded_by = auth.uid()
  );

revoke all on table public.photo_uploads from public, anon;
grant select, insert, update on table public.photo_uploads to authenticated;

-- Private storage bucket for construction photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-photos',
  'site-photos',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies: org members can read paths under their org id prefix
drop policy if exists "site_photos_select_org" on storage.objects;
create policy "site_photos_select_org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'site-photos'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

drop policy if exists "site_photos_insert_own" on storage.objects;
create policy "site_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-photos'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

comment on table public.photo_uploads is
  'Construction photos; LINE webhook writes pending rows for bound users';
