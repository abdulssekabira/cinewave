-- Plan details the owner edits from Admin → Plans.
alter table public.plans
  add column if not exists description text,
  add column if not exists features text[] not null default '{}';

-- The Free plan must always exist and stay free.
alter table public.plans drop constraint if exists plans_free_is_free;
alter table public.plans add constraint plans_free_is_free
  check (id <> 'free' or (price_cents = 0 and coalesce(weekly_price_cents, 0) = 0
                          and coalesce(annual_price_cents, 0) = 0 and active));
alter table public.plans drop constraint if exists plans_prices_positive;
alter table public.plans add constraint plans_prices_positive
  check (price_cents >= 0 and coalesce(annual_price_cents, 0) >= 0 and max_streams between 1 and 10);
