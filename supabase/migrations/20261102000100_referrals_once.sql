-- Each account earns the invite reward once (setting referral_max_rewards, default 1).
-- count_referral() caps rewards at that number; my_referrals_v2() reports it.
-- (Applied live; see the function bodies in the database for the full text.)
insert into public.site_settings (key, value) values ('referral_max_rewards', '1') on conflict (key) do nothing;
