-- =====================================================================
-- Viewer reviews: 1–5 stars + optional comment, one per viewer per title.
-- Only signed-in viewers who have watched at least a minute can post.
-- 3 reports hide a review automatically; the owner can hide/show any.
-- Names shown: username, else first name (never the email).
-- =====================================================================

create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  title_id   uuid not null references public.titles (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  body       text check (body is null or char_length(body) <= 1000),
  hidden     boolean not null default false,
  reports    int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title_id, user_id)
);
create index if not exists reviews_title_idx on public.reviews (title_id, created_at desc);

create table if not exists public.review_reports (
  review_id  uuid not null references public.reviews (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'admins manage reviews') then
    create policy "admins manage reviews" on public.reviews for all using (public.has_role('admin')) with check (public.has_role('admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'review_reports' and policyname = 'admins read reports') then
    create policy "admins read reports" on public.review_reports for select using (public.has_role('admin'));
  end if;
end $$;

insert into public.site_settings (key, value) values ('review_hide_after_reports', '3') on conflict (key) do nothing;

-- Public name for a viewer: username, else first name; never the email.
create or replace function public.public_name(u uuid)
returns text
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    nullif(p.username, ''),
    case
      when p.display_name is null or btrim(p.display_name) = ''
        or lower(btrim(p.display_name)) = lower(split_part(au.email, '@', 1))
        or p.display_name like '%@%'
      then 'GLE viewer'
      else left(split_part(btrim(p.display_name), ' ', 1), 24)
    end)
  from auth.users au left join public.profiles p on p.id = au.id
  where au.id = u;
$$;
revoke execute on function public.public_name(uuid) from public, anon, authenticated;

-- Has this viewer watched at least a minute of the title (or any episode)?
create or replace function public.has_watched(t_id uuid, u uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.watch_progress w where w.user_id = u and w.title_id = t_id and w.position_seconds >= 60)
      or exists (select 1 from public.episode_progress ep join public.episodes e on e.id = ep.episode_id
                  where ep.user_id = u and e.title_id = t_id and ep.position_seconds >= 60);
$$;
revoke execute on function public.has_watched(uuid, uuid) from public, anon, authenticated;

-- Reviews for a title, newest first (the viewer's own first).
create or replace function public.title_reviews(t_id uuid, lim int default 20, off int default 0)
returns table (id uuid, stars smallint, body text, author text, created_at timestamptz, updated_at timestamptz, mine boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.stars, r.body, public.public_name(r.user_id), r.created_at, r.updated_at, coalesce(r.user_id = auth.uid(), false)
    from public.reviews r
   where r.title_id = t_id and (not r.hidden or r.user_id = auth.uid())
   order by coalesce(r.user_id = auth.uid(), false) desc, r.created_at desc
   limit least(greatest(lim, 1), 50) offset greatest(off, 0);
$$;
grant execute on function public.title_reviews(uuid, int, int) to anon, authenticated;

-- Average, count, how many of each star, and whether the viewer may post.
create or replace function public.review_summary(t_id uuid)
returns table (average numeric, total int, s1 int, s2 int, s3 int, s4 int, s5 int, can_review boolean, my_stars smallint)
language sql stable security definer set search_path = public as $$
  select round(avg(r.stars)::numeric, 1), count(*)::int,
         count(*) filter (where r.stars = 1)::int, count(*) filter (where r.stars = 2)::int,
         count(*) filter (where r.stars = 3)::int, count(*) filter (where r.stars = 4)::int,
         count(*) filter (where r.stars = 5)::int,
         auth.uid() is not null and public.has_watched(t_id, auth.uid()),
         (select m.stars from public.reviews m where m.title_id = t_id and m.user_id = auth.uid())
    from public.reviews r
   where r.title_id = t_id and not r.hidden;
$$;
grant execute on function public.review_summary(uuid) to anon, authenticated;

-- Add or change my review.
create or replace function public.save_review(t_id uuid, n_stars int, n_body text)
returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); txt text := nullif(btrim(coalesce(n_body, '')), '');
begin
  if me is null then return 'Sign in to leave a review.'; end if;
  if n_stars is null or n_stars < 1 or n_stars > 5 then return 'Choose 1 to 5 stars.'; end if;
  if txt is not null and char_length(txt) > 1000 then return 'Keep your review under 1,000 characters.'; end if;
  if not exists (select 1 from public.titles where id = t_id and status = 'published') then return 'This title isn’t available.'; end if;
  if not public.has_watched(t_id, me) then return 'Watch a bit of it first, then share your view.'; end if;
  insert into public.reviews (title_id, user_id, stars, body)
  values (t_id, me, n_stars, txt)
  on conflict (title_id, user_id) do update
    set stars = excluded.stars, body = excluded.body, updated_at = now();  -- a hidden review stays hidden
  return null;
end $$;
revoke execute on function public.save_review(uuid, int, text) from public, anon;
grant execute on function public.save_review(uuid, int, text) to authenticated;

create or replace function public.delete_my_review(t_id uuid)
returns void
language sql security definer set search_path = public as $$
  delete from public.reviews where title_id = t_id and user_id = auth.uid();
$$;
revoke execute on function public.delete_my_review(uuid) from public, anon;
grant execute on function public.delete_my_review(uuid) to authenticated;

-- Report someone else's review; hidden automatically after N reports.
create or replace function public.report_review(r_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then return; end if;
  if exists (select 1 from public.reviews where id = r_id and user_id = me) then return; end if;
  insert into public.review_reports (review_id, user_id) values (r_id, me) on conflict do nothing;
  if not found then return; end if;
  update public.reviews set reports = reports + 1 where id = r_id returning reports into n;
  if n >= greatest(1, public.setting_int('review_hide_after_reports', 3)) then
    update public.reviews set hidden = true where id = r_id;
  end if;
end $$;
revoke execute on function public.report_review(uuid) from public, anon;
grant execute on function public.report_review(uuid) to authenticated;

-- Admin list: every review with title and name.
create or replace function public.admin_reviews(lim int default 100)
returns table (id uuid, title text, slug text, author text, stars smallint, body text, hidden boolean, reports int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, t.title, t.slug, public.public_name(r.user_id), r.stars, r.body, r.hidden, r.reports, r.created_at
    from public.reviews r join public.titles t on t.id = r.title_id
   where public.has_role('admin')
   order by r.hidden desc, r.reports desc, r.created_at desc
   limit least(greatest(lim, 1), 500);
$$;
revoke execute on function public.admin_reviews(int) from public, anon;
grant execute on function public.admin_reviews(int) to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'review_reports' and policyname = 'admins clear reports') then
    create policy "admins clear reports" on public.review_reports for delete using (public.has_role('admin'));
  end if;
end $$;

-- Update: viewers must watch at least 30 minutes (setting review_min_watch_min), or
-- most of a shorter film; series add up minutes across episodes.
insert into public.site_settings (key, value) values ('review_min_watch_min', '30') on conflict (key) do nothing;
create or replace function public.has_watched(t_id uuid, u uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  with need as (select greatest(1, public.setting_int('review_min_watch_min', 30)) * 60 as s)
  select exists (
           select 1 from public.watch_progress w, need
            where w.user_id = u and w.title_id = t_id and w.episode_id is null
              and (w.completed or w.position_seconds >= least(need.s, greatest(60, coalesce(nullif(w.duration_seconds, 0) * 0.8, need.s)))))
      or (select coalesce(sum(case when ep.completed then greatest(ep.position_seconds, coalesce(ep.duration_seconds, 0)) else ep.position_seconds end), 0)
            from public.episode_progress ep join public.episodes e on e.id = ep.episode_id
           where ep.user_id = u and e.title_id = t_id) >= (select s from need);
$$;
