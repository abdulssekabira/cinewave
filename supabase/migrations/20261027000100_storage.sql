-- Artwork bucket for posters and backdrops (public read, staff write).
-- Video files do NOT go here — they live with the video provider.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artwork', 'artwork', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "artwork public read" on storage.objects
  for select using (bucket_id = 'artwork');

create policy "staff upload artwork" on storage.objects
  for insert with check (bucket_id = 'artwork' and public.is_staff());

create policy "staff update artwork" on storage.objects
  for update using (bucket_id = 'artwork' and public.is_staff());

create policy "staff delete artwork" on storage.objects
  for delete using (bucket_id = 'artwork' and public.is_staff());
