-- Place team members + invitations.
-- Roles: owner (fiche + équipe), manager (drops), staff (validation only).
-- places.vendor_id stays the ERP-facing owner, synced from place_members.

-- ---------------------------------------------------------------------------
-- 1) Tables
-- ---------------------------------------------------------------------------
create table if not exists public.place_members (
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  primary key (place_id, user_id)
);

create index if not exists place_members_user_id_idx
  on public.place_members (user_id);

create index if not exists place_members_place_role_idx
  on public.place_members (place_id, role);

comment on table public.place_members is
  'Team roster per café: owner (fiche/équipe), manager (drops), staff (caisse).';

create table if not exists public.place_invitations (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'manager', 'staff')),
  token text not null unique,
  invited_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists place_invitations_place_id_idx
  on public.place_invitations (place_id);

create index if not exists place_invitations_email_idx
  on public.place_invitations ((lower(email)));

create unique index if not exists place_invitations_pending_email_place_uidx
  on public.place_invitations (place_id, (lower(email)))
  where accepted_at is null;

comment on table public.place_invitations is
  'Pending team invites by email; accepted via accept_invitation(token).';

alter table public.place_members enable row level security;
alter table public.place_invitations enable row level security;

-- ---------------------------------------------------------------------------
-- 2) has_place_role (stable, security definer — safe to use inside RLS)
-- ---------------------------------------------------------------------------
create or replace function public.has_place_role(
  p_place uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_place is not null
    and p_roles is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.place_members m
      where m.place_id = p_place
        and m.user_id = auth.uid()
        and m.role = any (p_roles)
    );
$$;

comment on function public.has_place_role(uuid, text[]) is
  'True when auth.uid() is a place_members row for p_place with role in p_roles.';

revoke all on function public.has_place_role(uuid, text[]) from public;
grant execute on function public.has_place_role(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Backfill: places.vendor_id → owner
-- ---------------------------------------------------------------------------
insert into public.place_members (place_id, user_id, role)
select p.id, p.vendor_id, 'owner'
from public.places p
where p.vendor_id is not null
on conflict (place_id, user_id) do update
set role = 'owner';

-- ---------------------------------------------------------------------------
-- 4) Sync triggers: place_members.owner ↔ places.vendor_id (ERP)
-- ---------------------------------------------------------------------------
create or replace function public.sync_place_vendor_from_owners()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_place uuid;
  v_owner uuid;
begin
  v_place := coalesce(new.place_id, old.place_id);

  select m.user_id
  into v_owner
  from public.place_members m
  where m.place_id = v_place
    and m.role = 'owner'
  order by m.created_at asc, m.user_id asc
  limit 1;

  update public.places p
  set vendor_id = v_owner
  where p.id = v_place
    and p.vendor_id is distinct from v_owner;

  return coalesce(new, old);
end;
$$;

drop trigger if exists place_members_sync_vendor on public.place_members;
create trigger place_members_sync_vendor
  after insert or update of role or delete on public.place_members
  for each row
  execute function public.sync_place_vendor_from_owners();

create or replace function public.sync_place_owner_from_vendor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vendor_id is null then
    return new;
  end if;

  insert into public.place_members (place_id, user_id, role)
  values (new.id, new.vendor_id, 'owner')
  on conflict (place_id, user_id) do update
  set role = 'owner';

  return new;
end;
$$;

drop trigger if exists places_sync_owner_member on public.places;
create trigger places_sync_owner_member
  after insert or update of vendor_id on public.places
  for each row
  when (new.vendor_id is not null)
  execute function public.sync_place_owner_from_vendor();

-- ---------------------------------------------------------------------------
-- 5) RLS: place_members / place_invitations
-- ---------------------------------------------------------------------------
drop policy if exists "Members read place_members" on public.place_members;
create policy "Members read place_members"
  on public.place_members for select
  using (
    public.has_place_role(place_id, array['owner', 'manager', 'staff'])
  );

-- Writes go through security definer RPCs only (no direct client DML policies).

drop policy if exists "Owners read place_invitations" on public.place_invitations;
create policy "Owners read place_invitations"
  on public.place_invitations for select
  using (public.has_place_role(place_id, array['owner']));

-- ---------------------------------------------------------------------------
-- 6) Rewrite places / place_media / storage / flash_drops policies
-- ---------------------------------------------------------------------------

-- places UPDATE (fiche): owner only. Claim policy kept separately.
drop policy if exists "Vendors update own places" on public.places;
create policy "Owners update place fiche"
  on public.places for update
  using (public.has_place_role(id, array['owner']))
  with check (public.has_place_role(id, array['owner']));

-- place_media: owner only (fiche / galerie)
drop policy if exists "Vendors insert place media" on public.place_media;
create policy "Owners insert place media"
  on public.place_media for insert
  with check (public.has_place_role(place_id, array['owner']));

drop policy if exists "Vendors update place media" on public.place_media;
create policy "Owners update place media"
  on public.place_media for update
  using (public.has_place_role(place_id, array['owner']))
  with check (public.has_place_role(place_id, array['owner']));

