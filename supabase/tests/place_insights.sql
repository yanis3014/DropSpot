-- pro_place_insights: access, Pro gate, audience threshold, Paris hours, no person ids.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/place_insights.sql

begin;

do $$
declare
  u_owner_a uuid := 'a1111111-1111-4111-8111-111111111111';
  u_manager_a uuid := 'a2222222-2222-4222-8222-222222222222';
  u_staff_a uuid := 'a3333333-3333-4333-8333-333333333333';
  u_owner_b uuid := 'a4444444-4444-4444-8444-444444444444';
  u_v1 uuid := 'a5555555-5555-4555-8555-555555555551';
  u_v2 uuid := 'a5555555-5555-4555-8555-555555555552';
  u_v3 uuid := 'a5555555-5555-4555-8555-555555555553';
  u_v4 uuid := 'a5555555-5555-4555-8555-555555555554';
  u_v5 uuid := 'a5555555-5555-4555-8555-555555555555';
  place_a uuid := 'b1111111-1111-4111-8111-111111111111';
  place_b uuid := 'b2222222-2222-4222-8222-222222222222';
  v_drop uuid := 'b3333333-3333-4333-8333-333333333333';
  v_result json;
  v_err text;
  v_until timestamptz := now();
  v_oct_utc timestamptz;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (u_owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'insights-owner-a@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now()),
    (u_manager_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'insights-manager-a@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now()),
    (u_staff_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'insights-staff-a@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now()),
    (u_owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'insights-owner-b@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now()),
    (u_v1, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'insights-v1@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now()),
    (u_v2, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'insights-v2@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now()),
    (u_v3, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'insights-v3@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now()),
    (u_v4, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'insights-v4@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now()),
    (u_v5, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'insights-v5@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (
    id, full_name, role, grains_balance,
    onboarding_completed_at, welcome_grains_claimed_at,
    preferences, onboarding_answers
  )
  values
    (u_owner_a, 'Alice Owner Insights', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (u_manager_a, 'Bob Manager Insights', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (u_staff_a, 'Carol Staff Insights', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (u_owner_b, 'Dan Owner B Insights', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (u_v1, 'Visitor One', 'user', 0, now(), now(), '{}',
      '{"envies":["work","chill"]}'::jsonb),
    (u_v2, 'Visitor Two', 'user', 0, now(), now(), '{}',
      '{"envies":["work"]}'::jsonb),
    (u_v3, 'Visitor Three', 'user', 0, now(), now(), '{}',
      '{"envies":["brunch"]}'::jsonb),
    (u_v4, 'Visitor Four', 'user', 0, now(), now(), '{}',
      '{"envies":["terrace"]}'::jsonb),
    (u_v5, 'Visitor Five', 'user', 0, now(), now(), '{}',
      '{"envies":["work","events"]}'::jsonb)
  on conflict (id) do update set
    full_name = excluded.full_name,
    onboarding_answers = excluded.onboarding_answers;

  insert into public.places (id, name, address, location, vendor_id, lat, lng, verification_status)
  values
    (place_a, 'Insights Cafe A', '1 rue Test, Nice', 'SRID=4326;POINT(7.26 43.70)', u_owner_a, 43.70, 7.26, 'verified'),
    (place_b, 'Insights Cafe B', '2 rue Test, Nice', 'SRID=4326;POINT(7.27 43.71)', u_owner_b, 43.71, 7.27, 'verified')
  on conflict (id) do update set
    vendor_id = excluded.vendor_id,
    name = excluded.name,
    verification_status = excluded.verification_status;

  insert into public.place_members (place_id, user_id, role)
  values
    (place_a, u_owner_a, 'owner'),
    (place_a, u_manager_a, 'manager'),
    (place_a, u_staff_a, 'staff'),
    (place_b, u_owner_b, 'owner')
  on conflict (place_id, user_id) do update set role = excluded.role;

  -- Free plan first (pro_required cases).
  insert into public.vendor_plans (user_id, plan, pro_until)
  values (u_owner_a, 'free', null), (u_owner_b, 'free', null)
  on conflict (user_id) do update set plan = 'free', pro_until = null;

  delete from public.check_ins where place_id in (place_a, place_b);
  delete from public.drop_codes where flash_drop_id = v_drop;
  delete from public.drop_participations where flash_drop_id = v_drop;
  delete from public.flash_drops where id = v_drop;
  delete from public.place_events where place_id in (place_a, place_b);

  -- -----------------------------------------------------------------------
  -- (1) manager of café B → forbidden on place_a
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_owner_b::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    v_result := public.pro_place_insights(place_a, 30);
    raise exception 'FAIL: owner B on place A must be forbidden';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      v_err := sqlerrm;
      if v_err not like '%forbidden%' then
        raise exception 'FAIL: expected forbidden for other café, got %', v_err;
      end if;
  end;

  reset role;

  -- -----------------------------------------------------------------------
  -- (2) staff of café A → forbidden
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_staff_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_staff_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    v_result := public.pro_place_insights(place_a, 30);
    raise exception 'FAIL: staff must be forbidden';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      v_err := sqlerrm;
      if v_err not like '%forbidden%' then
        raise exception 'FAIL: expected forbidden for staff, got %', v_err;
      end if;
  end;

  reset role;

  -- -----------------------------------------------------------------------
  -- (3) free café → pro_required
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_manager_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_manager_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    v_result := public.pro_place_insights(place_a, 30);
    raise exception 'FAIL: free plan must raise pro_required';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      v_err := sqlerrm;
      if v_err not like '%pro_required%' then
        raise exception 'FAIL: expected pro_required, got %', v_err;
      end if;
  end;

  reset role;

  -- Grant Pro on café A.
  insert into public.vendor_plans (user_id, plan, pro_until)
  values (u_owner_a, 'pro', v_until + interval '30 days')
  on conflict (user_id) do update
  set plan = 'pro', pro_until = excluded.pro_until;

  -- Seed: overlapping drop + redeemed code by owner (team member).
  insert into public.flash_drops (
    id, vendor_id, place_id, title, starts_at, ends_at, is_active, kind
  )
  values (
    v_drop, u_owner_a, place_a, 'Insights drop',
    v_until - interval '2 days', v_until + interval '1 day', true, 'offer'
  );

  insert into public.drop_codes (
    flash_drop_id, user_id, code, status, issued_at, redeemed_at, redeemed_by
  )
  values (
    v_drop, u_v1, 'IN9911', 'redeemed',
    v_until - interval '2 days', v_until - interval '1 day', u_owner_a
  );

  -- 10:00 Europe/Paris two days ago (by_hour index 10).
  v_oct_utc := (
    (((v_until at time zone 'Europe/Paris')::date - 2)::text || ' 10:00:00')::timestamp
    at time zone 'Europe/Paris'
  );

  insert into public.check_ins (user_id, place_id, crowd_level, wifi_speed, created_at)
  values
    (u_v1, place_a, 'quiet', 'good', v_oct_utc),
    (u_v1, place_a, 'quiet', 'good', v_oct_utc - interval '1 day'),
    (u_v2, place_a, 'moderate', 'slow', v_until - interval '1 day'),
    (u_v3, place_a, 'full', 'good', v_until - interval '2 days'),
    (u_v4, place_a, 'quiet', null, v_until - interval '3 days');

  -- -----------------------------------------------------------------------
  -- (4) manager Pro → team is null
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_manager_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_manager_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.pro_place_insights(place_a, 30);
  if json_typeof(v_result -> 'team') is distinct from 'null' then
    raise exception 'FAIL: manager team must be null, got %', v_result -> 'team';
  end if;

  -- 4 visitors → audience null
  if json_typeof(v_result -> 'audience') is distinct from 'null' then
    raise exception 'FAIL: 4 visitors must yield null audience, got %',
      v_result -> 'audience';
  end if;

  -- by_hour: 08:30 UTC mid-October → Paris hour 10
  if (v_result -> 'by_hour' ->> 10)::integer < 1 then
    raise exception 'FAIL: expected check-in at Paris hour 10, by_hour=%',
      v_result -> 'by_hour';
  end if;

  if v_result::text ~* '(user_id|viewer_hash|email)' then
    raise exception 'FAIL: insights must not expose person identifiers: %', v_result;
  end if;

  reset role;

  -- -----------------------------------------------------------------------
  -- (5) owner Pro → team filled; 5th visitor → audience filled
  -- -----------------------------------------------------------------------
  insert into public.check_ins (user_id, place_id, crowd_level, wifi_speed, created_at)
  values (u_v5, place_a, 'moderate', 'good', v_until - interval '4 days');

  perform set_config('request.jwt.claim.sub', u_owner_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.pro_place_insights(place_a, 30);

  if json_typeof(v_result -> 'team') is distinct from 'array'
     or json_array_length(v_result -> 'team') < 1 then
    raise exception 'FAIL: owner team must be filled, got %', v_result -> 'team';
  end if;

  if (v_result -> 'team' -> 0 ->> 'first_name') is distinct from 'Alice' then
    raise exception 'FAIL: expected first_name Alice, got %',
      v_result -> 'team' -> 0;
  end if;

  if json_typeof(v_result -> 'audience') is distinct from 'object' then
    raise exception 'FAIL: 5 visitors must yield audience object, got %',
      v_result -> 'audience';
  end if;

  if (v_result -> 'audience' ->> 'work') is null then
    raise exception 'FAIL: audience should include work share, got %',
      v_result -> 'audience';
  end if;

  if v_result::text ~* '(user_id|viewer_hash|email)' then
    raise exception 'FAIL: insights must not expose person identifiers: %', v_result;
  end if;

  reset role;

  raise notice 'place_insights: all assertions passed';
end $$;

rollback;
