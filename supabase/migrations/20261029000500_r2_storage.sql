-- =====================================================================
-- Cloudflare R2 storage for films (alongside the few older Mux videos).
--
-- For provider = 'r2':
--   asset_id     = key of the ORIGINAL file in the bucket
--   playback_id  = key of the file viewers stream/download (the original
--                  until a smaller 720p copy is made, then that copy)
--   upload_id    = the multipart upload id while uploading
--   size_bytes   = original size; stream_bytes = size of the viewing file
--   transcode_status: null (not needed) | 'waiting' | 'working' | 'done' | 'failed'
-- =====================================================================

alter table public.media_assets add column if not exists size_bytes bigint;
alter table public.media_assets add column if not exists stream_bytes bigint;
alter table public.media_assets add column if not exists transcode_status text;
alter table public.media_assets add column if not exists transcode_claimed_at timestamptz;
alter table public.media_assets add column if not exists transcode_error text;
create index if not exists media_assets_transcode_idx on public.media_assets (transcode_status, created_at)
  where provider = 'r2';

-- What to play for a film or a series part, only for viewers allowed to
-- watch it. Returns nothing when not allowed or no video is ready.
create or replace function public.video_source(t_id uuid, e_id uuid default null, country text default null)
returns table (provider text, ref text, bytes bigint)
language plpgsql stable security definer set search_path = public as $$
declare ok boolean;
begin
  select e.can_play into ok from public.playback_entitlement(t_id, country) e;
  if not coalesce(ok, false) then return; end if;
  if e_id is not null then
    if not exists (select 1 from public.episodes where id = e_id and title_id = t_id and published) then return; end if;
    return query select m.provider, m.playback_id, coalesce(m.stream_bytes, m.size_bytes)
      from public.media_assets m
     where m.episode_id = e_id and m.status = 'ready' and m.playback_id is not null
     order by m.created_at desc limit 1;
  else
    return query select m.provider, m.playback_id, coalesce(m.stream_bytes, m.size_bytes)
      from public.media_assets m
     where m.title_id = t_id and m.episode_id is null and m.kind = 'feature'
       and m.status = 'ready' and m.playback_id is not null
     order by m.created_at desc limit 1;
  end if;
end $$;
revoke execute on function public.video_source(uuid, uuid, text) from public;
grant execute on function public.video_source(uuid, uuid, text) to anon, authenticated;

-- Download licence (same rules as issue_download) that also says where the
-- file lives. issue_download stays for older app builds.
create or replace function public.issue_download2(t_id uuid, e_id uuid default null, country text default null)
returns table (download_id uuid, expires_at timestamptz, provider text, ref text, asset_id text, bytes bigint, reason text)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  m record;
begin
  select * into r from public.issue_download(t_id, e_id, country);
  if r.reason <> 'ok' then
    return query select null::uuid, null::timestamptz, null::text, null::text, null::text, null::bigint, r.reason; return;
  end if;
  select a.provider, a.playback_id, a.asset_id, coalesce(a.stream_bytes, a.size_bytes) as bytes into m
    from public.media_assets a
   where a.playback_id = r.playback_id and a.title_id = t_id and a.status = 'ready'
   order by a.created_at desc limit 1;
  return query select r.download_id, r.expires_at, m.provider, m.playback_id, m.asset_id, m.bytes, 'ok'::text;
end $$;
revoke execute on function public.issue_download2(uuid, uuid, text) from public, anon;
grant execute on function public.issue_download2(uuid, uuid, text) to authenticated;
