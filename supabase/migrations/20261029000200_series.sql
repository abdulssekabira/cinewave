-- =====================================================================
-- Series: one title (one poster) with many parts. Each part has its own
-- video and its own resume point. Plans, rights and the device limit are
-- decided for the whole series, exactly as for a movie.
-- =====================================================================

alter table public.titles add column if not exists kind text not null default 'movie';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'titles_kind_check') then
    alter table public.titles add constraint titles_kind_check check (kind in ('movie', 'series'));
  end if;
end $$;

create table if not exists public.episodes (
  id              uuid primary key default gen_random_uuid(),
  title_id        uuid not null references public.titles (id) on delete cascade,
  season          int  not null default 1 check (season between 1 and 99),
  number          int  not null check (number between 1 and 999),
  name            text check (char_length(name) <= 120),
  synopsis        text,
  runtime_minutes int check (runtime_minutes between 1 and 1000),
  still_url       text,
  published       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (title_id, season, number)
);
create index if not exists episodes_title_idx on public.episodes (title_id, season, number);
create trigger episodes_updated before update on public.episodes
  for each row execute function public.set_updated_at();

alter table public.episodes enable row level security;
-- Viewers see published parts of series that are in the catalogue.
create policy "episodes readable" on public.episodes for select using (
  public.is_staff()
  or (published and exists (
        select 1 from public.titles t
         where t.id = episodes.title_id and t.status = 'published' and public.title_streamable(t.id)))
);
create policy "staff manage episodes" on public.episodes
  for all using (public.is_staff()) with check (public.is_staff());
grant select on public.episodes to anon, authenticated;
grant insert, update, delete on public.episodes to authenticated;

-- Videos can belong to a part.
alter table public.media_assets add column if not exists episode_id uuid references public.episodes (id) on delete cascade;
create index if not exists media_assets_episode_idx on public.media_assets (episode_id, created_at desc);

-- Per-part resume points.
create table if not exists public.episode_progress (
  user_id          uuid not null references auth.users (id) on delete cascade,
  episode_id       uuid not null references public.episodes (id) on delete cascade,
  position_seconds int  not null default 0 check (position_seconds >= 0),
  duration_seconds int,
  completed        boolean not null default false,
  updated_at       timestamptz not null default now(),
  primary key (user_id, episode_id)
);
create trigger episode_progress_updated before update on public.episode_progress
  for each row execute function public.set_updated_at();
alter table public.episode_progress enable row level security;
create policy "own episode progress" on public.episode_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.episode_progress to authenticated;

-- Series-level row in watch_progress remembers which part the viewer is on
-- (for Continue Watching and the "Resume Part 3" button).
alter table public.watch_progress add column if not exists episode_id uuid references public.episodes (id) on delete set null;

-- Movie video: only videos not attached to a part.
create or replace function public.playback_id_for(t_id uuid, country text default null)
returns text
language plpgsql stable security definer set search_path = public as $$
declare ok boolean;
begin
  select e.can_play into ok from public.playback_entitlement(t_id, country) e;
  if not coalesce(ok, false) then return null; end if;
  return (select m.playback_id from public.media_assets m
           where m.title_id = t_id and m.episode_id is null and m.kind = 'feature'
             and m.status = 'ready' and m.playback_id is not null
           order by m.created_at desc limit 1);
end $$;

-- A part's video, only for viewers allowed to watch the series.
create or replace function public.playback_id_for_episode(e_id uuid, country text default null)
returns text
language plpgsql stable security definer set search_path = public as $$
declare t uuid; ok boolean;
begin
  select title_id into t from public.episodes where id = e_id and published;
  if t is null then return null; end if;
  select e.can_play into ok from public.playback_entitlement(t, country) e;
  if not coalesce(ok, false) then return null; end if;
  return (select m.playback_id from public.media_assets m
           where m.episode_id = e_id and m.status = 'ready' and m.playback_id is not null
           order by m.created_at desc limit 1);
end $$;
revoke execute on function public.playback_id_for_episode(uuid, text) from public;
grant execute on function public.playback_id_for_episode(uuid, text) to anon, authenticated;

-- Catalogue: kind and number of parts (added at the end of the view).
create or replace view public.catalog_titles
with (security_invoker = true) as
select
  t.id, t.slug, t.title, t.tagline, t.synopsis, t.release_year,
  t.runtime_minutes, t.maturity_rating, t.content_warnings,
  t.original_language, t.audio_languages, t.subtitle_languages,
  t.credits, t.poster_url, t.backdrop_url, t.trailer_url,
  t.required_plan, t.is_featured, t.popularity, t.published_at,
  coalesce(
    (select array_agg(g.slug order by g.name)
       from public.title_genres tg join public.genres g on g.id = tg.genre_id
      where tg.title_id = t.id), '{}') as genres,
  public.title_downloadable(t.id) as downloadable,
  t.rating,
  t.rating_source,
  v.slug as vj_slug,
  v.name as vj_name,
  v.photo_url as vj_photo_url,
  t.kind,
  (select count(*)::int from public.episodes e where e.title_id = t.id and e.published) as episode_count
from public.titles t
left join public.vjs v on v.id = t.vj_id and v.active
where t.status = 'published'
  and public.title_streamable(t.id);

grant select on public.catalog_titles to anon, authenticated;
