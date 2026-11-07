-- =====================================================================
-- New-episode notifications (bell + pop-up on the website and in the app).
-- When an episode of a LIVE series becomes watchable (shown to viewers AND
-- its video is ready), everyone following that series gets a notification:
-- people who have it in My List or have started watching it.
-- =====================================================================

create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  kind           text not null default 'new_episode',
  title_id       uuid references public.titles (id) on delete cascade,
  episode_id     uuid references public.episodes (id) on delete cascade,
  heading        text not null,
  body           text,
  link           text,
  image_url      text,
  created_at     timestamptz not null default now(),
  read_at        timestamptz,
  popup_shown_at timestamptz
);
create unique index if not exists notifications_one_per_episode on public.notifications (user_id, episode_id) where episode_id is not null;
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'own notifications') then
    create policy "own notifications" on public.notifications for select using (user_id = auth.uid());
  end if;
end $$;
grant select on public.notifications to authenticated;

-- Marks notifications read (all, or the given ones) and/or their pop-up as shown.
create or replace function public.mark_notifications(ids uuid[] default null, read boolean default true, popup boolean default false)
returns void
language sql security definer set search_path = public as $$
  update public.notifications
     set read_at = case when read then coalesce(read_at, now()) else read_at end,
         popup_shown_at = case when popup then coalesce(popup_shown_at, now()) else popup_shown_at end
   where user_id = auth.uid() and (ids is null or id = any (ids));
$$;
revoke execute on function public.mark_notifications(uuid[], boolean, boolean) from public, anon;
grant execute on function public.mark_notifications(uuid[], boolean, boolean) to authenticated;

-- Sends the notifications for one episode, once, when it is watchable.
create or replace function public.notify_new_episode(e_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  ep public.episodes;
  t public.titles;
  multi boolean;
  label text;
begin
  select * into ep from public.episodes where id = e_id;
  if not found or not ep.published then return; end if;
  select * into t from public.titles where id = ep.title_id;
  if not found or t.status <> 'published' then return; end if;
  if not exists (select 1 from public.media_assets m where m.episode_id = e_id and m.status = 'ready' and m.playback_id is not null) then
    return;
  end if;
  multi := (select count(distinct season) > 1 from public.episodes where title_id = t.id and published);
  label := case when multi then 'S' || ep.season || ' · Episode ' || ep.number else 'Episode ' || ep.number end;

  insert into public.notifications (user_id, kind, title_id, episode_id, heading, body, link, image_url)
  select f.user_id, 'new_episode', t.id, ep.id,
         'New episode: ' || t.title,
         label || coalesce(' · ' || nullif(ep.name, ''), '') || ' is out now.',
         '/watch/' || t.slug || '?part=' || ep.id,
         coalesce(ep.still_url, t.backdrop_url, t.poster_url)
    from (select user_id from public.watchlist where title_id = t.id
          union
          select user_id from public.watch_progress where title_id = t.id) f
  on conflict do nothing;
end $$;
revoke execute on function public.notify_new_episode(uuid) from public, anon, authenticated;

create or replace function public.trg_notify_episode()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then
    perform public.notify_new_episode(new.id);
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'episodes_notify' and tgrelid = 'public.episodes'::regclass) then
    create trigger episodes_notify after insert or update of published on public.episodes
      for each row execute function public.trg_notify_episode();
  end if;
end $$;

create or replace function public.trg_notify_media()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.episode_id is not null and new.status = 'ready' and new.playback_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'ready' or old.playback_id is null) then
    perform public.notify_new_episode(new.episode_id);
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'media_notify' and tgrelid = 'public.media_assets'::regclass) then
    create trigger media_notify after insert or update of status, playback_id on public.media_assets
      for each row execute function public.trg_notify_media();
  end if;
end $$;
