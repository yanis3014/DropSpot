-- place_events / log_place_event / pro_place_summary.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/place_stats.sql

begin;

do $$
declare
  u_owner_a uuid := 'd1111111-1111-4111-8111-111111111111';
  u_manager_a uuid := 'd2222222-2222-4222-8222-222222222222';
  u_staff_a uuid := 'd3333333-3333-4333-8333-333333333333';
  u_owner_b uuid := 'd4444444-4444-4444-8444-444444444444';
  u_visitor uuid := 'd5555555-5555-4555-8555-555555555555';
  place_a uuid := 'e1111111-1111-4111-8111-111111111111';
  place_b uuid := 'e2222222-2222-4222-8222-222222222222';
  v_anon uuid := 'f1111111-1111-4111-8111-111111111111';
  v_drop uuid := 'f2222222-2222-4222-8222-222222222222';
  v_count integer;
  v_result json;
  v_err text;
  v_until timestamptz := now();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (u_owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'stats-owner-a@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now()),
    (u_manager_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'stats-manager-a@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now()),
    (u_staff_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'stats-staff-a@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now()),
    (u_owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'stats-owner-b@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now()),
    (u_visitor, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'stats-visitor@test.local', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (
    id, full_name, role, grains_balance,
    onboarding_completed_at, welcome_grains_claimed_at,
    preferences, onboarding_answers
  )
  values
    (u_owner_a, 'Owner A Stats', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (u_manager_a, 'Manager A Stats', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (u_staff_a, 'Staff A Stats', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (u_owner_b, 'Owner B Stats', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (u_visitor, 'Visitor Stats', 'user', 0, now(), now(), '{}', '{}'::jsonb)
  on conflict (id) do update set full_name = excluded.full_name;

  insert into public.places (id, name, vendor_id, lat, lng, verification_status)
  values
    (place_a, 'Stats Cafe A', u_owner_a, 43.70, 7.26, 'verified'),
    (place_b, 'Stats Cafe B', u_owner_b, 43.71, 7.27, 'verified')
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

  -- Owner A starts free; Pro is granted later for the 30-day case.
  insert into public.vendor_plans (user_id, plan, pro_until)
  values (u_owner_a, 'free', null), (u_owner_b, 'free', null)
  on conflict (user_id) do update set plan = 'free', pro_until = null;

  delete from public.place_events where place_id in (place_a, place_b);
  delete from public.check_ins where place_id in (place_a, place_b);
  delete from public.saved_places where place_id in (place_a, place_b);
  delete from public.drop_codes where flash_drop_id = v_drop;
  delete from public.flash_drops where id = v_drop;

  -- -----------------------------------------------------------------------
  -- (1) anon with p_anon_id logs a view; two calls same day = 1 row
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';

  perform public.log_place_event(place_a, 'view', 'map', v_anon);
  perform public.log_place_event(place_a, 'view', 'map', v_anon);

  reset role;

  select count(*)::integer into v_count
  from public.place_events
  where place_id = place_a and kind = 'view';
  if v_count <> 1 then
    raise exception 'FAIL: anon double view same day should be 1 row, got %', v_count;
  end if;

  -- -----------------------------------------------------------------------
  -- (2) place member logging a view → 0 extra rows
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_owner_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  perform public.log_place_event(place_a, 'view', 'direct', null);

  reset role;

  select count(*)::integer into v_count
  from public.place_events
  where place_id = place_a and kind = 'view';
  if v_count <> 1 then
    raise exception 'FAIL: member view must not insert, got % rows', v_count;
  end if;

  -- -----------------------------------------------------------------------
  -- (3) authenticated cannot read place_events directly
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_visitor::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_visitor::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    select count(*)::integer into v_count from public.place_events;
    if v_count <> 0 then
      raise exception 'FAIL: authenticated must see 0 place_events rows, got %', v_count;
    end if;
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      -- permission denied is also acceptable
      null;
  end;

  -- visitor logs a second view (different hash)
  perform public.log_place_event(place_a, 'view', 'list', null);
  perform public.log_place_event(place_a, 'directions', 'direct', null);

  reset role;

  -- Seed check-ins, saves, redeemed codes (as table owner inside the DO block)
  insert into public.check_ins (user_id, place_id, crowd_level, wifi_speed, created_at)
  values
    (u_visitor, place_a, 'quiet', 'good', v_until - interval '1 day'),
    (u_visitor, place_a, 'moderate', 'slow', v_until - interval '2 days'),
    (u_owner_b, place_a, 'full', 'good', v_until - interval '3 days');

  -- A view on the Paris day exactly p_days before v_until is outside the window.
  insert into public.place_events (place_id, kind, source, viewer_hash, day)
  values (place_a, 'view', 'map', 'outside-window',
          ((v_until - interval '7 days') at time zone 'Europe/Paris')::date);

  insert into public.saved_places (user_id, place_id, created_at)
  values
    (u_visitor, place_a, v_until - interval '1 day'),
    (u_owner_b, place_a, v_until - interval '2 days');

  insert into public.flash_drops (
    id, vendor_id, place_id, title, starts_at, ends_at, is_active, kind
  )
  values (
    v_drop, u_owner_a, place_a, 'Stats drop',
    v_until - interval '2 days', v_until + interval '1 day', true, 'offer'
  );

  insert into public.drop_codes (
    flash_drop_id, user_id, code, status, issued_at, redeemed_at, redeemed_by
  )
  values (
    v_drop, u_visitor, 'PS9991', 'redeemed',
    v_until - interval '2 days', v_until - interval '1 day', u_owner_a
  );

  -- -----------------------------------------------------------------------
  -- (4) manager A on café B → forbidden
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_manager_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_manager_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    v_result := public.pro_place_summary(place_b, 7, v_until);
    raise exception 'FAIL: manager A on place B must be forbidden';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      v_err := sqlerrm;
      if v_err not like '%forbidden%' then
        raise exception 'FAIL: expected forbidden for manager A on B, got %', v_err;
      end if;
  end;

  reset role;

  -- -----------------------------------------------------------------------
  -- (5) staff of café A → forbidden
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_staff_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_staff_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    v_result := public.pro_place_summary(place_a, 7, v_until);
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
  -- (6) free manager with p_days = 30 → pro_required; Pro → OK
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_manager_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_manager_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    v_result := public.pro_place_summary(place_a, 30, v_until);
    raise exception 'FAIL: free plan p_days=30 must raise pro_required';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      v_err := sqlerrm;
      if v_err not like '%pro_required%' then
        raise exception 'FAIL: expected pro_required, got %', v_err;
      end if;
  end;

  reset role;

  insert into public.vendor_plans (user_id, plan, pro_until)
  values (u_owner_a, 'pro', v_until + interval '30 days')
  on conflict (user_id) do update
  set plan = 'pro', pro_until = excluded.pro_until;

  perform set_config('request.jwt.claim.sub', u_manager_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_manager_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.pro_place_summary(place_a, 30, v_until);
  if (v_result ->> 'days')::integer <> 30 then
    raise exception 'FAIL: Pro manager 30 days should succeed, got %', v_result;
  end if;

  -- -----------------------------------------------------------------------
  -- (7) figures match seeded rows (7-day window)
  -- -----------------------------------------------------------------------
  v_result := public.pro_place_summary(place_a, 7, v_until);

  if (v_result ->> 'views')::integer <> 2 then
    raise exception 'FAIL: expected 2 views, got %', v_result;
  end if;
  if (v_result ->> 'directions')::integer <> 1 then
    raise exception 'FAIL: expected 1 directions, got %', v_result;
  end if;
  if (v_result ->> 'check_ins')::integer <> 3 then
    raise exception 'FAIL: expected 3 check_ins, got %', v_result;
  end if;
  if (v_result ->> 'unique_visitors')::integer <> 2 then
    raise exception 'FAIL: expected 2 unique_visitors, got %', v_result;
  end if;
  if (v_result ->> 'saves')::integer <> 2 then
    raise exception 'FAIL: expected 2 saves, got %', v_result;
  end if;
  if (v_result ->> 'codes_redeemed')::integer <> 1 then
    raise exception 'FAIL: expected 1 codes_redeemed, got %', v_result;
  end if;

  -- No person identifiers in the payload
  if v_result::text ~* '(user_id|viewer_hash|email)' then
    raise exception 'FAIL: summary must not expose person identifiers: %', v_result;
  end if;

  reset role;

  raise notice 'place_stats: all assertions passed';
end $$;

rollback;
