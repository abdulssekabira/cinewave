-- =====================================================================
-- CineWave — initial schema
-- Catalogue, partners & rights, plans & subscriptions, user data,
-- admin roles and audit log. Row Level Security on every table.
--
-- Principle: the database decides what a user may see and play.
-- The apps only display what these rules allow.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.title_status as enum ('draft', 'published', 'archived');
create type public.subscription_status as enum
  ('trialing', 'active', 'past_due', 'canceled', 'expired', 'refunded');
create type public.payment_provider as enum ('stripe', 'google_play', 'manual');
create type public.app_role as enum ('admin', 'editor');
create type public.media_status as enum ('pending', 'processing', 'ready', 'errored');

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Roles (admin / editor) — separate from auth so it can't be self-assigned
-- ---------------------------------------------------------------------
create table public.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.app_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.has_role(r public.app_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = r
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Profiles (one per auth user, created automatically on sign-up)
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) <= 60),
  country_code  char(2),                 -- ISO 3166-1 alpha-2, drives territory rights
  preferred_language text default 'en',
  marketing_opt_in boolean not null default false,
  deletion_requested_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------
create table public.plans (
  id                text primary key,            -- 'free' | 'standard' | 'premium'
  name              text not null,
  rank              int  not null unique,        -- higher rank unlocks lower-rank content
  price_cents       int  not null default 0,
  annual_price_cents int,
  currency          char(3) not null default 'USD',
  shows_ads         boolean not null default true,
  max_quality       text not null default '720p',
  downloads_allowed boolean not null default false,
  max_streams       int not null default 1,
  stripe_price_monthly text,
  stripe_price_annual  text,
  play_product_id      text,
  active            boolean not null default true
);

-- ---------------------------------------------------------------------
-- Subscriptions — written ONLY by the server (payment webhooks / admin).
-- ---------------------------------------------------------------------
create table public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  plan_id              text not null references public.plans (id),
  status               public.subscription_status not null,
  provider             public.payment_provider not null,
  provider_ref         text,                      -- Stripe sub id / Play purchase token
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index subscriptions_user_idx on public.subscriptions (user_id);
create trigger subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Payment webhook events, stored for idempotency (process each event once).
create table public.payment_events (
  provider      public.payment_provider not null,
  event_id      text not null,
  received_at   timestamptz not null default now(),
  payload       jsonb not null,
  processed_at  timestamptz,
  primary key (provider, event_id)
);

-- The user's effective plan right now. past_due keeps access (grace period).
create or replace function public.current_plan()
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.id
       from public.subscriptions s
       join public.plans p on p.id = s.plan_id
      where s.user_id = auth.uid()
        and s.status in ('trialing', 'active', 'past_due')
        and (s.current_period_end is null or s.current_period_end > now())
      order by p.rank desc
      limit 1),
    'free');
$$;

-- ---------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------
create table public.genres (
  id   serial primary key,
  slug text not null unique,
  name text not null
);

create table public.partners (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  contact_email text,
  notes         text,
  created_at    timestamptz not null default now()
);

