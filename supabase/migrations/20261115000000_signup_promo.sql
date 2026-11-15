-- =====================================================================
-- Welcome promotion: every new account gets a plan (default Premium) for
-- N days (default 30), once. Given when the email is confirmed, or at
-- sign-up when it already is (Google). Owner controls it in Admin → Plans.
-- =====================================================================
insert into public.site_settings (key, value) values
  ('signup_promo_on', '1'), ('signup_promo_plan', 'premium'), ('signup_promo_days', '30')
on conflict (key) do nothing;

create or replace function public.grant_signup_promo(u uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  plan text := coalesce(nullif((select value from public.site_settings where key = 'signup_promo_plan'), ''), 'premium');
  n_days int := greatest(1, public.setting_int('signup_promo_days', 30));
begin
  if coalesce((select value from public.site_settings where key = 'signup_promo_on'), '0') <> '1' then return; end if;
  if not exists (select 1 from public.plans where id = plan) then return; end if;
  insert into public.subscriptions (user_id, plan_id, status, provider, provider_ref, current_period_end)
  values (u, plan, 'active', 'manual', 'promo-signup-' || u, now() + make_interval(days => n_days))
  on conflict (provider, provider_ref) do nothing;
end $$;
revoke execute on function public.grant_signup_promo(uuid) from public, anon, authenticated;

create or replace function public.on_email_confirmed()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    perform public.count_referral(new.id);
    perform public.grant_signup_promo(new.id);
  end if;
  return new;
end $$;

create or replace function public.on_user_created_promo()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null then
    perform public.grant_signup_promo(new.id);
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created_promo' and tgrelid = 'auth.users'::regclass) then
    create trigger on_auth_user_created_promo after insert on auth.users
      for each row execute function public.on_user_created_promo();
  end if;
end $$;
