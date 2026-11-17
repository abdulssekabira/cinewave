-- Viewers can delete their own account and personal data (Google Play requirement).
create or replace function public.delete_my_account()
returns text
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'Sign in first.'; end if;
  if public.has_role('admin') then return 'The owner account can’t be deleted from here.'; end if;
  delete from auth.users where id = me;
  return null;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Keep payment records (accounting/tax) when a viewer deletes their account; just unlink them.
do $$
declare cname text;
begin
  select conname into cname from pg_constraint
   where conrelid = 'public.payments'::regclass and confrelid = 'auth.users'::regclass and contype = 'f';
  execute 'alter table public.payments alter column user_id drop not null';
  if cname is not null and cname <> 'payments_user_id_fkey' then
    execute format('alter table public.payments %s constraint %I', 'drop', cname);
  end if;
end $$;
