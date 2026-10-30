-- Public site settings the owner edits in the admin (e.g. the Android app download link).
create table if not exists public.site_settings (
  key        text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  value      text,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'site_settings' and policyname = 'site settings readable') then
    create policy "site settings readable" on public.site_settings for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'site_settings' and policyname = 'admins edit site settings') then
    create policy "admins edit site settings" on public.site_settings for all
      using (public.has_role('admin')) with check (public.has_role('admin'));
  end if;
end $$;
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
