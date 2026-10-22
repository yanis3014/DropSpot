-- check_in / get_place_vibes: check-ins private, presence checked in the
-- database, Grains through the ledger, cooldown and daily cap.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/check_in_server.sql

begin;

do $$
declare
  u_a uuid := 'c1111111-1111-1111-1111-111111111111';
  u_b uuid := 'c2222222-2222-2222-2222-222222222222';
  v_place uuid;
  v_far_place uuid;
  v_extra uuid;
  v_result json;
  v_count integer;
  v_balance integer;
  v_i integer;
  v_vibe record;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (u_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'checkin-a@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now()),
    (u_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'checkin-b@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, grains_balance)
  values (u_a, 'Checker A', 'user', 0), (u_b, 'Checker B', 'user', 0)
  on conflict (id) do update set grains_balance = 0;

  insert into public.places (name, address, lat, lng, location)
  values ('Check-in Cafe', '1 rue Test', 43.7000, 7.2600,
          st_geogfromtext('SRID=4326;POINT(7.2600 43.7000)'))
  returning id into v_place;

  insert into public.places (name, address, lat, lng, location)
  values ('Far Cafe', '2 rue Test', 43.7100, 7.2700,
          st_geogfromtext('SRID=4326;POINT(7.2700 43.7100)'))
  returning id into v_far_place;

  -- -----------------------------------------------------------------------
  -- (1) anon cannot call check_in
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  begin
    v_result := public.check_in(v_place, 'quiet', 'good', 43.7, 7.26);
    if coalesce((v_result ->> 'ok')::boolean, false) is true then
      raise exception 'FAIL: anon must not check in';
    end if;
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      null;
  end;
  reset role;

  -- -----------------------------------------------------------------------
  -- (2) A: direct insert refused, invalid input, too far
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    insert into public.check_ins (user_id, place_id, crowd_level, wifi_speed)
    values (u_a, v_place, 'quiet', 'good');
    raise exception 'FAIL: direct insert into check_ins must be refused';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      null;
  end;

  v_result := public.check_in(v_place, 'packed', 'good', 43.7, 7.26);
  if v_result ->> 'error' is distinct from 'invalid_input' then
    raise exception 'FAIL: expected invalid_input, got %', v_result;
  end if;

  v_result := public.check_in(v_place, 'quiet', 'good', null, null);
  if v_result ->> 'error' is distinct from 'no_gps' then
    raise exception 'FAIL: expected no_gps, got %', v_result;
  end if;

  -- ~1.4 km away from Far Cafe
  v_result := public.check_in(v_far_place, 'quiet', 'good', 43.7, 7.26);
  if v_result ->> 'error' is distinct from 'too_far' then
    raise exception 'FAIL: expected too_far, got %', v_result;
  end if;

  -- -----------------------------------------------------------------------
  -- (3) A checks in on site (≈ 30 m): +10 Grains, ledger row
  -- -----------------------------------------------------------------------
  v_result := public.check_in(v_place, 'quiet', 'good', 43.70027, 7.2600);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
     or (v_result ->> 'grains_awarded')::integer <> 10 then
    raise exception 'FAIL: on-site check-in should award 10, got %', v_result;
  end if;

  -- Second check-in within 3 h: vibe updated, no Grains
  v_result := public.check_in(v_place, 'full', 'slow', 43.7, 7.26);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
     or (v_result ->> 'grains_awarded')::integer <> 0
     or v_result ->> 'reason' is distinct from 'cooldown' then
    raise exception 'FAIL: expected cooldown with 0 Grains, got %', v_result;
  end if;

  select count(*)::integer into v_count from public.check_ins where user_id = u_a;
  if v_count <> 2 then
    raise exception 'FAIL: A should see 2 own check-ins, got %', v_count;
  end if;
  reset role;

  select grains_balance into v_balance from public.profiles where id = u_a;
  if v_balance <> 10 then
    raise exception 'FAIL: A balance should be 10, got %', v_balance;
  end if;
  select count(*)::integer into v_count
  from public.grains_transactions where user_id = u_a and reason = 'check_in';
  if v_count <> 1 then
    raise exception 'FAIL: expected 1 check_in ledger row, got %', v_count;
  end if;

  -- -----------------------------------------------------------------------
  -- (4) B and anon cannot read A's check-ins; vibes are public, no user ids
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_b::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*)::integer into v_count from public.check_ins where user_id = u_a;
  if v_count <> 0 then
    raise exception 'FAIL: B must not read A check-ins (saw %)', v_count;
  end if;
  v_result := public.check_in(v_place, 'moderate', 'slow', 43.7, 7.26);
  if (v_result ->> 'grains_awarded')::integer <> 10 then
    raise exception 'FAIL: B first check-in should award 10, got %', v_result;
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  select count(*)::integer into v_count from public.check_ins;
  if v_count <> 0 then
    raise exception 'FAIL: anon must not read check-ins (saw %)', v_count;
  end if;

  select * into v_vibe from public.get_place_vibes(v_place);
  if v_vibe.contributors <> 2 then
    raise exception 'FAIL: expected 2 distinct contributors, got %', v_vibe.contributors;
  end if;
  -- One vote each for quiet / full / moderate (same now() in this transaction).
  if v_vibe.crowd_level is null then
    raise exception 'FAIL: expected a crowd level';
  end if;
  if v_vibe.wifi_speed is distinct from 'slow' then
    raise exception 'FAIL: expected slow (2 votes), got %', v_vibe.wifi_speed;
  end if;
  reset role;

  -- -----------------------------------------------------------------------
  -- (5) Daily cap: 5 rewarded check-ins per 24 h
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text, true);
  for v_i in 1..5 loop
    insert into public.places (name, address, lat, lng, location)
    values ('Cap Cafe ' || v_i, 'rue Cap', 43.7, 7.26,
            st_geogfromtext('SRID=4326;POINT(7.26 43.7)'))
    returning id into v_extra;
    execute 'set local role authenticated';
    v_result := public.check_in(v_extra, 'quiet', 'good', 43.7, 7.26);
    reset role;
    if v_i <= 4 and (v_result ->> 'grains_awarded')::integer <> 10 then
      raise exception 'FAIL: check-in #% should award 10, got %', v_i, v_result;
    end if;
    if v_i = 5 and v_result ->> 'reason' is distinct from 'daily_cap' then
      raise exception 'FAIL: 6th rewarded check-in should hit daily_cap, got %', v_result;
    end if;
  end loop;

  select grains_balance into v_balance from public.profiles where id = u_a;
  if v_balance <> 50 then
    raise exception 'FAIL: A balance should be 50 after cap, got %', v_balance;
  end if;
end;
$$;

rollback;
