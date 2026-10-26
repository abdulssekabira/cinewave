-- =====================================================================
-- Development seed data. Titles are PLACEHOLDERS — replace them with
-- your partners' real films and contract references before launch.
-- =====================================================================

insert into public.plans
  (id, name, rank, price_cents, annual_price_cents, currency, shows_ads, max_quality, downloads_allowed, max_streams)
values
  ('free',     'Free',     0,    0, null,  'USD', true,  '720p',  false, 1),
  ('standard', 'Standard', 1,  499, 4990,  'USD', false, '1080p', false, 2),
  ('premium',  'Premium',  2,  999, 9990,  'USD', false, '1080p', true,  4)
on conflict (id) do nothing;

insert into public.genres (slug, name) values
  ('action', 'Action'), ('drama', 'Drama'), ('comedy', 'Comedy'),
  ('thriller', 'Thriller'), ('sci-fi', 'Sci-Fi'), ('romance', 'Romance'),
  ('documentary', 'Documentary'), ('family', 'Family'), ('horror', 'Horror'),
  ('animation', 'Animation')
on conflict (slug) do nothing;

insert into public.partners (id, name, contact_name, notes) values
  ('00000000-0000-4000-8000-000000000001', 'Sample Partner Studio', 'Replace me',
   'Placeholder partner for development. Replace with real partner and agreement.');

-- Placeholder titles (no artwork: the apps render a generated poster).
insert into public.titles
  (id, slug, title, tagline, synopsis, release_year, runtime_minutes, maturity_rating,
   original_language, audio_languages, subtitle_languages, credits, required_plan,
   status, is_featured, popularity)
values
  ('10000000-0000-4000-8000-000000000001', 'tides-of-kampala', 'Tides of Kampala',
   'One city. Seven days. No way back.',
   'A courier racing across the city uncovers a ledger that powerful people want buried. Sample title — replace with a partner film.',
   2025, 112, '16+', 'en', '{en}', '{en,fr,ar}',
   '[{"name":"Sample Director","role":"Director"},{"name":"Sample Lead","role":"Cast"}]',
   'free', 'published', true, 980),
  ('10000000-0000-4000-8000-000000000002', 'the-last-signal', 'The Last Signal',
   'Somebody is still out there.',
   'A radio operator at a remote station hears a voice that should not exist. Sample title.',
   2024, 98, '13+', 'en', '{en}', '{en,es}', '[]', 'standard', 'published', false, 870),
  ('10000000-0000-4000-8000-000000000003', 'salt-and-honey', 'Salt & Honey',
   'Some recipes are family secrets for a reason.',
   'Two estranged sisters reopen their late mother''s restaurant. Sample title.',
   2023, 104, 'PG', 'en', '{en}', '{en,ar}', '[]', 'free', 'published', false, 760),
  ('10000000-0000-4000-8000-000000000004', 'glass-horizon', 'Glass Horizon',
   'The future was supposed to be clear.',
   'In 2091 a city under a dome votes on whether to open its doors. Sample title.',
   2026, 127, '13+', 'en', '{en}', '{en}', '[]', 'premium', 'published', true, 1200),
  ('10000000-0000-4000-8000-000000000005', 'night-market', 'Night Market',
   'Everything has a price after midnight.',
   'A pickpocket and a detective strike an uneasy deal. Sample title.',
   2022, 95, '16+', 'en', '{en}', '{en}', '[]', 'standard', 'published', false, 640),
  ('10000000-0000-4000-8000-000000000006', 'little-giants', 'Little Giants of the Savannah',
   'Small creatures. Big lives.',
   'A family documentary following the smallest animals of the plains. Sample title.',
   2021, 81, 'G', 'en', '{en}', '{en,fr}', '[]', 'free', 'published', false, 520),
  ('10000000-0000-4000-8000-000000000007', 'paper-crowns', 'Paper Crowns',
   'Love is the oldest con.',
   'A wedding planner falls for the groom''s best man — a known fraudster. Sample title.',
   2025, 101, '13+', 'en', '{en}', '{en}', '[]', 'standard', 'published', false, 690),
  ('10000000-0000-4000-8000-000000000008', 'below-the-red-earth', 'Below the Red Earth',
   'The mine remembers.',
   'Miners trapped underground start hearing footsteps. Sample title.',
   2024, 93, '18+', 'en', '{en}', '{en}', '[]', 'premium', 'published', false, 810),
  ('10000000-0000-4000-8000-000000000009', 'draft-unreleased', 'Unreleased Draft',
   null, 'This draft must never appear in the public catalogue.',
   2026, 90, 'PG', 'en', '{en}', '{}', '[]', 'free', 'draft', false, 0);

