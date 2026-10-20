-- Garantit que handle_new_user lit raw_user_meta_data.role (vendor|user)
-- pour les inscriptions email ET OAuth (Google / Apple).
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
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    assigned_role
  )
  on conflict (id) do update
    set
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      -- N'écrase pas un rôle déjà vendor/owner ; permet user → vendor à la 1ère synchro
      role = case
        when public.profiles.role in ('vendor', 'owner') then public.profiles.role
        else excluded.role
      end;

  return new;
end;
$$;
