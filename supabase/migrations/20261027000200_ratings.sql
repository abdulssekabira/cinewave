-- Ratings shown as ★ on posters and the hero. Always record where a rating
-- comes from (e.g. 'CineWave users', or a licensed ratings provider).
alter table public.titles
  add column rating numeric(3,1) check (rating between 0 and 10),
  add column rating_source text,
  add constraint rating_needs_source check (rating is null or rating_source is not null);

-- Recreate the public catalogue view with the new columns appended.
create or replace view public.catalog_titles
with (security_invoker = false) as
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
  exists (
    select 1 from public.rights r
     where r.title_id = t.id and r.allow_download
       and r.starts_at <= now() and (r.ends_at is null or r.ends_at > now())
  ) as downloadable,
  t.rating,
  t.rating_source
from public.titles t
where t.status = 'published'
  and exists (
    select 1 from public.rights r
     where r.title_id = t.id and r.allow_stream
       and r.starts_at <= now() and (r.ends_at is null or r.ends_at > now())
  );

grant select on public.catalog_titles to anon, authenticated;
