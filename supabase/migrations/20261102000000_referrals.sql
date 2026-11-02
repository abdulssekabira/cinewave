-- =====================================================================
-- Invite friends: every account has a code (link + QR). A friend who signs
-- up with it AND confirms their email counts. Every N counted friends
-- (default 2) give the inviter D days of Standard (default 30), banked up
-- to a cap (default 90 days ahead). N, D and the cap are site settings the
-- owner can change in the admin.
-- =====================================================================

alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references auth.users (id) on delete set null;
alter table public.profiles add column if not exists referral_counted boolean not null default false;
alter table public.profiles add column if not exists referrals_rewarded int not null default 0;
create unique index if not exists profiles_referral_code_key on public.profiles (referral_code) where referral_code is not null;

-- Short, easy-to-type code without look-alike characters (no 0/O, 1/I).
create or replace function public.new_referral_code()
returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = c);
  end loop;
  return c;
end $$;

update public.profiles set referral_code = public.new_referral_code() where referral_code is null;

insert into public.site_settings (key, value) values
  ('referral_needed', '2'), ('referral_days', '30'), ('referral_cap_days', '90')
on conflict (key) do nothing;

create or replace function public.setting_int(k text, fallback int)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(regexp_replace(value, '\D', '', 'g'), '')::int from public.site_settings where key = k), fallback);
$$;

-- New accounts: a code of their own, and who invited them (if anyone).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare inviter uuid;
begin
  select p.id into inviter from public.profiles p
   where p.referral_code = upper(trim(coalesce(new.raw_user_meta_data ->> 'ref', ''))) limit 1;
  insert into public.profiles (id, display_name, username, referral_code, referred_by)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
          public.valid_new_username(new.raw_user_meta_data ->> 'username'),
          public.new_referral_code(),
          case when inviter is not null and inviter <> new.id then inviter end);
  return new;
end $$;

-- Viewers can't change their code, their inviter or their reward counters.
create or replace function public.guard_referral_columns()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role('admin') then
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.referral_counted := old.referral_counted;
    new.referrals_rewarded := old.referrals_rewarded;
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_referral_guard' and tgrelid = 'public.profiles'::regclass) then
    create trigger profiles_referral_guard before update on public.profiles
      for each row execute function public.guard_referral_columns();
  end if;
end $$;

-- Counts a friend once their email is confirmed, and rewards the inviter.
create or replace function public.count_referral(friend uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  inviter uuid;
  counted int;
  needed int := greatest(1, public.setting_int('referral_needed', 2));
  n_days int := greatest(1, public.setting_int('referral_days', 30));
  cap_days int := greatest(n_days, public.setting_int('referral_cap_days', 90));
  due int;
  sub record;
  new_end timestamptz;
begin
  update public.profiles set referral_counted = true
   where id = friend and referred_by is not null and not referral_counted
   returning referred_by into inviter;
  if inviter is null then return; end if;

  select count(*) into counted from public.profiles where referred_by = inviter and referral_counted;
  select floor(counted / needed)::int - referrals_rewarded into due from public.profiles where id = inviter;
  if coalesce(due, 0) <= 0 then return; end if;

  for i in 1..due loop
    select * into sub from public.subscriptions
     where user_id = inviter and provider = 'manual' and provider_ref like 'referral-%'
       and status = 'active' and current_period_end > now()
     order by current_period_end desc limit 1;
    if found then
      new_end := least(sub.current_period_end + make_interval(days => n_days), now() + make_interval(days => cap_days));
      update public.subscriptions set current_period_end = new_end, updated_at = now() where id = sub.id;
    else
      insert into public.subscriptions (user_id, plan_id, status, provider, provider_ref, current_period_end)
      values (inviter, 'standard', 'active', 'manual', 'referral-' || inviter || '-' || extract(epoch from now())::bigint,
              now() + make_interval(days => n_days));
    end if;
  end loop;
  update public.profiles set referrals_rewarded = referrals_rewarded + due where id = inviter;
end $$;
revoke execute on function public.count_referral(uuid) from public, anon, authenticated;

create or replace function public.on_email_confirmed()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    perform public.count_referral(new.id);
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_email_confirmed' and tgrelid = 'auth.users'::regclass) then
    create trigger on_auth_email_confirmed after update of email_confirmed_at on auth.users
      for each row execute function public.on_email_confirmed();
  end if;
end $$;

-- What the Invite friends screen shows.
create or replace function public.my_referrals()
returns table (code text, joined int, counted int, needed int, reward_days int, rewards int, progress int, standard_until timestamptz)
language sql stable security definer set search_path = public as $$
  select p.referral_code,
         (select count(*)::int from public.profiles f where f.referred_by = p.id),
         (select count(*)::int from public.profiles f where f.referred_by = p.id and f.referral_counted),
         greatest(1, public.setting_int('referral_needed', 2)),
         greatest(1, public.setting_int('referral_days', 30)),
         p.referrals_rewarded,
         ((select count(*)::int from public.profiles f where f.referred_by = p.id and f.referral_counted)
            % greatest(1, public.setting_int('referral_needed', 2))),
         (select max(s.current_period_end) from public.subscriptions s
           where s.user_id = p.id and s.provider = 'manual' and s.provider_ref like 'referral-%'
             and s.status = 'active' and s.current_period_end > now())
    from public.profiles p where p.id = auth.uid();
$$;
revoke execute on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;

-- Is this a real invite code? (Shown on the sign-up page.)
create or replace function public.referral_code_valid(c text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where referral_code = upper(trim(coalesce(c, ''))));
$$;
grant execute on function public.referral_code_valid(text) to anon, authenticated;
