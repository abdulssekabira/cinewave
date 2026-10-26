# CineWave

Movie streaming platform — website + Android app on one shared backend.

```
cinewave/
├─ apps/
│  ├─ web/        Next.js 16 website (catalogue, title pages, accounts, plans)
│  └─ mobile/     Expo (React Native) Android app
├─ packages/
│  └─ shared/     Types, data access and business rules used by BOTH apps
└─ supabase/
   ├─ migrations/ Database schema, access rules (RLS), storage bucket
   ├─ seed.sql    Sample plans, genres, 9 placeholder titles + 2 partner films
   └─ tests/      Access-rule checks
```

## Design

| | Website | Android app |
|---|---|---|
| Look | Cinematic, poster-led (CineStream reference) | Rounded cards, bottom tabs (mobile reference) |
| Accent | Red `#e5192e` — `--accent` in `apps/web/app/globals.css` | Orange `#ff7a2f` — `colors.accent` in `apps/mobile/lib/theme.ts` |
| Fonts | Bebas Neue (titles) + Inter, self-hosted | Plus Jakarta Sans |
| Home | Rotating hero with Play / More Info, rows with page dots | Greeting, swipeable hero cards, Continue Watching, rows |
| Title | Full-bleed art, chips, cast, details | Full-bleed art, chips, synopsis, cast, Watch Now bar |
| Player | Overlay player: title, rating, synopsis, seek bar, volume, settings, full screen, keyboard shortcuts | Phase 3 |

Posters without a wide backdrop are shown as blurred fill + sharp key art on the right (desktop) or full-bleed (phone). Upload a 16:9 backdrop for the best hero.

## What works today (Phase 2 foundation)

| Area | Web | Android |
|---|---|---|
| Home: featured hero + Trending, Recently Added, Free to Watch, curated rows | ✅ | ✅ |
| Continue Watching row (from saved progress) | ✅ | ✅ |
| Title page: details, genres, languages, related titles | ✅ | ✅ |
| Browse/search with genre, access and sort filters | ✅ | ✅ (search + genre) |
| Sign up, sign in, sign out, email confirmation, password reset | ✅ | ✅ (no reset yet) |
| My List (watchlist), synced across devices | ✅ | ✅ |
| Account: plan status, profile, country | ✅ | ✅ (plan status) |
| Plans page (prices from database) | ✅ | ✅ |
| Play / Download buttons decided by server-side entitlement | ✅ | ✅ |
| Video playback | Phase 3 | Phase 3 |
| Checkout / Google Play billing | Phase 4 | Phase 4 |
| Offline downloads | — | Phase 5 |
| Admin dashboard | Next | — |

## How access is decided

The **database** decides what each person can see and play — the apps only display the result.

- A title appears in the catalogue only if it is **published** *and* has an **active rights window**.
- `playback_entitlement(title, country)` returns `can_play`, `can_download` and a reason:
  `ok`, `sign_in_required`, `upgrade_required`, `not_available_in_region`, `not_found`.
- Plans are ranked (Free 0 → Standard 1 → Premium 2). A higher plan unlocks everything below it.
- Downloads need **both** a rights window that allows downloads **and** a plan that includes them.
- Rights, partners and contracts are visible to staff only. Users can never grant themselves a plan or admin role.

The seed data includes deliberate test cases: a **draft** title and an **expired** licence (both hidden), and a title licensed only in **AE, UG, KE**.

---

## Setup (Windows)

### 1. Install once
- **Node.js 22 LTS** — https://nodejs.org
- **Git** — https://git-scm.com
- **Android Studio** with an emulator, *or* an Android phone with the **Expo Go** app

### 2. Create the Supabase project
1. Create a **new** project at https://supabase.com (separate from the trainer app).
2. Open **SQL Editor** and run these files **in order**, one at a time:
   1. `supabase/migrations/20261027000000_init.sql`
   2. `supabase/migrations/20261027000100_storage.sql`
   3. `supabase/migrations/20261027000200_ratings.sql`
   4. `supabase/seed.sql`
3. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000`
   - Redirect URLs: add `http://localhost:3000/auth/confirm`
4. **Project Settings → API**: copy the **Project URL** and **anon public** key.

> Prefer the command line? With the Supabase CLI: `supabase link` then `supabase db push`, then run `seed.sql`.

### 3. Run the website
```bash
npm install                                  # from the cinewave folder, installs everything
copy apps\web\.env.example apps\web\.env.local   # then paste your URL and anon key
npm run web                                  # http://localhost:3000
```

### 4. Run the Android app
```bash
copy apps\mobile\.env.example apps\mobile\.env   # same URL and anon key
# EXPO_PUBLIC_SITE_URL lets the app load sample posters from the website:
#   emulator → http://10.0.2.2:3000     phone → http://YOUR-PC-IP:3000
npm run android                              # opens in the emulator
# or: npm run mobile, then scan the QR code with Expo Go on your phone
```

### 5. Make yourself an admin
Sign up on the website, then run in the SQL Editor:
```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'YOUR@EMAIL.COM';
```

### 6. Test a paid plan without payments
```sql
insert into public.subscriptions (user_id, plan_id, status, provider, current_period_end)
select id, 'premium', 'active', 'manual', now() + interval '30 days'
from auth.users where email = 'YOUR@EMAIL.COM';
```
Premium titles will now show **Play**, and download-eligible titles show **Download** on Android.

---

## Rules to keep

- **Never** put the Supabase `service_role` key, Mux secrets or Stripe secrets in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variables. Those are visible to anyone.
- New tables need `enable row level security` and policies in a **new migration file** — never edit an old one once it has run.
- Every placeholder title says "Sample title". Replace them with partner films, each with its **contract reference** in `rights`.
- **Retribution** and **Masterplan** are seeded with `DEV-ONLY-NO-CONTRACT` rights so you can see real artwork locally. Do **not** publish them until each has a signed agreement covering streaming, territories and the poster art. Masterplan's poster is branded as an Amazon Prime original, so confirm who holds its distribution rights before using it.
- Ratings must always state a source (`rating_source`). Sample ratings are labelled "Sample data".

## Next steps

1. **Admin dashboard** (web): titles, artwork upload, rights windows, featured rows.
2. **Pick the video provider** (Mux, Cloudflare Stream or Bitmovin). Confirm whether partners require DRM.
3. **Phase 3 playback**: signed playback tokens issued only when `playback_entitlement` says `ok`, plus progress saving (`saveProgress` is already in `packages/shared`).
