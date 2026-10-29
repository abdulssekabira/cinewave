-- =====================================================================
-- Usernames (sign in with username or email) and a device limit per plan.
-- =====================================================================

-- ------------------------------------------------------------- usernames
alter table public.profiles add column if not exists username text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format
      check (username is null or username ~ '^[a-z0-9_.]{3,20}$');
  end if;
end $$;
create unique index if not exists profiles_username_key on public.profiles (username);

create or replace function public.valid_new_username(u text)
returns text
language sql stable security definer set search_path = public as $$
  select case
    when lower(trim(u)) ~ '^[a-z0-9_.]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(trim(u)))
    then lower(trim(u)) end;
$$;
revoke execute on function public.valid_new_username(text) from public, anon, authenticated;

-- Anyone may check whether a username is free (no other details leak).
create or replace function public.username_available(u text)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.valid_new_username(u) is not null;
$$;
revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Only the web server may turn a username into an email (for sign-in).
create or replace function public.email_for_username(s text, u text)
returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.server_secret_ok(s) then raise exception 'forbidden'; end if;
  return (select au.email from public.profiles p join auth.users au on au.id = p.id
           where p.username = lower(trim(u)));
end $$;
revoke execute on function public.email_for_username(text, text) from public;
grant execute on function public.email_for_username(text, text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, username)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
          public.valid_new_username(new.raw_user_meta_data ->> 'username'));
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- --------------------------------------------------------------- devices
-- A "device" is a signed-in session (phone, browser, app). Sessions not
-- used for 30 days stop counting. The earliest devices keep access; a new
-- device beyond the plan's limit can browse but not play until the owner
-- removes one in Account → Devices.
alter table public.plans add column if not exists max_devices int
  check (max_devices is null or max_devices between 1 and 20);
update public.plans set max_devices = 3 where id in ('standard', 'premium') and max_devices is null;

create or replace function public.my_devices()
returns table (session_id uuid, user_agent text, ip text, signed_in_at timestamptz,
               last_active timestamptz, is_current boolean, allowed boolean)
language sql stable security definer set search_path = public, auth as $$
  with lim as (
    select p.max_devices from public.plans p where p.id = public.current_plan()
  ), active as (
    select s.id, s.user_agent, host(s.ip) as ip, s.created_at,
           coalesce(s.refreshed_at, s.updated_at, s.created_at) as last_active,
           row_number() over (order by s.created_at) as n
      from auth.sessions s
     where s.user_id = auth.uid()
       and coalesce(s.refreshed_at, s.updated_at, s.created_at) > now() - interval '30 days'
       and (s.not_after is null or s.not_after > now())
  )
  select a.id, a.user_agent, a.ip, a.created_at, a.last_active,
         a.id::text = coalesce(auth.jwt() ->> 'session_id', ''),
         (select max_devices from lim) is null or a.n <= (select max_devices from lim)
    from active a
   order by a.created_at;
$$;
revoke execute on function public.my_devices() from public, anon;
grant execute on function public.my_devices() to authenticated;

create or replace function public.device_allowed()
returns boolean
language plpgsql stable security definer set search_path = public, auth as $$
declare lim int; sid text;
begin
  if auth.uid() is null or public.is_staff() then return true; end if;
  select max_devices into lim from public.plans where id = public.current_plan();
  if lim is null then return true; end if;
  sid := auth.jwt() ->> 'session_id';
  if sid is null then return false; end if;
  return exists (select 1 from public.my_devices() d where d.is_current and d.allowed);
end $$;
revoke execute on function public.device_allowed() from public, anon;
grant execute on function public.device_allowed() to authenticated;

-- Ends a device's session: it can no longer refresh, and it stops counting at once.
create or replace function public.remove_device(p_session uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  update auth.sessions set not_after = now() where id = p_session and user_id = auth.uid();
  update auth.refresh_tokens set revoked = true where session_id = p_session and user_id = auth.uid()::text;
end $$;
revoke execute on function public.remove_device(uuid) from public, anon;
grant execute on function public.remove_device(uuid) to authenticated;

-- Playback decision now also checks the device limit.
create or replace function public.playback_entitlement(t_id uuid, country text default null)
returns table (can_play boolean, can_download boolean, reason text, user_plan text, required_plan text)
language plpgsql stable security definer set search_path = public as $$
declare
  t           public.titles;
  u_plan      text := public.current_plan();
  u_rank      int;
  t_rank      int;
  has_rights  boolean;
  dl_rights   boolean;
  plan_dl     boolean;
begin
  select * into t from public.titles where id = t_id and status = 'published';
  if not found then
    return query select false, false, 'not_found', u_plan, null::text; return;
  end if;

  has_rights := public.rights_active(t_id, country, false);
  if not has_rights then
    return query select false, false, 'not_available_in_region', u_plan, t.required_plan; return;
  end if;

  select rank, downloads_allowed into u_rank, plan_dl from public.plans where id = u_plan;
  select rank into t_rank from public.plans where id = t.required_plan;

  if auth.uid() is null and t.required_plan <> 'free' then
    return query select false, false, 'sign_in_required', u_plan, t.required_plan; return;
  end if;

  if u_rank < t_rank then
    return query select false, false, 'upgrade_required', u_plan, t.required_plan; return;
  end if;

  if not public.device_allowed() then
    return query select false, false, 'device_limit', u_plan, t.required_plan; return;
  end if;

  dl_rights := public.rights_active(t_id, country, true);
  return query select true, (dl_rights and plan_dl and auth.uid() is not null), 'ok', u_plan, t.required_plan;
end $$;
