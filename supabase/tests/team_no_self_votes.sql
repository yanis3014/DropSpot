-- Pen test 2026-11-12 (migration 20261112100000): the café team does not
-- check in or vote on its own café, other people still can.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/team_no_self_votes.sql
-- Runs in a transaction and rolls back.

begin;

do $$
declare
  owner_a uuid := 'a1111111-aaaa-4111-8111-111111111112';
  staff_a uuid := 'a1111111-aaaa-4111-8111-111111111113';
  client_c uuid := 'c3333333-cccc-4333-8333-333333333334';
  place_a uuid := 'a4444444-aaaa-4444-8444-444444444445';
  place_b uuid := 'b5555555-bbbb-4555-8555-555555555556';
  v_json json;
  v_count integer;
  v_who uuid;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  select x, '00000000-0000-0000-0000-000000000000', 'authenticated',
         'authenticated', 'team-' || x::text || '@test.local', crypt('x', gen_salt('bf')),
         now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
         now(), now()
  from unnest(array[owner_a, staff_a, client_c]) x
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, grains_balance, preferences, onboarding_answers)
  values
    (owner_a, 'Team Owner A', 'vendor', 0, '{}', '{}'::jsonb),
    (staff_a, 'Team Staff A', 'vendor', 0, '{}', '{}'::jsonb),
    (client_c, 'Team Client C', 'user', 0, '{}', '{}'::jsonb)
  on conflict (id) do update set full_name = excluded.full_name;

  insert into public.places (id, name, address, location, lat, lng, verification_status)
  values
    (place_a, 'Team Cafe A', '1 rue A', st_setsrid(st_makepoint(7.26, 43.70), 4326)::geography, 43.70, 7.26, 'verified'),
    (place_b, 'Team Cafe B', '2 rue B', st_setsrid(st_makepoint(7.27, 43.71), 4326)::geography, 43.71, 7.27, 'verified');

  insert into public.place_members (place_id, user_id, role)
  values (place_a, owner_a, 'owner'), (place_a, staff_a, 'staff');

  -- (1) Owner and staff of café A: check-in and vote refused at café A
  foreach v_who in array array[owner_a, staff_a] loop
    perform set_config('request.jwt.claim.sub', v_who::text, true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_who::text, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';

    v_json := public.check_in(place_a, 'quiet', 'good', 43.70, 7.26);
    if (v_json ->> 'ok')::boolean or v_json ->> 'error' <> 'own_place' then
      raise exception 'FAIL: team member % checked in at own café: %', v_who, v_json;
    end if;

    v_json := public.vote_place_spec(place_a, 'matcha', true);
    if (v_json ->> 'ok')::boolean or v_json ->> 'error' <> 'own_place' then
      raise exception 'FAIL: team member % voted on own café: %', v_who, v_json;
    end if;

    reset role;
  end loop;

  select count(*)::integer into v_count
  from public.grains_transactions
  where user_id in (owner_a, staff_a);
  if v_count <> 0 then
    raise exception 'FAIL: the team earned % Grains rows at its own café', v_count;
  end if;

  select count(*)::integer into v_count
  from public.place_spec_votes
  where place_id = place_a and user_id in (owner_a, staff_a);
  if v_count <> 0 then
    raise exception 'FAIL: % team votes recorded on own café', v_count;
  end if;

  -- (2) The owner of café A is a normal visitor at café B
  perform set_config('request.jwt.claim.sub', owner_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', owner_a::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_json := public.check_in(place_b, 'quiet', 'good', 43.71, 7.27);
  if not coalesce((v_json ->> 'ok')::boolean, false) then
    raise exception 'FAIL: owner A must still check in at café B: %', v_json;
  end if;
  v_json := public.vote_place_spec(place_b, 'calm', true);
  if not coalesce((v_json ->> 'ok')::boolean, false) then
    raise exception 'FAIL: owner A must still vote at café B: %', v_json;
  end if;
  reset role;

  -- (3) A client still checks in and votes at café A
  perform set_config('request.jwt.claim.sub', client_c::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', client_c::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_json := public.check_in(place_a, 'moderate', 'good', 43.70, 7.26);
  if not coalesce((v_json ->> 'ok')::boolean, false) or (v_json ->> 'grains_awarded')::integer <> 10 then
    raise exception 'FAIL: client check-in at café A must pay 10 Grains: %', v_json;
  end if;
  v_json := public.vote_place_spec(place_a, 'matcha', true);
  if not coalesce((v_json ->> 'ok')::boolean, false) or (v_json ->> 'grains_awarded')::integer <> 5 then
    raise exception 'FAIL: client vote at café A must pay 5 Grains: %', v_json;
  end if;
  reset role;

  raise notice 'team_no_self_votes: all checks passed';
end $$;

rollback;
