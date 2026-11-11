-- Allow org members to hard-delete construction photos (row + storage object).

grant delete on table public.photo_uploads to authenticated;

drop policy if exists "photo_uploads_delete_org" on public.photo_uploads;
create policy "photo_uploads_delete_org"
  on public.photo_uploads for delete to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "site_photos_delete_org" on storage.objects;
create policy "site_photos_delete_org"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-photos'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );
