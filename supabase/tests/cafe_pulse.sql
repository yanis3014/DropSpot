-- vote_place_spec / declare_place_spec / get_place_specs: votes on site only,
-- private votes, declarations by the café team, Grains through the ledger.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/cafe_pulse.sql

begin;

do $$
declare
  u_owner uuid := 'f0000000-0000-0000-0000-000000000001';
  u_a uuid := 'f1111111-1111-1111-1111-111111111111';
  u_b uuid := 'f2222222-2222-2222-2222-222222222222';
  u_c uuid := 'f3333333-3333-3333-3333-333333333333';
  v_place uuid;
  v_other uuid;
  v_result json;
  v_count integer;
  v_balance integer;
  v_spec record;
  v_i integer;
begin
  insert into auth.users (id, aud, role, email)
  values
    (u_owner, 'authenticated', 'authenticated', 'pulse-owner@test.local'),
    (u_a, 'authenticated', 'authenticated', 'pulse-a@test.local'),
    (u_b, 'authenticated', 'authenticated', 'pulse-b@test.local'),
    (u_c, 'authenticated', 'authenticated', 'pulse-c@test.local')
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, grains_balance)
  values (u_owner, 'Owner', 'vendor', 0), (u_a, 'A', 'user', 0),
         (u_b, 'B', 'user', 0), (u_c, 'C', 'user', 0)
  on conflict (id) do update set grains_balance = 0;

  insert into public.places (name, address, lat, lng, location)
  values ('Pulse Cafe', '1 rue Pulse', 43.7, 7.26,
          st_geogfromtext('SRID=4326;POINT(7.26 43.7)'))
  returning id into v_place;
  insert into public.places (name, address, lat, lng, location)
  values ('Other Cafe', '2 rue Pulse', 43.71, 7.27,
          st_geogfromtext('SRID=4326;POINT(7.27 43.71)'))
  returning id into v_other;

  insert into public.place_members (place_id, user_id, role)
  values (v_place, u_owner, 'owner');

  -- A, B and C are at Pulse Cafe (check-ins written as the table owner).
  insert into public.check_ins (user_id, place_id, crowd_level, wifi_speed)
  values (u_a, v_place, 'quiet', 'good'),
         (u_b, v_place, 'quiet', 'good'),
         (u_c, v_place, 'quiet', 'good');

  -- (1) anon can neither vote nor declare
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  begin
    v_result := public.vote_place_spec(v_place, 'matcha', true);
    if coalesce((v_result ->> 'ok')::boolean, false) then
      raise exception 'FAIL: anon must not vote';
    end if;
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      null;
  end;
  reset role;

  -- (2) A: invalid spec, not on site, direct insert refused, vote rewarded once
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_result := public.vote_place_spec(v_place, 'jacuzzi', true);
  if v_result ->> 'error' is distinct from 'invalid_input' then
    raise exception 'FAIL: expected invalid_input, got %', v_result;
  end if;
  v_result := public.vote_place_spec(v_other, 'matcha', true);
  if v_result ->> 'error' is distinct from 'not_here' then
    raise exception 'FAIL: expected not_here, got %', v_result;
  end if;
  begin
    insert into public.place_spec_votes (place_id, user_id, spec, vote)
    values (v_place, u_a, 'matcha', true);
    raise exception 'FAIL: direct insert into place_spec_votes must be refused';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      null;
  end;
  v_result := public.vote_place_spec(v_place, 'matcha', true);
  if (v_result ->> 'grains_awarded')::integer <> 5 then
    raise exception 'FAIL: first vote should award 5, got %', v_result;
  end if;
  v_result := public.vote_place_spec(v_place, 'matcha', false);
  if (v_result ->> 'grains_awarded')::integer <> 0
     or v_result ->> 'reason' is distinct from 'already_voted' then
    raise exception 'FAIL: changing a vote must not award again, got %', v_result;
  end if;
  v_result := public.vote_place_spec(v_place, 'matcha', true);

  -- A cannot declare (not in the team)
  v_result := public.declare_place_spec(v_place, 'terrace', true);
  if v_result ->> 'error' is distinct from 'forbidden' then
    raise exception 'FAIL: A must not declare, got %', v_result;
  end if;
  reset role;

  -- (3) B and C vote matcha yes; B cannot read A's vote
  perform set_config('request.jwt.claim.sub', u_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_b::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.vote_place_spec(v_place, 'matcha', true);
  v_result := public.vote_place_spec(v_place, 'wifi', false);
  select count(*)::integer into v_count from public.place_spec_votes;
  if v_count <> 2 then
    raise exception 'FAIL: B must only see own votes (saw %)', v_count;
  end if;
  select count(*)::integer into v_count from public.place_spec_declarations;
  if v_count <> 0 then
    raise exception 'FAIL: B must not read declarations (saw %)', v_count;
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', u_c::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_c::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.vote_place_spec(v_place, 'matcha', true);
  v_result := public.vote_place_spec(v_place, 'wifi', false);
  reset role;

  -- (4) Owner declares wifi and terrace, then removes terrace
  perform set_config('request.jwt.claim.sub', u_owner::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_owner::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.declare_place_spec(v_place, 'wifi', true);
  if not coalesce((v_result ->> 'ok')::boolean, false) then
    raise exception 'FAIL: owner should declare, got %', v_result;
  end if;
  v_result := public.declare_place_spec(v_place, 'terrace', true);
  v_result := public.declare_place_spec(v_place, 'terrace', null);
  select count(*)::integer into v_count from public.place_spec_declarations;
  if v_count <> 1 then
    raise exception 'FAIL: owner should see 1 declaration, got %', v_count;
  end if;
  reset role;

  -- (5) Consolidated state, readable by anon
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  select * into v_spec from public.get_place_specs(v_place) where spec = 'matcha';
  if v_spec.status is distinct from 'confirmed' or v_spec.yes_votes <> 3 then
    raise exception 'FAIL: matcha should be confirmed by 3, got % / %', v_spec.status, v_spec.yes_votes;
  end if;
  select * into v_spec from public.get_place_specs(v_place) where spec = 'wifi';
  if v_spec.status is distinct from 'disputed' or not v_spec.declared then
    raise exception 'FAIL: declared wifi with 2 No should be disputed, got %', v_spec.status;
  end if;
  select count(*)::integer into v_count from public.get_place_specs(v_place) where spec = 'terrace';
  if v_count <> 0 then
    raise exception 'FAIL: removed declaration should disappear';
  end if;
  select count(*)::integer into v_count from public.place_spec_votes;
  if v_count <> 0 then
    raise exception 'FAIL: anon must not read votes (saw %)', v_count;
  end if;
  reset role;

  -- (6) Ledger and balances
  select grains_balance into v_balance from public.profiles where id = u_a;
  if v_balance <> 5 then
    raise exception 'FAIL: A balance should be 5, got %', v_balance;
  end if;
  select count(*)::integer into v_count
  from public.grains_transactions where reason = 'spec_vote';
  if v_count <> 5 then
    raise exception 'FAIL: expected 5 spec_vote ledger rows, got %', v_count;
  end if;

  -- (7) Daily cap: 6 rewarded votes per 24 h (A already has 1)
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  for v_i in 1..6 loop
    v_result := public.vote_place_spec(
      v_place, (array['wifi', 'plugs', 'calm', 'laptop', 'terrace', 'brunch'])[v_i], true);
    if v_i <= 5 and (v_result ->> 'grains_awarded')::integer <> 5 then
      raise exception 'FAIL: vote #% should award 5, got %', v_i, v_result;
    end if;
    if v_i = 6 and v_result ->> 'reason' is distinct from 'daily_cap' then
      raise exception 'FAIL: 7th rewarded vote should hit daily_cap, got %', v_result;
    end if;
  end loop;
  reset role;

  select grains_balance into v_balance from public.profiles where id = u_a;
  if v_balance <> 30 then
    raise exception 'FAIL: A balance should be 30 after cap, got %', v_balance;
  end if;
end;
$$;

rollback;