drop policy if exists "Vendors delete place media" on public.place_media;
create policy "Owners delete place media"
  on public.place_media for delete
  using (public.has_place_role(place_id, array['owner']));

-- storage place-photos: owner only; path still {uid}/{place_id}/...
drop policy if exists "Vendors upload place photos" on storage.objects;
create policy "Owners upload place photos"
  on storage.objects for insert
  with check (
    bucket_id = 'place-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.places p
      where p.id::text = (storage.foldername(name))[2]
        and public.has_place_role(p.id, array['owner'])
    )
  );

drop policy if exists "Vendors update place photos" on storage.objects;
create policy "Owners update place photos"
  on storage.objects for update
  using (
    bucket_id = 'place-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.places p
      where p.id::text = (storage.foldername(name))[2]
        and public.has_place_role(p.id, array['owner'])
    )
  )
  with check (
    bucket_id = 'place-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.places p
      where p.id::text = (storage.foldername(name))[2]
        and public.has_place_role(p.id, array['owner'])
    )
  );

drop policy if exists "Vendors delete place photos" on storage.objects;
create policy "Owners delete place photos"
  on storage.objects for delete
  using (
    bucket_id = 'place-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.places p
      where p.id::text = (storage.foldername(name))[2]
        and public.has_place_role(p.id, array['owner'])
    )
  );

-- flash_drops: owner + manager manage; force vendor_id = place owner in trigger
drop policy if exists "Vendors insert own flash drops" on public.flash_drops;
create policy "Owners and managers insert flash drops"
  on public.flash_drops for insert
  with check (
    public.has_place_role(place_id, array['owner', 'manager'])
    and vendor_id = (
      select p.vendor_id from public.places p where p.id = place_id
    )
  );

drop policy if exists "Vendors update own flash drops" on public.flash_drops;
create policy "Owners and managers update flash drops"
  on public.flash_drops for update
  using (public.has_place_role(place_id, array['owner', 'manager']))
  with check (
    public.has_place_role(place_id, array['owner', 'manager'])
    and vendor_id = (
      select p.vendor_id from public.places p where p.id = place_id
    )
  );

drop policy if exists "Vendors delete own flash drops" on public.flash_drops;
create policy "Owners and managers delete flash drops"
  on public.flash_drops for delete
  using (public.has_place_role(place_id, array['owner', 'manager']));

-- Enforce vendor_id = place.vendor_id for client writes (managers ≠ vendor_id)
create or replace function public.flash_drops_enforce_client_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  -- Fixed Grains reward until per-client redemption codes (phase 2d).
  c_default_grains_reward constant integer := 10;
  v_pin text;
  v_attempt integer := 0;
  v_place_vendor uuid;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  select p.vendor_id into v_place_vendor
  from public.places p
  where p.id = new.place_id;

  if v_place_vendor is null then
    raise exception 'flash_drops: place has no vendor_id'
      using errcode = 'check_violation';
  end if;

  new.vendor_id := v_place_vendor;
  new.grains_reward := c_default_grains_reward;

  if new.max_uses is not null and new.max_uses <= 0 then
    raise exception 'flash_drops: max_uses must be null or > 0'
      using errcode = 'check_violation';
  end if;

  if new.ends_at <= new.starts_at then
    raise exception 'flash_drops: ends_at must be after starts_at'
      using errcode = 'check_violation';
  end if;

  if new.pin_code is null or btrim(new.pin_code) = '' then
    loop
      v_attempt := v_attempt + 1;
      if v_attempt > 40 then
        raise exception 'flash_drops: could not allocate unique pin_code'
          using errcode = 'unique_violation';
      end if;

      v_pin := lpad((floor(random() * 10000))::integer::text, 4, '0');

      exit when not exists (
        select 1
        from public.flash_drops fd
        where fd.vendor_id = new.vendor_id
          and fd.pin_code = v_pin
          and fd.is_active = true
          and fd.id is distinct from new.id
      );
    end loop;

    new.pin_code := v_pin;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) validate_flash_drop_code: staff/manager/owner of the place (not only vendor_id)
-- ---------------------------------------------------------------------------
create or replace function public.validate_flash_drop_code(
  p_code text,
  p_user_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_code text := trim(p_code);
  v_drop public.flash_drops%rowtype;
  v_redemption_id uuid;
  v_place_vendor uuid;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if v_code is null or length(v_code) < 4 then
    return json_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if v_code ~* 'dropspot[:/-]' then
    v_code := regexp_replace(v_code, '.*dropspot[:/-]', '', 'i');
  end if;
  if v_code like '{%' then
    begin
      v_code := v_code::json ->> 'code';
    exception when others then
      null;
    end;
  end if;
  v_code := regexp_replace(v_code, '[^0-9A-Za-z]', '', 'g');

  select fd.* into v_drop
  from public.flash_drops fd
  where fd.pin_code = v_code
    and fd.is_active = true
    and fd.ends_at > now()
    and public.has_place_role(fd.place_id, array['owner', 'manager', 'staff'])
  order by fd.created_at desc
  limit 1
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'code_not_found');
  end if;

  if v_drop.max_uses is not null and v_drop.current_uses >= v_drop.max_uses then
    return json_build_object('ok', false, 'error', 'sold_out');
  end if;

  select p.vendor_id into v_place_vendor
  from public.places p
  where p.id = v_drop.place_id;

  update public.flash_drops
  set current_uses = current_uses + 1,
      updated_at = now()
  where id = v_drop.id;

  -- vendor_id on redemption = ERP place owner (not necessarily the staff actor)
  insert into public.flash_drop_redemptions (
    flash_drop_id, vendor_id, user_id, validation_code, grains_awarded
  )
  values (
    v_drop.id,
    coalesce(v_place_vendor, v_drop.vendor_id),
    p_user_id,
    v_code,
    0
  )
  returning id into v_redemption_id;

  return json_build_object(
    'ok', true,
    'redemption_id', v_redemption_id,
    'flash_drop_id', v_drop.id,
    'title', v_drop.title,
    'grains_awarded', 0,
    'current_uses', v_drop.current_uses + 1,
    'user_credited', false
  );
