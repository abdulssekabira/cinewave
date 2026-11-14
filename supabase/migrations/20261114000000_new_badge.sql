-- "NEW" label: when a title became watchable for viewers, and when the
-- newest episode of a series did. Shown on posters for 24 hours.

create or replace function public.title_added_at(t_id uuid)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select greatest(
    t.published_at,
    (select min(m.created_at) from public.media_assets m
      where m.title_id = t.id and m.episode_id is null and m.status = 'ready' and m.playback_id is not null))
  from public.titles t where t.id = t_id;
$$;

create or replace function public.title_latest_episode_at(t_id uuid)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select max(greatest(e.created_at, m.created_at))
    from public.episodes e
    join public.media_assets m on m.episode_id = e.id and m.status = 'ready' and m.playback_id is not null
   where e.title_id = t_id and e.published;
$$;
grant execute on function public.title_added_at(uuid), public.title_latest_episode_at(uuid) to anon, authenticated;

create or replace view public.catalog_titles with (security_invoker = true) as
 SELECT t.id, t.slug, t.title, t.tagline, t.synopsis, t.release_year, t.runtime_minutes, t.maturity_rating,
    t.content_warnings, t.original_language, t.audio_languages, t.subtitle_languages, t.credits,
    t.poster_url, t.backdrop_url, t.trailer_url, t.required_plan, t.is_featured, t.popularity, t.published_at,
    COALESCE(( SELECT array_agg(g.slug ORDER BY g.name) FROM title_genres tg JOIN genres g ON g.id = tg.genre_id
          WHERE tg.title_id = t.id), '{}'::text[]) AS genres,
    title_downloadable(t.id) AS downloadable,
    t.rating, t.rating_source,
    v.slug AS vj_slug, v.name AS vj_name, v.photo_url AS vj_photo_url,
    t.kind,
    ( SELECT count(*)::integer FROM episodes e WHERE e.title_id = t.id AND e.published) AS episode_count,
    public.title_added_at(t.id) AS added_at,
    CASE WHEN t.kind = 'series' THEN public.title_latest_episode_at(t.id) END AS latest_episode_at
   FROM titles t
     LEFT JOIN vjs v ON v.id = t.vj_id AND v.active
  WHERE t.status = 'published'::title_status AND title_streamable(t.id);
