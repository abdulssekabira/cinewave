-- Access-rule checks. DEV PROJECT ONLY — creates and then deletes two test users.
-- Run with psql (some statements are EXPECTED to fail with RLS errors):
--   psql "$DATABASE_URL" -f supabase/tests/access_rules.sql
\set ON_ERROR_STOP 0
insert into auth.users (id, email) values
 ('aaaaaaaa-0000-4000-8000-000000000001','alice@test.dev'),
 ('bbbbbbbb-0000-4000-8000-000000000002','bob@test.dev');
\echo '1. profiles auto-created (expect 2):'
select count(*) from public.profiles;

set role anon;
\echo '2. anon catalogue (expect 7, no draft, no expired night-market):'
select count(*), bool_or(slug='night-market') as has_expired, bool_or(slug='draft-unreleased') as has_draft from public.catalog_titles;
\echo '3. anon sees rights/partners (expect 0,0):'
select (select count(*) from public.rights), (select count(*) from public.partners);
\echo '4. anon entitlement free title / premium title:'
select reason from public.playback_entitlement('10000000-0000-4000-8000-000000000001');
select reason from public.playback_entitlement('10000000-0000-4000-8000-000000000004');
reset role;

set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
\echo '5. alice plan (free), premium title -> upgrade_required, free title ok w/o download:'
select public.current_plan();
select can_play, can_download, reason from public.playback_entitlement('10000000-0000-4000-8000-000000000004');
select can_play, can_download, reason from public.playback_entitlement('10000000-0000-4000-8000-000000000001');
\echo '6. regional title US vs UG:'
select reason from public.playback_entitlement('10000000-0000-4000-8000-000000000007','US');
select reason from public.playback_entitlement('10000000-0000-4000-8000-000000000007','ug');
\echo '7. watchlist own insert ok, other user insert must FAIL:'
insert into public.watchlist (user_id, title_id) values ('aaaaaaaa-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
insert into public.watchlist (user_id, title_id) values ('bbbbbbbb-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001');
\echo '8. self-grant subscription must FAIL:'
insert into public.subscriptions (user_id, plan_id, status, provider) values ('aaaaaaaa-0000-4000-8000-000000000001','premium','active','manual');
\echo '9. self-grant admin must FAIL:'
insert into public.user_roles values ('aaaaaaaa-0000-4000-8000-000000000001','admin');
\echo '10. profiles visible to alice (expect 1):'
select count(*) from public.profiles;
reset role;

insert into public.subscriptions (user_id, plan_id, status, provider, current_period_end)
values ('aaaaaaaa-0000-4000-8000-000000000001','premium','active','manual', now() + interval '30 days');
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
\echo '11. after premium: plan, premium title can play + download:'
select public.current_plan();
select can_play, can_download, reason from public.playback_entitlement('10000000-0000-4000-8000-000000000004');
reset role;
\echo '12. audit rows:'
select entity, count(*) from public.audit_log group by 1 order by 1;

-- Cleanup: remove the test users (cascades to their data).
delete from auth.users where email in ('alice@test.dev', 'bob@test.dev');
