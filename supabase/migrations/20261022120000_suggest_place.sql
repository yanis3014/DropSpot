-- suggest_place: clients suggest unclaimed cafés (no direct places INSERT).
-- Drops "Authenticated insert own places" so ownership only comes from
-- approve_claim / place_members sync.

-- ---------------------------------------------------------------------------
-- 1) places.suggested_by (rate-limit key for suggest_place)
-- ---------------------------------------------------------------------------
alter table public.places
  add column if not exists suggested_by uuid references auth.users (id) on delete set null;

create index if not exists places_suggested_by_created_at_idx
  on public.places (suggested_by, created_at desc)
  where suggested_by is not null;

comment on column public.places.suggested_by is
  'User who suggested this café via suggest_place (rate-limit tracking).';

-- ---------------------------------------------------------------------------
-- 2) Drop client INSERT policy (suggest_place is security definer)
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated insert own places" on public.places;
drop policy if exists "Vendors insert own places" on public.places;
drop policy if exists "Vendors can insert own places" on public.places;

-- ---------------------------------------------------------------------------
-- 3) suggest_place
-- ---------------------------------------------------------------------------
create or replace function public.suggest_place(
  p_name text,
  p_address text,
  p_city text,
  p_lat double precision,
  p_lng double precision
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_address text := btrim(coalesce(p_address, ''));
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_count integer;
  v_place_id uuid;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    return json_build_object('ok', false, 'error', 'invalid_name');
  end if;

  -- places.address is NOT NULL in production.
  if char_length(v_address) < 3 or char_length(v_address) > 200 then
    return json_build_object('ok', false, 'error', 'invalid_address');
  end if;

  if p_lat is null or p_lng is null
     or not (p_lat between -90 and 90)
     or not (p_lng between -180 and 180) then
    return json_build_object('ok', false, 'error', 'invalid_coords');
  end if;

  -- Serialise concurrent suggestions from the same user for the rate limit.
  perform pg_advisory_xact_lock(hashtext('suggest_place:' || v_uid::text));

  select count(*)::integer into v_count
  from public.places p
  where p.suggested_by = v_uid
    and p.created_at > now() - interval '24 hours';

  if v_count >= 3 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;

  -- vendor_id null: places_default_verification_on_insert sets 'unclaimed'.
  insert into public.places (
    name, address, city, lat, lng, latitude, longitude, location,
    vendor_id, suggested_by
  )
  values (
    v_name, v_address, v_city, p_lat, p_lng, p_lat, p_lng,
    st_geogfromtext(format('SRID=4326;POINT(%s %s)', p_lng, p_lat)),
    null, v_uid
  )
  returning id into v_place_id;

  return json_build_object('ok', true, 'place_id', v_place_id);
end;
$$;

comment on function public.suggest_place(text, text, text, double precision, double precision) is
  'Authenticated users suggest an unclaimed café (vendor_id null). Max 3 / 24h.';

revoke all on function public.suggest_place(text, text, text, double precision, double precision)
  from public, anon;
grant execute on function public.suggest_place(text, text, text, double precision, double precision)
  to authenticated;
