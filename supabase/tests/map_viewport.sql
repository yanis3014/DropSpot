-- places_in_bbox / get_places_specs (map loads the visible area only).
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/map_viewport.sql
-- Rolls back at end.

begin;

do $$
declare
  v_in uuid := 'b0000000-0000-0000-0000-000000000001';
  v_latlong uuid := 'b0000000-0000-0000-0000-000000000002';
  v_out uuid := 'b0000000-0000-0000-0000-000000000003';
  v_user uuid := 'b0000000-0000-0000-0000-0000000000aa';
  v_ids uuid[];
  v_count integer;
begin
  insert into auth.users (id, email, created_at) values (v_user, 'bbox@test.local', now());

  -- Inside the box with lat/lng, inside with latitude/longitude only, outside.
  insert into public.places (id, name, address, lat, lng, location)
  values
    (v_in, 'BBox In', '1 rue', 43.700, 7.260, st_geogfromtext('SRID=4326;POINT(7.26 43.7)')),
    (v_out, 'BBox Out', '3 rue', 45.000, 7.260, st_geogfromtext('SRID=4326;POINT(7.26 45)'));
  insert into public.places (id, name, address, latitude, longitude, location)
  values (v_latlong, 'BBox LatLong', '2 rue', 43.701, 7.261, st_geogfromtext('SRID=4326;POINT(7.261 43.701)'));

  insert into public.place_spec_votes (place_id, user_id, spec, vote)
  values (v_in, v_user, 'wifi', true), (v_out, v_user, 'wifi', true);
  perform public.refresh_spec_caches();

  execute 'set local role anon';

  select array_agg(id order by name) into v_ids
  from public.places_in_bbox(7.25, 43.69, 7.27, 43.71);
  if v_ids is distinct from array[v_in, v_latlong] then
    raise exception 'FAIL: expected the two cafés inside the box, got %', v_ids;
  end if;

  select count(*)::integer into v_count from public.places_in_bbox(7.25, 43.69, 7.27, 43.71, 1);
  if v_count <> 1 then
    raise exception 'FAIL: p_limit not applied, got %', v_count;
  end if;

  select count(*)::integer into v_count from public.places_in_bbox(null, 43.69, 7.27, 43.71);
  if v_count <> 0 then
    raise exception 'FAIL: a missing bound must return nothing, got %', v_count;
  end if;

  select count(*)::integer into v_count
  from public.get_places_specs(array[v_in, v_latlong, null]);
  if v_count <> 1 then
    raise exception 'FAIL: get_places_specs should only return the listed cafés, got %', v_count;
  end if;

  select count(*)::integer into v_count from public.get_places_specs(null);
  if v_count <> 0 then
    raise exception 'FAIL: get_places_specs(null) should return nothing, got %', v_count;
  end if;

  reset role;
end;
$$;

rollback;
