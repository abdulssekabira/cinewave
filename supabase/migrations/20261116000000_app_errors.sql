-- Crash / playback error reports from the app, so problems can be diagnosed.
create table if not exists public.app_errors (
  id          bigint generated always as identity primary key,
  user_id     uuid default auth.uid(),
  kind        text not null check (char_length(kind) <= 40),
  message     text not null check (char_length(message) <= 2000),
  detail      text check (detail is null or char_length(detail) <= 4000),
  app_version text check (app_version is null or char_length(app_version) <= 60),
  device      text check (device is null or char_length(device) <= 200),
  created_at  timestamptz not null default now()
);
create index if not exists app_errors_created_idx on public.app_errors (created_at desc);
alter table public.app_errors enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'app_errors' and policyname = 'anyone reports errors') then
    create policy "anyone reports errors" on public.app_errors for insert to anon, authenticated
      with check (user_id is null or user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'app_errors' and policyname = 'admins read errors') then
    create policy "admins read errors" on public.app_errors for select using (public.has_role('admin'));
  end if;
end $$;
grant insert on public.app_errors to anon, authenticated;
