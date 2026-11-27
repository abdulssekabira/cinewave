-- GLE Chat: one public room ("general") for every signed-in viewer.
-- Messages appear live (Supabase Realtime). Admins can delete messages, ban
-- people and clear the whole chat. Viewers choose whether to get notified.

-- ------------------------------------------------------------- messages
create table if not exists public.chat_messages (
  id          bigint generated always as identity primary key,
  room        text not null default 'general',
  user_id     uuid references auth.users on delete cascade,
  author      text not null,                -- username at the time (shown in the chat)
  badge       text,                         -- 'admin' | 'gold' | 'premium' | 'standard' | null
  body        text not null default '',
  spoiler     boolean not null default false,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint chat_body_len check (deleted_at is not null or char_length(body) between 1 and 500)
);
create index if not exists chat_messages_room_id on public.chat_messages (room, id desc);
create index if not exists chat_messages_user on public.chat_messages (user_id, created_at desc);

alter table public.chat_messages enable row level security;
-- Everyone (even visitors) can read; deleted messages have an empty body.
-- Deleted rows stay readable so live viewers learn they were removed.
drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages for select to anon, authenticated using (true);
-- No direct writes: everything goes through the functions below.

-- ------------------------------------------------------------- bans
create table if not exists public.chat_bans (
  user_id    uuid primary key references auth.users on delete cascade,
  until      timestamptz,            -- null = for good
  reason     text,
  banned_by  uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
alter table public.chat_bans enable row level security;
drop policy if exists chat_bans_admin on public.chat_bans;
create policy chat_bans_admin on public.chat_bans for select to authenticated
  using (public.has_role('admin') or user_id = auth.uid());

-- ------------------------------------------------------------- reports
create table if not exists public.chat_reports (
  message_id  bigint references public.chat_messages on delete cascade,
  reporter    uuid references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (message_id, reporter)
);
alter table public.chat_reports enable row level security;
drop policy if exists chat_reports_admin on public.chat_reports;
create policy chat_reports_admin on public.chat_reports for select to authenticated using (public.has_role('admin'));

-- ------------------------------------------------------------- notifications
-- Each viewer's choice (off until they turn it on).
alter table public.profiles add column if not exists chat_notify boolean not null default false;

-- App push tokens (one per phone).
create table if not exists public.push_tokens (
  token            text primary key,
  user_id          uuid not null references auth.users on delete cascade,
  platform         text,
  updated_at       timestamptz not null default now(),
  last_notified_at timestamptz
);
create index if not exists push_tokens_user on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens for select to authenticated using (user_id = auth.uid());

create or replace function public.save_push_token(p_token text, p_platform text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(p_token, '') = '' then return; end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (left(p_token, 300), auth.uid(), left(p_platform, 20), now())
  on conflict (token) do update set user_id = auth.uid(), platform = excluded.platform, updated_at = now();
end $$;

create or replace function public.set_chat_notify(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  update public.profiles set chat_notify = coalesce(p_on, false) where id = auth.uid();
end $$;

-- Server only: phones to notify about a new message, at most once every
-- 15 minutes per phone so a busy chat doesn't flood anyone.
create or replace function public.chat_push_targets(s text, p_sender uuid)
returns table(token text) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.server_secret_ok(s) then raise exception 'forbidden'; end if;
  return query
  with u as (
    update public.push_tokens t set last_notified_at = now()
      from public.profiles p
     where p.id = t.user_id and p.chat_notify and t.user_id <> p_sender
       and (t.last_notified_at is null or t.last_notified_at < now() - interval '15 minutes')
    returning t.token as tok)
  select u.tok from u;
end $$;

-- ------------------------------------------------------------- sending
create or replace function public.send_chat(p_body text, p_spoiler boolean default false)
returns public.chat_messages language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  b     text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  name  text;
  bdg   text;
  admin boolean := public.has_role('admin');
  row   public.chat_messages;
begin
  if uid is null then raise exception 'Sign in to chat.'; end if;
  if b = '' then raise exception 'Type a message first.'; end if;
  if char_length(b) > 500 then raise exception 'Messages can be up to 500 characters.'; end if;
  if exists (select 1 from public.chat_bans where user_id = uid and (until is null or until > now())) then
    raise exception 'You can’t send messages in the chat right now.';
  end if;
  if not admin then
    if exists (select 1 from public.chat_messages where user_id = uid and created_at > now() - interval '3 seconds') then
      raise exception 'Slow down a little – wait a few seconds.';
    end if;
    if b ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|ug|io|me|co|xyz|info|link|app)\M)' then
      raise exception 'Links aren’t allowed in the chat.';
    end if;
    if b ~ '\+?\d[\d \-]{7,}\d' then
      raise exception 'Phone numbers aren’t allowed in the chat.';
    end if;
  end if;

  select coalesce(nullif(p.username, ''), nullif(p.display_name, ''), 'viewer') into name
    from public.profiles p where p.id = uid;
  bdg := case when admin then 'admin'
              else nullif(public.current_plan(), 'free') end;

  insert into public.chat_messages (user_id, author, badge, body, spoiler)
  values (uid, coalesce(name, 'viewer'), bdg, b, coalesce(p_spoiler, false))
  returning * into row;
  return row;
end $$;

create or replace function public.report_chat(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  insert into public.chat_reports (message_id, reporter) values (p_id, auth.uid()) on conflict do nothing;
end $$;

-- ------------------------------------------------------------- admin
create or replace function public.admin_chat_delete(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin only' using errcode = '42501'; end if;
  update public.chat_messages set deleted_at = now(), body = '' where id = p_id and deleted_at is null;
end $$;

create or replace function public.admin_chat_clear()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.has_role('admin') then raise exception 'admin only' using errcode = '42501'; end if;
  update public.chat_messages set deleted_at = now(), body = '' where deleted_at is null;
  get diagnostics n = row_count;
  -- the text is gone; drop old placeholder rows so the table stays small
  delete from public.chat_messages where deleted_at < now() - interval '1 day';
  return n;
end $$;

create or replace function public.admin_chat_ban(p_user uuid, p_days int default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin only' using errcode = '42501'; end if;
  insert into public.chat_bans (user_id, until, reason, banned_by)
  values (p_user, case when p_days is null then null else now() + make_interval(days => p_days) end, left(p_reason, 200), auth.uid())
  on conflict (user_id) do update set until = excluded.until, reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();
end $$;

create or replace function public.admin_chat_unban(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin only' using errcode = '42501'; end if;
  delete from public.chat_bans where user_id = p_user;
end $$;

-- Reported messages, newest first, for Admin → Chat.
create or replace function public.admin_chat_reports()
returns table(id bigint, user_id uuid, author text, body text, created_at timestamptz, reports bigint, deleted boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.has_role('admin') then raise exception 'admin only' using errcode = '42501'; end if;
  return query
  select m.id, m.user_id, m.author, m.body, m.created_at, count(r.*), m.deleted_at is not null
    from public.chat_messages m join public.chat_reports r on r.message_id = m.id
   group by m.id order by max(r.created_at) desc limit 100;
end $$;

create or replace function public.admin_chat_bans()
returns table(user_id uuid, author text, until timestamptz, reason text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.has_role('admin') then raise exception 'admin only' using errcode = '42501'; end if;
  return query
  select b.user_id, coalesce(p.username, p.display_name, 'viewer'), b.until, b.reason, b.created_at
    from public.chat_bans b left join public.profiles p on p.id = b.user_id
   where b.until is null or b.until > now()
   order by b.created_at desc;
end $$;

-- ------------------------------------------------------------- grants
revoke execute on function public.send_chat(text, boolean), public.report_chat(bigint),
  public.save_push_token(text, text), public.set_chat_notify(boolean),
  public.admin_chat_delete(bigint), public.admin_chat_clear(), public.admin_chat_ban(uuid, int, text),
  public.admin_chat_unban(uuid), public.admin_chat_reports(), public.admin_chat_bans() from public, anon;
grant execute on function public.send_chat(text, boolean), public.report_chat(bigint),
  public.save_push_token(text, text), public.set_chat_notify(boolean),
  public.admin_chat_delete(bigint), public.admin_chat_clear(), public.admin_chat_ban(uuid, int, text),
  public.admin_chat_unban(uuid), public.admin_chat_reports(), public.admin_chat_bans() to authenticated;
revoke execute on function public.chat_push_targets(text, uuid) from public;
grant execute on function public.chat_push_targets(text, uuid) to anon, authenticated;

-- ------------------------------------------------------------- live updates
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_messages') then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;
end $$;