create table public.titles (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title            text not null,
  tagline          text,
  synopsis         text,
  release_year     int check (release_year between 1880 and 2100),
  runtime_minutes  int check (runtime_minutes > 0),
  maturity_rating  text,                       -- e.g. 'PG', '13+', '16+'
  content_warnings text[] not null default '{}',
  original_language text,
  audio_languages  text[] not null default '{}',
  subtitle_languages text[] not null default '{}',
  credits          jsonb not null default '[]', -- [{ "name": "...", "role": "Director" }]
  poster_url       text,
  backdrop_url     text,
  trailer_url      text,
  required_plan    text not null default 'free' references public.plans (id),
  status           public.title_status not null default 'draft',
  is_featured      boolean not null default false,
  popularity       int not null default 0,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index titles_status_idx on public.titles (status);
create index titles_title_trgm on public.titles using gin (title extensions.gin_trgm_ops);
create trigger titles_updated before update on public.titles
  for each row execute function public.set_updated_at();

create or replace function public.set_published_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;
create trigger titles_published before insert or update on public.titles
  for each row execute function public.set_published_at();

create table public.title_genres (
  title_id uuid not null references public.titles (id) on delete cascade,
  genre_id int  not null references public.genres (id) on delete cascade,
  primary key (title_id, genre_id)
);

-- Rights: one row per licence/agreement window for a title.
-- territories = '{*}' means worldwide.
create table public.rights (
  id                    uuid primary key default gen_random_uuid(),
  title_id              uuid not null references public.titles (id) on delete cascade,
  partner_id            uuid references public.partners (id) on delete set null,
  contract_ref          text not null,
  territories           text[] not null default '{*}',
  starts_at             timestamptz not null,
  ends_at               timestamptz,
  allow_stream          boolean not null default true,
  allow_download        boolean not null default false,
  allow_ads             boolean not null default true,
  download_expiry_hours int check (download_expiry_hours > 0),
  notes                 text,
  created_at            timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index rights_title_idx on public.rights (title_id);

-- Video files live with the video provider (e.g. Mux). Never exposed directly.
create table public.media_assets (
  id           uuid primary key default gen_random_uuid(),
  title_id     uuid not null references public.titles (id) on delete cascade,
  kind         text not null default 'feature' check (kind in ('feature', 'trailer')),
  provider     text not null default 'mux',
  asset_id     text,
  playback_id  text,
  status       public.media_status not null default 'pending',
  duration_seconds int,
  created_at   timestamptz not null default now()
);

-- Curated home-page rows.
create table public.collections (
  id         serial primary key,
  slug       text not null unique,
  name       text not null,
  sort_order int  not null default 0,
  active     boolean not null default true
);
create table public.collection_items (
  collection_id int  not null references public.collections (id) on delete cascade,
  title_id      uuid not null references public.titles (id) on delete cascade,
  position      int  not null default 0,
  primary key (collection_id, title_id)
);

-- ---------------------------------------------------------------------
-- User data
-- ---------------------------------------------------------------------
create table public.watchlist (
  user_id  uuid not null references auth.users (id) on delete cascade,
  title_id uuid not null references public.titles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create table public.watch_progress (
  user_id          uuid not null references auth.users (id) on delete cascade,
  title_id         uuid not null references public.titles (id) on delete cascade,
  position_seconds int  not null default 0 check (position_seconds >= 0),
  duration_seconds int,
  completed        boolean not null default false,
  updated_at       timestamptz not null default now(),
  primary key (user_id, title_id)
);
create trigger watch_progress_updated before update on public.watch_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Audit log (written by triggers, readable by staff)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id         bigserial primary key,
  actor      uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb,
  at         timestamptz not null default now()
);

create or replace function public.audit_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  row_data jsonb;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;
  insert into public.audit_log (actor, action, entity, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, row_data ->> 'id', row_data);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

create trigger audit_titles after insert or update or delete on public.titles
  for each row execute function public.audit_changes();
create trigger audit_rights after insert or update or delete on public.rights
  for each row execute function public.audit_changes();
create trigger audit_subscriptions after insert or update or delete on public.subscriptions
  for each row execute function public.audit_changes();

-- ---------------------------------------------------------------------
-- Availability & entitlement
-- ---------------------------------------------------------------------

-- Is there an active rights window for this title in this country?
create or replace function public.rights_active(
  t_id uuid, country text default null, need_download boolean default false)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rights r
     where r.title_id = t_id
       and r.allow_stream
       and (not need_download or r.allow_download)
       and r.starts_at <= now()
       and (r.ends_at is null or r.ends_at > now())
       and ('*' = any (r.territories)
            or (country is not null and upper(country) = any (r.territories)))
  );
$$;

-- Full playback decision for the signed-in user. Used by the playback
-- token endpoint (Phase 3) and by the apps to show the right button.
create or replace function public.playback_entitlement(t_id uuid, country text default null)
returns table (can_play boolean, can_download boolean, reason text, user_plan text, required_plan text)
language plpgsql stable security definer set search_path = public as $$
declare
  t           public.titles;
  u_plan      text := public.current_plan();
  u_rank      int;
  t_rank      int;
  has_rights  boolean;
  dl_rights   boolean;
  plan_dl     boolean;
begin
  select * into t from public.titles where id = t_id and status = 'published';
  if not found then
    return query select false, false, 'not_found', u_plan, null::text; return;
  end if;

  has_rights := public.rights_active(t_id, country, false);
  if not has_rights then
    return query select false, false, 'not_available_in_region', u_plan, t.required_plan; return;
  end if;

  select rank, downloads_allowed into u_rank, plan_dl from public.plans where id = u_plan;
  select rank into t_rank from public.plans where id = t.required_plan;

  if auth.uid() is null and t.required_plan <> 'free' then
    return query select false, false, 'sign_in_required', u_plan, t.required_plan; return;
  end if;

  if u_rank < t_rank then
    return query select false, false, 'upgrade_required', u_plan, t.required_plan; return;
  end if;

  dl_rights := public.rights_active(t_id, country, true);
  return query select true, (dl_rights and plan_dl and auth.uid() is not null), 'ok', u_plan, t.required_plan;
end $$;

-- Public catalogue: published titles that currently have streaming rights
-- somewhere, with genres and safe availability flags. Exposes no rights
-- or partner details. Runs with owner privileges on purpose.
create or replace view public.catalog_titles
with (security_invoker = false) as
select
  t.id, t.slug, t.title, t.tagline, t.synopsis, t.release_year,
  t.runtime_minutes, t.maturity_rating, t.content_warnings,
  t.original_language, t.audio_languages, t.subtitle_languages,
  t.credits, t.poster_url, t.backdrop_url, t.trailer_url,
  t.required_plan, t.is_featured, t.popularity, t.published_at,
  coalesce(
    (select array_agg(g.slug order by g.name)
       from public.title_genres tg join public.genres g on g.id = tg.genre_id
      where tg.title_id = t.id), '{}') as genres,
  exists (
    select 1 from public.rights r
     where r.title_id = t.id and r.allow_download
       and r.starts_at <= now() and (r.ends_at is null or r.ends_at > now())
  ) as downloadable
from public.titles t
where t.status = 'published'
  and exists (
    select 1 from public.rights r
     where r.title_id = t.id and r.allow_stream
       and r.starts_at <= now() and (r.ends_at is null or r.ends_at > now())
  );

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.user_roles       enable row level security;
alter table public.profiles         enable row level security;
alter table public.plans            enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.payment_events   enable row level security;
alter table public.genres           enable row level security;
alter table public.partners         enable row level security;
alter table public.titles           enable row level security;
alter table public.title_genres     enable row level security;
alter table public.rights           enable row level security;
alter table public.media_assets     enable row level security;
alter table public.collections      enable row level security;
alter table public.collection_items enable row level security;
alter table public.watchlist        enable row level security;
alter table public.watch_progress   enable row level security;
alter table public.audit_log        enable row level security;

-- Roles: users see their own; admins manage.
create policy "own roles readable" on public.user_roles
  for select using (user_id = auth.uid() or public.has_role('admin'));
create policy "admins manage roles" on public.user_roles
  for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- Profiles: own row only (staff can read).
create policy "read own profile" on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Plans & genres: public read, staff write.
create policy "plans are public" on public.plans for select using (active or public.is_staff());
create policy "staff manage plans" on public.plans
  for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "genres are public" on public.genres for select using (true);
create policy "staff manage genres" on public.genres
  for all using (public.is_staff()) with check (public.is_staff());

-- Subscriptions: users read their own. No client writes — server only.
create policy "read own subscriptions" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_staff());
-- payment_events: no policies => only service role can access.

