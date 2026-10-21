-- Place claims workflow: verification_status, private proofs, admin review.
-- Replaces direct "claim unclaimed places" updates with request_claim RPC.

-- ---------------------------------------------------------------------------
-- 1) places.verification_status
-- ---------------------------------------------------------------------------
alter table public.places
  add column if not exists verification_status text;

update public.places
set verification_status = 'verified'
where verification_status is null
  and vendor_id is not null;

update public.places
set verification_status = 'unclaimed'
where verification_status is null;

alter table public.places
  alter column verification_status set default 'unclaimed';

alter table public.places
  alter column verification_status set not null;

alter table public.places
  drop constraint if exists places_verification_status_check;

alter table public.places
  add constraint places_verification_status_check
  check (verification_status in ('unclaimed', 'pending', 'verified'));

create index if not exists places_verification_status_idx
  on public.places (verification_status);

comment on column public.places.verification_status is
  'unclaimed: no owner; pending: claim under review; verified: drops allowed.';

-- Clients cannot change verification_status (only security definer RPCs).
create or replace function public.places_protect_verification_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.verification_status is distinct from old.verification_status then
    raise exception 'places: verification_status is read-only'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- New vendor-created rows from the client start pending until verified.
create or replace function public.places_default_verification_on_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.vendor_id is not null then
    new.verification_status := 'pending';
  else
    new.verification_status := coalesce(new.verification_status, 'unclaimed');
  end if;

  return new;
end;
$$;

drop trigger if exists places_default_verification_on_insert on public.places;
create trigger places_default_verification_on_insert
  before insert on public.places
  for each row
  execute function public.places_default_verification_on_insert();

drop trigger if exists places_protect_verification_status on public.places;
create trigger places_protect_verification_status
  before update on public.places
  for each row
  execute function public.places_protect_verification_status();

drop policy if exists "Vendors claim unclaimed places" on public.places;

-- ---------------------------------------------------------------------------
-- 2) admins
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admins is
  'DropSpot internal admins (claim review). Not exposed via client SELECT.';

alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) place_claims
-- ---------------------------------------------------------------------------
create table if not exists public.place_claims (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  declared_role text not null,
  proof_method text not null check (proof_method in ('document', 'phone')),
  proof_path text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists place_claims_place_id_idx
  on public.place_claims (place_id);

create index if not exists place_claims_user_id_idx
  on public.place_claims (user_id);

create index if not exists place_claims_status_idx
  on public.place_claims (status);

create unique index if not exists place_claims_one_open_per_place_uidx
  on public.place_claims (place_id)
  where status = 'pending';

comment on table public.place_claims is
  'Revendication d''un café : une demande pending max par place.';

alter table public.place_claims enable row level security;

drop policy if exists "Claimants read own claims" on public.place_claims;
create policy "Claimants read own claims"
  on public.place_claims for select
  using (auth.uid() = user_id);

drop policy if exists "Admins read all claims" on public.place_claims;
create policy "Admins read all claims"
  on public.place_claims for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4) Storage bucket claim-proofs (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('claim-proofs', 'claim-proofs', false)
on conflict (id) do update set public = false;

drop policy if exists "Claimants upload own claim proofs" on storage.objects;
create policy "Claimants upload own claim proofs"
  on storage.objects for insert
  with check (
    bucket_id = 'claim-proofs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Claimants read own claim proofs" on storage.objects;
create policy "Claimants read own claim proofs"
  on storage.objects for select
  using (
    bucket_id = 'claim-proofs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Claimants update own claim proofs" on storage.objects;
create policy "Claimants update own claim proofs"
  on storage.objects for update
  using (
    bucket_id = 'claim-proofs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'claim-proofs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Claimants delete own claim proofs" on storage.objects;
create policy "Claimants delete own claim proofs"
  on storage.objects for delete
  using (
    bucket_id = 'claim-proofs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 5) flash_drops: verified places only
-- ---------------------------------------------------------------------------
drop policy if exists "Owners and managers insert flash drops" on public.flash_drops;
create policy "Owners and managers insert flash drops"
  on public.flash_drops for insert
  with check (
    public.has_place_role(place_id, array['owner', 'manager'])
    and vendor_id = (
      select p.vendor_id from public.places p where p.id = place_id
    )
    and exists (
      select 1
      from public.places p
      where p.id = place_id
        and p.verification_status = 'verified'
    )
  );

drop policy if exists "Owners and managers update flash drops" on public.flash_drops;
create policy "Owners and managers update flash drops"
  on public.flash_drops for update
  using (
    public.has_place_role(place_id, array['owner', 'manager'])
    and exists (
      select 1
      from public.places p
      where p.id = place_id
        and p.verification_status = 'verified'
    )
  )
  with check (
    public.has_place_role(place_id, array['owner', 'manager'])
    and vendor_id = (
      select p.vendor_id from public.places p where p.id = place_id
    )
    and exists (
      select 1
      from public.places p
      where p.id = place_id
        and p.verification_status = 'verified'
    )
  );

create or replace function public.flash_drops_enforce_client_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  c_default_grains_reward constant integer := 10;
  v_pin text;
  v_attempt integer := 0;
  v_place_vendor uuid;
  v_verification text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  select p.vendor_id, p.verification_status
  into v_place_vendor, v_verification
  from public.places p
  where p.id = new.place_id;

  if v_verification is distinct from 'verified' then
    raise exception 'flash_drops: place must be verified'
      using errcode = 'check_violation';
  end if;

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
-- 6) RPCs
-- ---------------------------------------------------------------------------
create or replace function public.request_claim(
  p_place_id uuid,
  p_declared_role text,
  p_proof_method text,
  p_proof_path text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_claim_id uuid;
  v_status text;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_proof_method is null or p_proof_method not in ('document', 'phone') then
    return json_build_object('ok', false, 'error', 'invalid_proof_method');
  end if;

  if p_declared_role is null or btrim(p_declared_role) = '' then
    return json_build_object('ok', false, 'error', 'invalid_role');
  end if;

  if p_proof_method = 'document'
     and (p_proof_path is null or btrim(p_proof_path) = '') then
    return json_build_object('ok', false, 'error', 'proof_required');
  end if;

  if p_proof_path is not null
     and not (p_proof_path like v_actor::text || '/%') then
    return json_build_object('ok', false, 'error', 'invalid_proof_path');
  end if;

  select verification_status into v_status
  from public.places
  where id = p_place_id
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'place_not_found');
  end if;

  if v_status is distinct from 'unclaimed' then
    return json_build_object('ok', false, 'error', 'place_not_unclaimed');
  end if;

  if exists (
    select 1 from public.place_claims c
    where c.place_id = p_place_id and c.status = 'pending'
  ) then
    return json_build_object('ok', false, 'error', 'claim_already_open');
  end if;

  insert into public.place_claims (
    place_id, user_id, declared_role, proof_method, proof_path, status
  )
  values (
    p_place_id,
    v_actor,
    btrim(p_declared_role),
    p_proof_method,
    nullif(btrim(p_proof_path), ''),
    'pending'
  )
  returning id into v_claim_id;

  update public.places
  set verification_status = 'pending'
  where id = p_place_id;

  return json_build_object(
    'ok', true,
    'claim_id', v_claim_id,
    'place_id', p_place_id,
    'status', 'pending'
  );
end;
$$;

revoke all on function public.request_claim(uuid, text, text, text) from public;
grant execute on function public.request_claim(uuid, text, text, text) to authenticated;

create or replace function public.cancel_claim(p_claim_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_claim public.place_claims%rowtype;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_claim
  from public.place_claims
  where id = p_claim_id
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_claim.user_id is distinct from v_actor then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_claim.status is distinct from 'pending' then
    return json_build_object('ok', false, 'error', 'not_pending');
  end if;

  update public.place_claims
  set status = 'cancelled'
  where id = p_claim_id;

  update public.places p
  set verification_status = 'unclaimed'
  where p.id = v_claim.place_id
    and p.verification_status = 'pending'
    and not exists (
      select 1
      from public.place_claims c
      where c.place_id = p.id and c.status = 'pending'
    );

  return json_build_object('ok', true, 'claim_id', p_claim_id);
end;
$$;

revoke all on function public.cancel_claim(uuid) from public;
grant execute on function public.cancel_claim(uuid) to authenticated;

create or replace function public.approve_claim(
  p_claim_id uuid,
  p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_claim public.place_claims%rowtype;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_claim
  from public.place_claims
  where id = p_claim_id
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_claim.status is distinct from 'pending' then
    return json_build_object('ok', false, 'error', 'not_pending');
  end if;

  insert into public.place_members (place_id, user_id, role)
  values (v_claim.place_id, v_claim.user_id, 'owner')
  on conflict (place_id, user_id) do update
  set role = 'owner';

  update public.places
  set verification_status = 'verified'
  where id = v_claim.place_id;

  update public.place_claims
  set
    status = 'approved',
    reviewed_by = v_actor,
    reviewed_at = now(),
    note = nullif(btrim(p_note), '')
  where id = p_claim_id;

  update public.place_claims
  set status = 'cancelled'
  where place_id = v_claim.place_id
    and status = 'pending'
    and id is distinct from p_claim_id;

  return json_build_object(
    'ok', true,
    'claim_id', p_claim_id,
    'place_id', v_claim.place_id,
    'user_id', v_claim.user_id
  );
end;
$$;

revoke all on function public.approve_claim(uuid, text) from public;
grant execute on function public.approve_claim(uuid, text) to authenticated;

create or replace function public.reject_claim(
  p_claim_id uuid,
  p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_claim public.place_claims%rowtype;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_claim
  from public.place_claims
  where id = p_claim_id
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_claim.status is distinct from 'pending' then
    return json_build_object('ok', false, 'error', 'not_pending');
  end if;

  update public.place_claims
  set
    status = 'rejected',
    reviewed_by = v_actor,
    reviewed_at = now(),
    note = nullif(btrim(p_note), '')
  where id = p_claim_id;

  update public.places p
  set verification_status = 'unclaimed'
  where p.id = v_claim.place_id
    and p.verification_status = 'pending'
    and not exists (
      select 1
      from public.place_claims c
      where c.place_id = p.id and c.status = 'pending'
    );

  return json_build_object('ok', true, 'claim_id', p_claim_id);
end;
$$;

revoke all on function public.reject_claim(uuid, text) from public;
grant execute on function public.reject_claim(uuid, text) to authenticated;
