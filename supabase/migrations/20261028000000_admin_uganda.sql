-- =====================================================================
-- Uganda pricing + admin dashboard support
-- =====================================================================

-- Prices are stored in the currency's smallest unit. UGX has no cents,
-- so 15000 means UGX 15,000.
comment on column public.plans.price_cents is
  'Monthly price in the currency''s smallest unit (UGX has none: 15000 = UGX 15,000)';

-- Weekly passes suit mobile-money users.
alter table public.plans add column weekly_price_cents int check (weekly_price_cents >= 0);
alter table public.plans alter column currency set default 'UGX';

-- Admins can grant/cancel complimentary ('manual') subscriptions from the
-- dashboard. Paid subscriptions are still written only by payment webhooks.
create policy "admins manage manual subscriptions" on public.subscriptions
  for all
  using (public.has_role('admin') and provider = 'manual')
  with check (public.has_role('admin') and provider = 'manual');

-- User list for admins (emails live in auth.users, which apps can't read).
create or replace function public.admin_list_users(search text default null)
returns table (
  id uuid,
  email text,
  display_name text,
  country_code char(2),
  created_at timestamptz,
  plan text,
  manual_subscription_id uuid,
  manual_until timestamptz,
  roles text[]
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role('admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    u.email::text,
    p.display_name,
    p.country_code,
    p.created_at,
    coalesce((
      select s.plan_id from public.subscriptions s join public.plans pl on pl.id = s.plan_id
       where s.user_id = u.id and s.status in ('trialing', 'active', 'past_due')
         and (s.current_period_end is null or s.current_period_end > now())
       order by pl.rank desc limit 1), 'free') as plan,
    (select s.id from public.subscriptions s
      where s.user_id = u.id and s.provider = 'manual' and s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())
      order by s.current_period_end desc nulls first limit 1) as manual_subscription_id,
    (select s.current_period_end from public.subscriptions s
      where s.user_id = u.id and s.provider = 'manual' and s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())
      order by s.current_period_end desc nulls first limit 1) as manual_until,
    coalesce((select array_agg(r.role::text order by r.role) from public.user_roles r where r.user_id = u.id), '{}') as roles
  from auth.users u
  left join public.profiles p on p.id = u.id
  where search is null or search = ''
     or u.email ilike '%' || search || '%'
     or p.display_name ilike '%' || search || '%'
  order by p.created_at desc nulls last
  limit 200;
end $$;

grant execute on function public.admin_list_users(text) to authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.has_role(public.app_role) to anon, authenticated;
