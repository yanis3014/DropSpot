-- Lors de l'inscription, lit raw_user_meta_data.role (vendor|user) pour peupler profiles.role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested_role text;
  assigned_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'user');
  if requested_role in ('vendor', 'owner') then
    assigned_role := requested_role;
  else
    assigned_role := 'user';
  end if;

  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    assigned_role
  )
  on conflict (id) do update
    set
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      -- N'écrase pas un rôle déjà vendor/owner ; permet de passer user → vendor à la 1ère synchro meta
      role = case
        when public.profiles.role in ('vendor', 'owner') then public.profiles.role
        else excluded.role
      end;

  return new;
end;
$$;
