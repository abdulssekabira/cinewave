-- =====================================================================
-- Video (Mux): uploads, playback IDs and the signing key.
-- =====================================================================

alter table public.media_assets
  add column if not exists upload_id  text,
  add column if not exists error_text text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists media_assets_title_idx on public.media_assets (title_id, kind, created_at desc);

-- Playback ID for a film, returned ONLY when this viewer may watch it
-- (same checks as playback_entitlement: published, rights, region, plan).
create or replace function public.playback_id_for(t_id uuid, country text default null)
returns text
language plpgsql stable security definer set search_path = public as $$
declare ok boolean;
begin
  select e.can_play into ok from public.playback_entitlement(t_id, country) e;
  if not coalesce(ok, false) then return null; end if;
  return (select m.playback_id from public.media_assets m
           where m.title_id = t_id and m.kind = 'feature'
             and m.status = 'ready' and m.playback_id is not null
           order by m.created_at desc limit 1);
end $$;

revoke execute on function public.playback_id_for(uuid, text) from public;
grant execute on function public.playback_id_for(uuid, text) to anon, authenticated;

-- Server settings. Nobody reads this table through the API.
-- The Mux signing key is stored ENCRYPTED with a key only the web server
-- holds (derived from MUX_TOKEN_SECRET), so the ciphertext is useless alone.
create table if not exists public.app_secrets (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

create or replace function public.mux_signing_key()
returns text
language sql stable security definer set search_path = public as $$
  select value from public.app_secrets where key = 'mux_signing_key';
$$;
revoke execute on function public.mux_signing_key() from public;
grant execute on function public.mux_signing_key() to anon, authenticated;

create or replace function public.set_mux_signing_key(v text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admins only'; end if;
  insert into public.app_secrets (key, value) values ('mux_signing_key', v)
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
revoke execute on function public.set_mux_signing_key(text) from public, anon;
grant execute on function public.set_mux_signing_key(text) to authenticated;
