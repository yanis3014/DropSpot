-- Pro access: membership-only (place_members), not signup role.
-- ERP keeps profiles.role; synced from place_members (never downgrades owner).

-- ---------------------------------------------------------------------------
-- 1) handle_new_user — always client role user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    'user'
  )
  on conflict (id) do update
    set
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) protect_profile_columns — no client role changes
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.grains_balance := 0;
    new.welcome_grains_claimed_at := null;
    new.role := 'user';
    return new;
  end if;

  if new.grains_balance is distinct from old.grains_balance then
    raise exception 'profiles.grains_balance is not client-writable';
  end if;

  if new.welcome_grains_claimed_at is distinct from old.welcome_grains_claimed_at then
    raise exception 'profiles.welcome_grains_claimed_at is not client-writable';
  end if;

  if new.role is distinct from old.role then
    raise exception 'profiles.role is not client-writable';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) is_pro — any place_members row
-- ---------------------------------------------------------------------------
create or replace function public.is_pro(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user is not null
    and exists (
      select 1
      from public.place_members m
      where m.user_id = p_user
    );
$$;

comment on function public.is_pro(uuid) is
  'True when the user has at least one place_members row (B2B access).';

revoke all on function public.is_pro(uuid) from public;
revoke all on function public.is_pro(uuid) from anon;
grant execute on function public.is_pro(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Sync profiles.role from place_members (preserve owner)
-- ---------------------------------------------------------------------------
create or replace function public.sync_profile_role_from_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_has_member boolean;
  v_current text;
begin
  v_user := coalesce(new.user_id, old.user_id);

  select pr.role into v_current
  from public.profiles pr
  where pr.id = v_user;

  if v_current = 'owner' then
    return coalesce(new, old);
  end if;

  select exists (
    select 1 from public.place_members m where m.user_id = v_user
  )
  into v_has_member;

  update public.profiles pr
  set role = case when v_has_member then 'vendor' else 'user' end
  where pr.id = v_user
    and pr.role is distinct from case when v_has_member then 'vendor' else 'user' end
    and pr.role <> 'owner';

  return coalesce(new, old);
end;
$$;

drop trigger if exists place_members_sync_profile_role on public.place_members;
create trigger place_members_sync_profile_role
  after insert or update or delete on public.place_members
  for each row
  execute function public.sync_profile_role_from_members();

-- One-time align ERP column with membership
update public.profiles pr
set role = 'vendor'
where pr.role <> 'owner'
  and exists (select 1 from public.place_members m where m.user_id = pr.id)
  and pr.role is distinct from 'vendor';

update public.profiles pr
set role = 'user'
where pr.role = 'vendor'
  and not exists (select 1 from public.place_members m where m.user_id = pr.id);

-- ---------------------------------------------------------------------------
-- 5) RLS: drop profiles.role checks → membership / is_pro
-- ---------------------------------------------------------------------------
drop policy if exists "Vendors insert own flash drops" on public.flash_drops;
drop policy if exists "Vendors update own flash drops" on public.flash_drops;

drop policy if exists "Owners and managers insert flash drops" on public.flash_drops;
create policy "Owners and managers insert flash drops"
  on public.flash_drops for insert
  with check (
    public.has_place_role(place_id, array['owner', 'manager'])
    and vendor_id = (
      select p.vendor_id from public.places p where p.id = place_id
    )
  );

drop policy if exists "Owners and managers update flash drops" on public.flash_drops;
create policy "Owners and managers update flash drops"
  on public.flash_drops for update
  using (public.has_place_role(place_id, array['owner', 'manager']))
  with check (
    public.has_place_role(place_id, array['owner', 'manager'])
    and vendor_id = (
      select p.vendor_id from public.places p where p.id = place_id
    )
  );

drop policy if exists "Vendors insert own places" on public.places;
create policy "Authenticated insert own places"
  on public.places for insert
  with check (auth.uid() = vendor_id);

drop policy if exists "Vendors claim unclaimed places" on public.places;
create policy "Pro members claim unclaimed places"
  on public.places for update
  using (
    vendor_id is null
    and public.is_pro()
  )
  with check (auth.uid() = vendor_id);

-- vendor_plans backfill from membership (not profiles.role)
insert into public.vendor_plans (user_id, plan)
select distinct m.user_id, 'free'
from public.place_members m
on conflict (user_id) do nothing;
