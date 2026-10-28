-- =====================================================================
-- Payments (Pesapal: MTN MoMo, Airtel Money, cards)
--
-- Flow: the signed-in viewer starts a checkout -> create_payment() records
-- a pending payment with the price taken from public.plans (never from the
-- browser). The web server sends the order to Pesapal, then, when Pesapal
-- reports back (redirect or IPN), the server asks Pesapal for the real
-- status and calls settle_payment(). Only the web server can settle,
-- because those functions require a server secret whose hash is stored here.
-- =====================================================================

create table if not exists public.payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  plan_id           text not null references public.plans (id),
  period            text not null check (period in ('week', 'month')),
  amount            int  not null check (amount > 0),
  currency          char(3) not null,
  merchant_ref      text not null unique,
  provider          public.payment_provider not null default 'pesapal',
  provider_ref      text unique,               -- Pesapal order_tracking_id
  sandbox           boolean not null default false,
  status            text not null default 'pending'
                    check (status in ('pending', 'completed', 'failed', 'reversed', 'invalid')),
  method            text,
  confirmation_code text,
  subscription_id   uuid references public.subscriptions (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
alter table public.payments enable row level security;
create policy "read own payments" on public.payments for select using (user_id = auth.uid());
create policy "admins read payments" on public.payments for select using (public.has_role('admin'));

-- ----------------------------------------------------------- server secret
create or replace function public.server_secret_ok(s text)
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select s is not null and length(s) >= 32 and exists (
    select 1 from public.app_secrets
     where key = 'server_secret_hash'
       and value = encode(extensions.digest(s, 'sha256'), 'hex'));
$$;
revoke execute on function public.server_secret_ok(text) from public;
grant execute on function public.server_secret_ok(text) to anon, authenticated;

create or replace function public.set_server_secret_hash(h text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admins only'; end if;
  if h !~ '^[0-9a-f]{64}$' then raise exception 'bad hash'; end if;
  insert into public.app_secrets (key, value) values ('server_secret_hash', h)
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
revoke execute on function public.set_server_secret_hash(text) from public, anon;
grant execute on function public.set_server_secret_hash(text) to authenticated;

-- Small key/value store for server settings (e.g. Pesapal IPN id).
create or replace function public.server_kv_get(s text, k text)
returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.server_secret_ok(s) then raise exception 'forbidden'; end if;
  return (select value from public.app_secrets where key = 'kv:' || k);
end $$;

create or replace function public.server_kv_set(s text, k text, v text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.server_secret_ok(s) then raise exception 'forbidden'; end if;
  insert into public.app_secrets (key, value) values ('kv:' || k, v)
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
revoke execute on function public.server_kv_get(text, text) from public;
revoke execute on function public.server_kv_set(text, text, text) from public;
grant execute on function public.server_kv_get(text, text) to anon, authenticated;
grant execute on function public.server_kv_set(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------- checkout start
-- Price comes from the plans table. Returns the new pending payment.
create or replace function public.create_payment(p_plan text, p_period text, p_sandbox boolean default false)
returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  pl  public.plans;
  amt int;
  row public.payments;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into pl from public.plans where id = p_plan and active and id <> 'free';
  if not found then raise exception 'plan not available'; end if;
  amt := case p_period when 'week' then pl.weekly_price_cents when 'month' then pl.price_cents end;
  if amt is null or amt <= 0 then raise exception 'this plan has no % price', p_period; end if;
  if (select count(*) from public.payments
       where user_id = auth.uid() and status = 'pending' and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many attempts, try again later';
  end if;
  insert into public.payments (user_id, plan_id, period, amount, currency, merchant_ref, sandbox)
  values (auth.uid(), pl.id, p_period, amt, pl.currency,
          'GLE-' || to_char(now() at time zone 'Africa/Kampala', 'YYMMDD') || '-' ||
          upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
          coalesce(p_sandbox, false))
  returning * into row;
  return row;
end $$;
revoke execute on function public.create_payment(text, text, boolean) from public, anon;
grant execute on function public.create_payment(text, text, boolean) to authenticated;

create or replace function public.attach_payment_tracking(s text, p_merchant_ref text, p_tracking text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.server_secret_ok(s) then raise exception 'forbidden'; end if;
  update public.payments set provider_ref = p_tracking, updated_at = now()
   where merchant_ref = p_merchant_ref and provider_ref is null;
end $$;
revoke execute on function public.attach_payment_tracking(text, text, text) from public;
grant execute on function public.attach_payment_tracking(text, text, text) to anon, authenticated;

-- ------------------------------------------------------------- settlement
-- Called by the server with the status Pesapal itself reported.
-- status_code: 0 invalid/not paid yet, 1 completed, 2 failed, 3 reversed.
create or replace function public.settle_payment(
  s text, p_tracking text, p_status_code int, p_amount numeric, p_currency text,
  p_method text default null, p_confirmation text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  pay  public.payments;
  sub  public.subscriptions;
  span interval;
begin
  if not public.server_secret_ok(s) then raise exception 'forbidden'; end if;
  select * into pay from public.payments where provider_ref = p_tracking for update;
  if not found then raise exception 'unknown payment'; end if;
  span := case pay.period when 'week' then interval '7 days' else interval '1 month' end;

  if p_status_code = 1 then
    if pay.status = 'completed' then return 'completed'; end if;
    if p_amount < pay.amount or upper(p_currency) <> pay.currency then
      update public.payments set status = 'invalid', method = p_method, confirmation_code = p_confirmation,
             updated_at = now() where id = pay.id;
      return 'invalid';
    end if;
    -- Extend an existing Pesapal subscription to the same plan, else start one.
    select * into sub from public.subscriptions
     where user_id = pay.user_id and plan_id = pay.plan_id and provider = 'pesapal'
       and status = 'active' and current_period_end > now()
     order by current_period_end desc limit 1 for update;
    if found then
      update public.subscriptions set current_period_end = sub.current_period_end + span
       where id = sub.id;
    else
      insert into public.subscriptions (user_id, plan_id, status, provider, provider_ref, current_period_end)
      values (pay.user_id, pay.plan_id, 'active', 'pesapal', pay.merchant_ref, now() + span)
      returning * into sub;
    end if;
    update public.payments set status = 'completed', method = p_method, confirmation_code = p_confirmation,
           subscription_id = sub.id, updated_at = now() where id = pay.id;
    return 'completed';

  elsif p_status_code = 3 then
    if pay.status = 'completed' and pay.subscription_id is not null then
      update public.subscriptions set current_period_end = current_period_end - span
       where id = pay.subscription_id;
    end if;
    update public.payments set status = 'reversed', updated_at = now() where id = pay.id;
    return 'reversed';

  elsif p_status_code = 2 then
    if pay.status = 'pending' then
      update public.payments set status = 'failed', method = p_method, updated_at = now() where id = pay.id;
    end if;
    return (select status from public.payments where id = pay.id);
  end if;

  return pay.status;  -- 0: not paid yet, leave as is
end $$;
revoke execute on function public.settle_payment(text, text, int, numeric, text, text, text) from public;
grant execute on function public.settle_payment(text, text, int, numeric, text, text, text) to anon, authenticated;
