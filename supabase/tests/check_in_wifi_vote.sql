-- The Wi-Fi answer of a check-in counts as a vote on the wifi specificity,
-- so the map « Wi-Fi » filter fills up from check-ins.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/check_in_wifi_vote.sql

begin;

do $$
declare
  u_a uuid := 'b1111111-1111-1111-1111-111111111111';
  u_b uuid := 'b2222222-2222-2222-2222-222222222222';
  u_c uuid := 'b3333333-3333-3333-3333-333333333333';
  v_place uuid;
  v_result json;
  v_spec record;
  v_count integer;
  v_balance integer;
  v_user uuid;
begin
  insert into auth.users (id, aud, role, email)
  values
    (u_a, 'authenticated', 'authenticated', 'wv-a@test.local'),
    (u_b, 'authenticated', 'authenticated', 'wv-b@test.local'),
    (u_c, 'authenticated', 'authenticated', 'wv-c@test.local')
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, grains_balance)
  values (u_a, 'A', 'user', 0), (u_b, 'B', 'user', 0), (u_c, 'C', 'user', 0)
  on conflict (id) do update set grains_balance = 0;

  insert into public.places (name, address, lat, lng, location)
  values ('Wifi Vote Cafe', '1 rue Wifi', 43.7000, 7.2600,
          st_geogfromtext('SRID=4326;POINT(7.2600 43.7000)'))
  returning id into v_place;

  -- (1) A checks in with « bon Wi-Fi »: a Yes vote, Grains of the check-in only
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.check_in(v_place, 'quiet', 'good', 43.7, 7.26);
  reset role;
  if (v_result ->> 'grains_awarded')::integer <> 10 then
    raise exception 'FAIL: check-in should award 10 only, got %', v_result;
  end if;
  select count(*)::integer into v_count from public.place_spec_votes
  where place_id = v_place and user_id = u_a and spec = 'wifi' and vote;
  if v_count <> 1 then
    raise exception 'FAIL: good Wi-Fi should be a Yes vote';
  end if;
  select count(*)::integer into v_count from public.grains_transactions
  where user_id = u_a and reason = 'spec_vote';
  if v_count <> 0 then
    raise exception 'FAIL: the Wi-Fi vote of a check-in must not pay Grains';
  end if;

  -- One Yes: pending with more Yes than No (shown by the filter)
  select * into v_spec from public.get_place_specs(v_place) s where s.spec = 'wifi';
  if v_spec.status <> 'pending' or v_spec.yes_votes <> 1 then
    raise exception 'FAIL: expected pending 1 yes, got % %', v_spec.status, v_spec.yes_votes;
  end if;

  -- (2) A checks in again with « lent »: same vote flipped, not a second vote
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.check_in(v_place, 'quiet', 'slow', 43.7, 7.26);
  reset role;
  select count(*)::integer into v_count from public.place_spec_votes
  where place_id = v_place and user_id = u_a and spec = 'wifi';
  if v_count <> 1 then
    raise exception 'FAIL: one Wi-Fi vote per person and café, got %', v_count;
  end if;
  select * into v_spec from public.get_place_specs(v_place) s where s.spec = 'wifi';
  if v_spec.yes_votes <> 0 or v_spec.no_votes <> 1 then
    raise exception 'FAIL: latest answer should win, got % yes % no', v_spec.yes_votes, v_spec.no_votes;
  end if;

  -- (3) A, B, C say « bon »: confirmed
  foreach v_user in array array[u_a, u_b, u_c] loop
    perform set_config('request.jwt.claim.sub', v_user::text, true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v_result := public.check_in(v_place, 'moderate', 'good', 43.7, 7.26);
    reset role;
  end loop;
  select * into v_spec from public.get_place_specs(v_place) s where s.spec = 'wifi';
  if v_spec.status <> 'confirmed' or v_spec.yes_votes <> 3 then
    raise exception 'FAIL: 3 good answers should confirm, got % %', v_spec.status, v_spec.yes_votes;
  end if;

  -- (4) A too far away: no check-in, no vote change
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.check_in(v_place, 'quiet', 'slow', 43.8, 7.26);
  if v_result ->> 'error' is distinct from 'too_far' then
    raise exception 'FAIL: expected too_far, got %', v_result;
  end if;
  -- Still no direct write to the votes
  begin
    insert into public.place_spec_votes (place_id, user_id, spec, vote)
    values (v_place, u_a, 'wifi', false);
    raise exception 'FAIL: direct insert into place_spec_votes must be refused';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      null;
  end;
  reset role;
  select count(*)::integer into v_count from public.place_spec_votes
  where place_id = v_place and spec = 'wifi' and vote;
  if v_count <> 3 then
    raise exception 'FAIL: votes changed by a refused check-in';
  end if;

  -- (5) The wifi question after a check-in: already voted, no Grains
  perform set_config('request.jwt.claim.sub', u_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_b::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.vote_place_spec(v_place, 'wifi', true);
  reset role;
  if v_result ->> 'reason' is distinct from 'already_voted'
     or (v_result ->> 'grains_awarded')::integer <> 0 then
    raise exception 'FAIL: expected already_voted with 0 Grains, got %', v_result;
  end if;

  raise notice 'PASS check_in_wifi_vote';
end;
$$;

rollback;
