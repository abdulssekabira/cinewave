-- =====================================================================
-- Timed comments: pinned to a second of a film/episode. Viewers see them
-- only when they reach that moment. You can comment or reply only up to
-- the point you have honestly watched (no skipping ahead): the server
-- tracks a "reached" mark that only grows while you play at normal speed
-- from the furthest point you've seen.
-- =====================================================================

create table if not exists public.watch_reach (
  user_id   uuid not null references auth.users (id) on delete cascade,
  item_id   uuid not null,               -- the episode id, or the film's title id
  title_id  uuid not null references public.titles (id) on delete cascade,
  reached   int  not null default 0,     -- seconds watched without skipping
  last_pos  int  not null default 0,
  last_at   timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.watch_reach enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'watch_reach' and policyname = 'own reach') then
    create policy "own reach" on public.watch_reach for select using (user_id = auth.uid());
  end if;
end $$;

-- Called every ~10 s while playing. Returns the viewer's reached mark.
create or replace function public.track_watch(t_id uuid, e_id uuid, pos int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  item uuid := coalesce(e_id, t_id);
  r public.watch_reach;
  elapsed numeric;
  delta int;
begin
  if me is null or pos is null or pos < 0 then return 0; end if;
  if e_id is not null and not exists (select 1 from public.episodes where id = e_id and title_id = t_id) then return 0; end if;
  select * into r from public.watch_reach where user_id = me and item_id = item for update;
  if not found then
    insert into public.watch_reach (user_id, item_id, title_id, reached, last_pos, last_at)
    values (me, item, t_id, case when pos <= 20 then pos else 0 end, pos, now());
    return case when pos <= 20 then pos else 0 end;
  end if;
  elapsed := extract(epoch from now() - r.last_at);
  delta := pos - r.last_pos;
  -- Counts only when playing on from the furthest point seen, at about normal speed.
  if r.last_pos <= r.reached + 15 and delta > 0 and delta <= elapsed * 1.3 + 6 then
    r.reached := greatest(r.reached, pos);
  end if;
  update public.watch_reach set reached = r.reached, last_pos = pos, last_at = now()
   where user_id = me and item_id = item;
  return r.reached;
end $$;
revoke execute on function public.track_watch(uuid, uuid, int) from public, anon;
grant execute on function public.track_watch(uuid, uuid, int) to authenticated;

create table if not exists public.timed_comments (
  id         uuid primary key default gen_random_uuid(),
  title_id   uuid not null references public.titles (id) on delete cascade,
  episode_id uuid references public.episodes (id) on delete cascade,
  item_id    uuid not null,
  parent_id  uuid references public.timed_comments (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  at_seconds int  not null check (at_seconds >= 0),
  body       text not null check (char_length(body) between 1 and 300),
  hidden     boolean not null default false,
  reports    int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists timed_comments_item_idx on public.timed_comments (item_id, at_seconds) where parent_id is null;
create index if not exists timed_comments_parent_idx on public.timed_comments (parent_id, created_at) where parent_id is not null;

create table if not exists public.timed_comment_reports (
  comment_id uuid not null references public.timed_comments (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.timed_comments enable row level security;
alter table public.timed_comment_reports enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'timed_comments' and policyname = 'admins manage timed comments') then
    create policy "admins manage timed comments" on public.timed_comments for all using (public.has_role('admin')) with check (public.has_role('admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'timed_comment_reports' and policyname = 'admins manage comment reports') then
    create policy "admins manage comment reports" on public.timed_comment_reports for all using (public.has_role('admin')) with check (public.has_role('admin'));
  end if;
end $$;

create or replace function public.my_reach(t_id uuid, e_id uuid)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select reached from public.watch_reach where user_id = auth.uid() and item_id = coalesce(e_id, t_id)), 0);
$$;
grant execute on function public.my_reach(uuid, uuid) to authenticated;

-- Post a comment at a second (or a reply to one). Error text, or null when posted.
create or replace function public.post_timed_comment(t_id uuid, e_id uuid, at int, txt text, parent uuid default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  item uuid := coalesce(e_id, t_id);
  b text := btrim(coalesce(txt, ''));
  p public.timed_comments;
  reach int;
begin
  if me is null then return 'Sign in to comment.'; end if;
  if b = '' then return 'Write something first.'; end if;
  if char_length(b) > 300 then return 'Keep comments under 300 characters.'; end if;
  if not exists (select 1 from public.titles where id = t_id and status = 'published') then return 'This title isn’t available.'; end if;
  if e_id is not null and not exists (select 1 from public.episodes where id = e_id and title_id = t_id) then return 'Episode not found.'; end if;
  if parent is not null then
    select * into p from public.timed_comments where id = parent and item_id = item and parent_id is null and not hidden;
    if not found then return 'That comment is no longer available.'; end if;
    at := p.at_seconds;
  end if;
  if at is null or at < 0 then return 'Something went wrong. Try again.'; end if;
  select reached into reach from public.watch_reach where user_id = me and item_id = item;
  if coalesce(reach, 0) + 5 < at then
    return 'You can only comment on scenes you have watched without skipping.';
  end if;
  if exists (select 1 from public.timed_comments where user_id = me and created_at > now() - interval '8 seconds') then
    return 'Slow down a little, then try again.';
  end if;
  insert into public.timed_comments (title_id, episode_id, item_id, parent_id, user_id, at_seconds, body)
  values (t_id, e_id, item, parent, me, greatest(0, at), b);
  return null;
end $$;
revoke execute on function public.post_timed_comment(uuid, uuid, int, text, uuid) from public, anon;
grant execute on function public.post_timed_comment(uuid, uuid, int, text, uuid) to authenticated;

-- Top-level comments between two seconds (the player asks for what's coming up).
create or replace function public.timed_comments_between(t_id uuid, e_id uuid, from_s int, to_s int)
returns table (id uuid, at_seconds int, body text, author text, created_at timestamptz, mine boolean, replies int)
language sql stable security definer set search_path = public as $$
  select c.id, c.at_seconds, c.body, public.public_name(c.user_id), c.created_at,
         coalesce(c.user_id = auth.uid(), false),
         (select count(*)::int from public.timed_comments r where r.parent_id = c.id and not r.hidden)
    from public.timed_comments c
   where c.item_id = coalesce(e_id, t_id) and c.parent_id is null
     and c.at_seconds >= greatest(from_s, 0) and c.at_seconds <= least(to_s, from_s + 7200)
     and (not c.hidden or c.user_id = auth.uid())
   order by c.at_seconds, c.created_at
   limit 400;
$$;
grant execute on function public.timed_comments_between(uuid, uuid, int, int) to anon, authenticated;

create or replace function public.timed_comment_replies(c_id uuid)
returns table (id uuid, body text, author text, created_at timestamptz, mine boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.body, public.public_name(r.user_id), r.created_at, coalesce(r.user_id = auth.uid(), false)
    from public.timed_comments r
   where r.parent_id = c_id and (not r.hidden or r.user_id = auth.uid())
   order by r.created_at
   limit 200;
$$;
grant execute on function public.timed_comment_replies(uuid) to anon, authenticated;

create or replace function public.delete_my_timed_comment(c_id uuid)
returns void
language sql security definer set search_path = public as $$
  delete from public.timed_comments where id = c_id and user_id = auth.uid();
$$;
revoke execute on function public.delete_my_timed_comment(uuid) from public, anon;
grant execute on function public.delete_my_timed_comment(uuid) to authenticated;

create or replace function public.report_timed_comment(c_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then return; end if;
  if exists (select 1 from public.timed_comments where id = c_id and user_id = me) then return; end if;
  insert into public.timed_comment_reports (comment_id, user_id) values (c_id, me) on conflict do nothing;
  if not found then return; end if;
  update public.timed_comments set reports = reports + 1 where id = c_id returning reports into n;
  if n >= greatest(1, public.setting_int('review_hide_after_reports', 3)) then
    update public.timed_comments set hidden = true where id = c_id;
  end if;
end $$;
revoke execute on function public.report_timed_comment(uuid) from public, anon;
grant execute on function public.report_timed_comment(uuid) to authenticated;

create or replace function public.admin_timed_comments(lim int default 200)
returns table (id uuid, title text, slug text, episode text, parent_id uuid, author text, at_seconds int, body text, hidden boolean, reports int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, t.title, t.slug,
         case when e.id is null then null else 'S' || e.season || ' · Episode ' || e.number end,
         c.parent_id, public.public_name(c.user_id), c.at_seconds, c.body, c.hidden, c.reports, c.created_at
    from public.timed_comments c
    join public.titles t on t.id = c.title_id
    left join public.episodes e on e.id = c.episode_id
   where public.has_role('admin')
   order by c.hidden desc, c.reports desc, c.created_at desc
   limit least(greatest(lim, 1), 500);
$$;
revoke execute on function public.admin_timed_comments(int) from public, anon;
grant execute on function public.admin_timed_comments(int) to authenticated;
