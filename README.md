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
   ├─ seed.sql    Sample plans, genres and 9 placeholder titles
   └─ tests/      Access-rule checks
```

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
   3. `supabase/seed.sql`
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

## Next steps

1. **Admin dashboard** (web): titles, artwork upload, rights windows, featured rows.
2. **Pick the video provider** (Mux, Cloudflare Stream or Bitmovin). Confirm whether partners require DRM.
3. **Phase 3 playback**: signed playback tokens issued only when `playback_entitlement` says `ok`, plus progress saving (`saveProgress` is already in `packages/shared`).
