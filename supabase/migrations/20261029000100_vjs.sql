-- =====================================================================
-- VJs (the voice that translates/narrates a film, e.g. "VJ Junior") and
-- owner-managed genres. Each film can have one VJ and many genres.
-- =====================================================================

create table if not exists public.vjs (
  id         serial primary key,
  slug       text not null unique check (slug ~ '^[a-z0-9-]{1,60}$'),
  name       text not null check (char_length(name) between 1 and 60),
  photo_url  text,
  sort_order int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.vjs enable row level security;
create policy "vjs readable" on public.vjs for select using (active or public.is_staff());
create policy "staff manage vjs" on public.vjs
  for all using (public.is_staff()) with check (public.is_staff());
grant select on public.vjs to anon, authenticated;
grant insert, update, delete on public.vjs to authenticated;
grant usage, select on sequence public.vjs_id_seq to authenticated;

alter table public.titles add column if not exists vj_id int references public.vjs (id) on delete set null;
create index if not exists titles_vj_idx on public.titles (vj_id);

-- Genres: owner can hide and order them.
alter table public.genres add column if not exists sort_order int not null default 0;
alter table public.genres add column if not exists active boolean not null default true;

-- Catalogue gains the VJ (new columns go at the end, so the view can be replaced in place).
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
  v.photo_url as vj_photo_url
from public.titles t
left join public.vjs v on v.id = t.vj_id and v.active
where t.status = 'published'
  and public.title_streamable(t.id);

grant select on public.catalog_titles to anon, authenticated;