-- Titles: anyone reads published; staff read & write everything.
create policy "published titles readable" on public.titles
  for select using (status = 'published' or public.is_staff());
create policy "staff manage titles" on public.titles
  for all using (public.is_staff()) with check (public.is_staff());

create policy "title genres readable" on public.title_genres for select using (true);
create policy "staff manage title genres" on public.title_genres
  for all using (public.is_staff()) with check (public.is_staff());

-- Partners, rights, media: staff only.
create policy "staff read partners" on public.partners for select using (public.is_staff());
create policy "admins manage partners" on public.partners
  for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "staff read rights" on public.rights for select using (public.is_staff());
create policy "admins manage rights" on public.rights
  for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "staff manage media" on public.media_assets
  for all using (public.is_staff()) with check (public.is_staff());

-- Collections: public read, staff write.
create policy "collections readable" on public.collections for select using (active or public.is_staff());
create policy "staff manage collections" on public.collections
  for all using (public.is_staff()) with check (public.is_staff());
create policy "collection items readable" on public.collection_items for select using (true);
create policy "staff manage collection items" on public.collection_items
  for all using (public.is_staff()) with check (public.is_staff());

-- Watchlist & progress: strictly own rows.
create policy "own watchlist" on public.watchlist
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own progress" on public.watch_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Audit log: staff read; writes only via trigger.
create policy "staff read audit" on public.audit_log for select using (public.is_staff());

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
grant select on public.catalog_titles to anon, authenticated;
grant execute on function public.current_plan() to anon, authenticated;
grant execute on function public.playback_entitlement(uuid, text) to anon, authenticated;
revoke execute on function public.rights_active(uuid, text, boolean) from public, anon, authenticated;
