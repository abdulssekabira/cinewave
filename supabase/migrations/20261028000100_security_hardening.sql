-- =====================================================================
-- Security hardening (from Supabase security advisor)
-- =====================================================================

-- 1) Catalogue view runs with the VIEWER's permissions. Availability is
--    answered by two narrow helper functions that reveal only yes/no,
--    never contract details.
create or replace function public.title_streamable(t_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rights r
     where r.title_id = t_id and r.allow_stream
       and r.starts_at <= now() and (r.ends_at is null or r.ends_at > now())
  );
$$;

create or replace function public.title_downloadable(t_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rights r
     where r.title_id = t_id and r.allow_stream and r.allow_download
       and r.starts_at <= now() and (r.ends_at is null or r.ends_at > now())
  );
$$;

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
  t.rating_source
from public.titles t
where t.status = 'published'
  and public.title_streamable(t.id);

grant select on public.catalog_titles to anon, authenticated;

-- 2) Fixed search_path on trigger helpers.
alter function public.set_updated_at() set search_path = public;
alter function public.set_published_at() set search_path = public;

-- 3) Nobody calls trigger functions or internal helpers directly.
revoke execute on function public.audit_changes() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rights_active(uuid, text, boolean) from public, anon, authenticated;

-- 4) Admin user list: signed-in only (it also checks the admin role inside).
revoke execute on function public.admin_list_users(text) from public, anon;
grant execute on function public.admin_list_users(text) to authenticated;

-- 5) Intentionally callable: they only answer questions about the caller
--    or a yes/no about a film.
revoke execute on function public.title_streamable(uuid) from public;
revoke execute on function public.title_downloadable(uuid) from public;
grant execute on function public.title_streamable(uuid) to anon, authenticated;
grant execute on function public.title_downloadable(uuid) to anon, authenticated;
