-- =====================================================================
-- Protected offline downloads (Android app).
--
-- Every downloaded film or part has a LICENCE row here, tied to the
-- account AND the phone (the sign-in session). The file itself lives in
-- the app's private storage. The app may play it offline only until the
-- licence expires; whenever the phone is online the app renews licences
-- here. A licence is revoked (and the app deletes the file) when:
--   * the subscription no longer includes downloads,
--   * the film's download rights end or change territory,
--   * the phone was removed from the account (different/ended session),
--   * the viewer deletes it.
-- =====================================================================

create table if not exists public.downloads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title_id    uuid not null references public.titles (id) on delete cascade,
  episode_id  uuid references public.episodes (id) on delete cascade,
  session_id  uuid not null,
  created_at  timestamptz not null default now(),
  renewed_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked     boolean not null default false
);
create index if not exists downloads_user_idx on public.downloads (user_id, revoked, expires_at);
create unique index if not exists downloads_one_per_device
  on public.downloads (user_id, session_id, title_id, coalesce(episode_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where not revoked;

alter table public.downloads enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'downloads' and policyname = 'own downloads readable') then
    create policy "own downloads readable" on public.downloads for select using (user_id = auth.uid() or public.is_staff());
  end if;
end $$;
-- No direct writes: licences are only issued/renewed through the functions below.
grant select on public.downloads to authenticated;

-- How long a licence lasts before the phone must go online again
-- (the shortest expiry among the film's active download rights; 48h default).
create or replace function public.download_hours(t_id uuid, country text)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce(min(r.download_expiry_hours), 48)
    from public.rights r
   where r.title_id = t_id and r.allow_stream and r.allow_download
     and r.starts_at <= now() and (r.ends_at is null or r.ends_at > now())
     and ('*' = any (r.territories) or (country is not null and upper(country) = any (r.territories)));
$$;
revoke execute on function public.download_hours(uuid, text) from public, anon;

-- Most downloads one account may hold at once (all its phones together).
create or replace function public.download_limit() returns int language sql immutable as $$ select 25 $$;

-- Issues (or renews) a licence for this phone. Returns the playback ID the
-- website signs a one-time download link for. reason <> 'ok' means refused.
create or replace function public.issue_download(t_id uuid, e_id uuid default null, country text default null)
returns table (download_id uuid, expires_at timestamptz, playback_id text, asset_id text, reason text)
language plpgsql security definer set search_path = public as $$
declare
  ent record;
  sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  t_kind text;
  hrs int;
  existing uuid;
  m record;
  new_id uuid;
  exp timestamptz;
begin
  if auth.uid() is null or sid is null then
    return query select null::uuid, null::timestamptz, null::text, null::text, 'sign_in_required'; return;
  end if;

  select * into ent from public.playback_entitlement(t_id, country);
  if not coalesce(ent.can_play, false) then
    return query select null::uuid, null::timestamptz, null::text, null::text, coalesce(ent.reason, 'not_found'); return;
  end if;
  if not ent.can_download then
    return query select null::uuid, null::timestamptz, null::text, null::text,
      case when public.rights_active(t_id, country, true) then 'upgrade_required' else 'not_downloadable' end;
    return;
  end if;

  select kind into t_kind from public.titles where id = t_id;
  if t_kind = 'series' then
    if e_id is null or not exists (select 1 from public.episodes where id = e_id and title_id = t_id and published) then
      return query select null::uuid, null::timestamptz, null::text, null::text, 'not_found'; return;
    end if;
    select a.playback_id, a.asset_id into m from public.media_assets a
     where a.episode_id = e_id and a.status = 'ready' and a.playback_id is not null
     order by a.created_at desc limit 1;
  else
    e_id := null;
    select a.playback_id, a.asset_id into m from public.media_assets a
     where a.title_id = t_id and a.episode_id is null and a.kind = 'feature' and a.status = 'ready' and a.playback_id is not null
     order by a.created_at desc limit 1;
  end if;
  if m.playback_id is null then
    return query select null::uuid, null::timestamptz, null::text, null::text, 'no_video'; return;
  end if;

  select d.id into existing from public.downloads d
   where d.user_id = auth.uid() and d.session_id = sid and d.title_id = t_id
     and d.episode_id is not distinct from e_id and not d.revoked;

  if existing is null and (select count(*) from public.downloads d
        where d.user_id = auth.uid() and not d.revoked and d.expires_at > now()) >= public.download_limit() then
    return query select null::uuid, null::timestamptz, null::text, null::text, 'download_limit'; return;
  end if;

  hrs := public.download_hours(t_id, country);
  exp := now() + make_interval(hours => hrs);
  if existing is null then
    insert into public.downloads (user_id, title_id, episode_id, session_id, expires_at)
    values (auth.uid(), t_id, e_id, sid, exp) returning id into new_id;
  else
    update public.downloads set expires_at = exp, renewed_at = now() where id = existing;
    new_id := existing;
  end if;
  return query select new_id, exp, m.playback_id::text, m.asset_id::text, 'ok';
end $$;
revoke execute on function public.issue_download(uuid, uuid, text) from public, anon;
grant execute on function public.issue_download(uuid, uuid, text) to authenticated;

-- Called by the app whenever it is online. Renews licences that are still
-- allowed on THIS phone and revokes the rest. Unknown ids come back not ok.
create or replace function public.check_downloads(ids uuid[], country text default null)
returns table (download_id uuid, ok boolean, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  d public.downloads;
  allowed boolean;
  exp timestamptz;
  i uuid;
begin
  if auth.uid() is null then return; end if;
  foreach i in array coalesce(ids, '{}') loop
    select * into d from public.downloads x where x.id = i and x.user_id = auth.uid();
    if not found then
      return query select i, false, null::timestamptz; continue;
    end if;
    allowed := not d.revoked and sid is not null and d.session_id = sid
      and coalesce((select e.can_download from public.playback_entitlement(d.title_id, country) e), false)
      and (d.episode_id is null or exists (select 1 from public.episodes x where x.id = d.episode_id and x.published));
    if allowed then
      exp := now() + make_interval(hours => public.download_hours(d.title_id, country));
      update public.downloads x set expires_at = exp, renewed_at = now() where x.id = d.id;
      return query select d.id, true, exp;
    else
      update public.downloads x set revoked = true where x.id = d.id and not x.revoked;
      return query select d.id, false, null::timestamptz;
    end if;
  end loop;
end $$;
revoke execute on function public.check_downloads(uuid[], text) from public, anon;
grant execute on function public.check_downloads(uuid[], text) to authenticated;

-- The viewer deleted a download on their phone.
create or replace function public.release_download(d_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.downloads set revoked = true where id = d_id and user_id = auth.uid();
$$;
revoke execute on function public.release_download(uuid) from public, anon;
grant execute on function public.release_download(uuid) to authenticated;
