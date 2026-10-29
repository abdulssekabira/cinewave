-- =====================================================================
-- Uploaders (role "editor") work on drafts only. The owner (admin)
-- approves: publishing films, showing parts, and changing anything that
-- viewers can already see. Enforced here so it can't be bypassed.
-- =====================================================================

create or replace function public.guard_uploader_titles()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role('admin') then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Only the owner can delete films.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    -- Allowed: filling in the runtime automatically after a video finishes.
    if (to_jsonb(new) - 'runtime_minutes' - 'updated_at') = (to_jsonb(old) - 'runtime_minutes' - 'updated_at') then
      return new;
    end if;
    raise exception 'This film is live. Only the owner can change it.' using errcode = '42501';
  end if;
  if new.status <> 'draft' then
    raise exception 'Uploaders save films as drafts. The owner publishes them.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'titles_uploader_guard' and tgrelid = 'public.titles'::regclass) then
    create trigger titles_uploader_guard before insert or update or delete on public.titles
  for each row execute function public.guard_uploader_titles();
  end if;
end $$;

-- Genres of a live film: owner only.
create or replace function public.guard_uploader_title_genres()
returns trigger
language plpgsql security definer set search_path = public as $$
declare st public.title_status;
begin
  if auth.uid() is null or public.has_role('admin') then return coalesce(new, old); end if;
  select status into st from public.titles where id = coalesce(new.title_id, old.title_id);
  if st is not null and st <> 'draft' then
    raise exception 'This film is live. Only the owner can change it.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'title_genres_uploader_guard' and tgrelid = 'public.title_genres'::regclass) then
    create trigger title_genres_uploader_guard before insert or update or delete on public.title_genres
  for each row execute function public.guard_uploader_title_genres();
  end if;
end $$;

-- Parts: uploaders may add parts (also to a live series) but they stay
-- hidden until the owner shows them; shown parts are owner-only.
create or replace function public.guard_uploader_episodes()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role('admin') then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    new.published := false;
    return new;
  end if;
  if old.published then
    if tg_op = 'UPDATE' and (to_jsonb(new) - 'runtime_minutes' - 'updated_at') = (to_jsonb(old) - 'runtime_minutes' - 'updated_at') then
      return new;
    end if;
    raise exception 'This part is live. Only the owner can change it.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.published then
    raise exception 'The owner shows new parts to viewers.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'episodes_uploader_guard' and tgrelid = 'public.episodes'::regclass) then
    create trigger episodes_uploader_guard before insert or update or delete on public.episodes
  for each row execute function public.guard_uploader_episodes();
  end if;
end $$;

-- Videos: uploaders can't replace the video of a live film or a shown part.
create or replace function public.guard_uploader_media()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role('admin') then return new; end if;
  if new.episode_id is not null then
    if exists (select 1 from public.episodes e where e.id = new.episode_id and e.published) then
      raise exception 'This part is live. Only the owner can replace its video.' using errcode = '42501';
    end if;
  elsif exists (select 1 from public.titles t where t.id = new.title_id and t.status <> 'draft') then
    raise exception 'This film is live. Only the owner can replace its video.' using errcode = '42501';
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'media_uploader_guard' and tgrelid = 'public.media_assets'::regclass) then
    create trigger media_uploader_guard before insert on public.media_assets
  for each row execute function public.guard_uploader_media();
  end if;
end $$;