end;
$$;

revoke all on function public.validate_flash_drop_code(text, uuid) from public;
grant execute on function public.validate_flash_drop_code(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) RPCs: invite_member / accept_invitation / remove_member
-- ---------------------------------------------------------------------------
create or replace function public.invite_member(
  p_place_id uuid,
  p_email text,
  p_role text default 'staff'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(btrim(p_email));
  v_actor_email text;
  v_token text;
  v_id uuid;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if not public.has_place_role(p_place_id, array['owner']) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    return json_build_object('ok', false, 'error', 'invalid_email');
  end if;

  if p_role is null or p_role not in ('owner', 'manager', 'staff') then
    return json_build_object('ok', false, 'error', 'invalid_role');
  end if;

  v_actor_email := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  if v_actor_email <> '' and v_actor_email = v_email then
    return json_build_object('ok', false, 'error', 'cannot_invite_self');
  end if;

  -- Also block if the email already belongs to the actor in auth.users
  if exists (
    select 1 from auth.users u
    where u.id = v_actor
      and lower(u.email) = v_email
  ) then
    return json_build_object('ok', false, 'error', 'cannot_invite_self');
  end if;

  if exists (
    select 1
    from public.place_members m
    join auth.users u on u.id = m.user_id
    where m.place_id = p_place_id
      and lower(u.email) = v_email
  ) then
    return json_build_object('ok', false, 'error', 'already_member');
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  delete from public.place_invitations
  where place_id = p_place_id
    and lower(email) = v_email
    and accepted_at is null;

  insert into public.place_invitations (
    place_id, email, role, token, invited_by, expires_at
  )
  values (
    p_place_id, v_email, p_role, v_token, v_actor, now() + interval '14 days'
  )
  returning id into v_id;

  return json_build_object(
    'ok', true,
    'invitation_id', v_id,
    'token', v_token,
    'email', v_email,
    'role', p_role,
    'expires_at', (now() + interval '14 days')
  );
end;
$$;

comment on function public.invite_member(uuid, text, text) is
  'Owner-only invite by email. Rejects self-invite. Returns opaque token.';

revoke all on function public.invite_member(uuid, text, text) from public;
grant execute on function public.invite_member(uuid, text, text) to authenticated;

create or replace function public.accept_invitation(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_inv public.place_invitations%rowtype;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_token is null or btrim(p_token) = '' then
    return json_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_actor;

  if v_email is null then
    return json_build_object('ok', false, 'error', 'no_email');
  end if;

  select * into v_inv
  from public.place_invitations
  where token = btrim(p_token)
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_inv.accepted_at is not null then
    return json_build_object('ok', false, 'error', 'already_accepted');
  end if;

  if v_inv.expires_at <= now() then
    return json_build_object('ok', false, 'error', 'expired');
  end if;

  if lower(v_inv.email) is distinct from v_email then
    return json_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  insert into public.place_members (place_id, user_id, role)
  values (v_inv.place_id, v_actor, v_inv.role)
  on conflict (place_id, user_id) do update
  set role = excluded.role;

  update public.place_invitations
  set accepted_at = now()
  where id = v_inv.id;

  return json_build_object(
    'ok', true,
    'place_id', v_inv.place_id,
    'role', v_inv.role
  );
end;
$$;

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

create or replace function public.remove_member(
  p_place_id uuid,
  p_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_owner_count integer;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if not public.has_place_role(p_place_id, array['owner']) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select m.role into v_role
  from public.place_members m
  where m.place_id = p_place_id
    and m.user_id = p_user_id;

  if v_role is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_role = 'owner' then
    select count(*)::integer into v_owner_count
    from public.place_members m
    where m.place_id = p_place_id
      and m.role = 'owner';

    if v_owner_count <= 1 then
      return json_build_object('ok', false, 'error', 'last_owner');
    end if;
  end if;

  delete from public.place_members
  where place_id = p_place_id
    and user_id = p_user_id;

  return json_build_object('ok', true, 'removed_user_id', p_user_id);
end;
$$;

comment on function public.remove_member(uuid, uuid) is
  'Owner-only. Refuses removing the last owner of a place.';

revoke all on function public.remove_member(uuid, uuid) from public;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