insert into public.title_genres (title_id, genre_id)
select t.id, g.id from (values
  ('10000000-0000-4000-8000-000000000001', 'thriller'),
  ('10000000-0000-4000-8000-000000000001', 'action'),
  ('10000000-0000-4000-8000-000000000002', 'sci-fi'),
  ('10000000-0000-4000-8000-000000000002', 'thriller'),
  ('10000000-0000-4000-8000-000000000003', 'drama'),
  ('10000000-0000-4000-8000-000000000003', 'family'),
  ('10000000-0000-4000-8000-000000000004', 'sci-fi'),
  ('10000000-0000-4000-8000-000000000004', 'drama'),
  ('10000000-0000-4000-8000-000000000005', 'thriller'),
  ('10000000-0000-4000-8000-000000000006', 'documentary'),
  ('10000000-0000-4000-8000-000000000006', 'family'),
  ('10000000-0000-4000-8000-000000000007', 'romance'),
  ('10000000-0000-4000-8000-000000000007', 'comedy'),
  ('10000000-0000-4000-8000-000000000008', 'horror')
) as v(title_id, genre_slug)
join public.titles t on t.id = v.title_id::uuid
join public.genres g on g.slug = v.genre_slug;

-- Rights windows. Title 5 ('night-market') has an EXPIRED window, so it
-- must not appear in the catalogue — a built-in test of rights logic.
insert into public.rights
  (title_id, partner_id, contract_ref, territories, starts_at, ends_at,
   allow_stream, allow_download, allow_ads, download_expiry_hours)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'SAMPLE-001', '{*}',  now() - interval '30 days', null, true, true,  true, 48),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'SAMPLE-002', '{*}',  now() - interval '30 days', null, true, false, true, null),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'SAMPLE-003', '{*}',  now() - interval '30 days', null, true, true,  true, 72),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'SAMPLE-004', '{*}',  now() - interval '30 days', null, true, true,  false, 48),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'SAMPLE-005', '{*}',  now() - interval '400 days', now() - interval '1 day', true, false, true, null),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'SAMPLE-006', '{*}',  now() - interval '30 days', null, true, false, true, null),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', 'SAMPLE-007', '{AE,UG,KE}', now() - interval '30 days', null, true, false, true, null),
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', 'SAMPLE-008', '{*}',  now() - interval '30 days', null, true, true,  false, 24),
  ('10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 'SAMPLE-009', '{*}',  now() - interval '30 days', null, true, false, true, null);

insert into public.collections (slug, name, sort_order) values
  ('staff-picks', 'Staff Picks', 1);

insert into public.collection_items (collection_id, title_id, position)
select c.id, t.id, row_number() over ()
from public.collections c, public.titles t
where c.slug = 'staff-picks'
  and t.slug in ('salt-and-honey', 'glass-horizon', 'little-giants');

-- ---------------------------------------------------------------------
-- Sample ratings (clearly labelled as sample data).
-- ---------------------------------------------------------------------
update public.titles set rating = v.r, rating_source = 'Sample data'
from (values
  ('tides-of-kampala', 7.9), ('the-last-signal', 7.2), ('salt-and-honey', 8.1),
  ('glass-horizon', 8.4), ('night-market', 6.8), ('little-giants', 7.6),
  ('paper-crowns', 6.9), ('below-the-red-earth', 7.1)
) as v(slug, r)
where titles.slug = v.slug;

-- ---------------------------------------------------------------------
-- Partner films supplied by the owner (artwork in apps/web/public/sample).
-- DEV ONLY: the rights rows below are placeholders. Before these titles go
-- live, replace them with the signed agreement for each film (territories,
-- dates, ads, downloads). Synopses and years must come from the partner.
-- ---------------------------------------------------------------------
insert into public.titles
  (id, slug, title, tagline, synopsis, release_year, runtime_minutes, maturity_rating,
   original_language, audio_languages, subtitle_languages, credits, poster_url,
   required_plan, status, is_featured, popularity)
values
  ('20000000-0000-4000-8000-000000000001', 'rise-of-the-footsoldier-retribution',
   'Rise of the Footsoldier: Retribution', 'Revenge comes to Ibiza.',
   'Synopsis to be supplied by the partner.', null, null, '18+',
   'en', '{en}', '{en}',
   '[{"name":"Nick Nevern","role":"Director"},{"name":"Craig Fairbrass","role":"Cast"}]',
   '/sample/retribution.jpg', 'standard', 'published', true, 1500),
  ('20000000-0000-4000-8000-000000000002', 'masterplan',
   'Masterplan', null,
   'Synopsis to be supplied by the partner.', null, null, null,
   'en', '{en}', '{en}', '[]',
   '/sample/masterplan.jpg', 'premium', 'published', true, 1400);

insert into public.title_genres (title_id, genre_id)
select t.id, g.id from (values
  ('20000000-0000-4000-8000-000000000001', 'action'),
  ('20000000-0000-4000-8000-000000000001', 'thriller'),
  ('20000000-0000-4000-8000-000000000002', 'comedy')
) as v(title_id, genre_slug)
join public.titles t on t.id = v.title_id::uuid
join public.genres g on g.slug = v.genre_slug;

insert into public.rights
  (title_id, partner_id, contract_ref, territories, starts_at, ends_at,
   allow_stream, allow_download, allow_ads, notes)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
   'DEV-ONLY-NO-CONTRACT', '{*}', now() - interval '1 day', null, true, false, false,
   'Placeholder for local testing. Replace with the signed agreement before launch.'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
   'DEV-ONLY-NO-CONTRACT', '{*}', now() - interval '1 day', null, true, false, false,
   'Placeholder for local testing. Replace with the signed agreement before launch.');
