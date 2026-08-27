-- Keep the account e-mail off the public name. Students set display_name
-- themselves; admins may still pass it in user_metadata when creating a user.

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

update public.profiles
set display_name = null
where display_name ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
