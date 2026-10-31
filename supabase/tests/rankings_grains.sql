-- Grains scale (event presence, suggested café), lifetime status and reserved
-- places, rankings per specificity.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rankings_grains.sql

begin;

do $$
declare
  u_vendor uuid := 'a0000000-0000-0000-0000-000000000001';
  u_a uuid := 'a1111111-1111-1111-1111-111111111111';
  u_b uuid := 'a2222222-2222-2222-2222-222222222222';
  u_vip uuid := 'a3333333-3333-3333-3333-333333333333';
  v_place uuid;
  v_place2 uuid;
  v_suggested uuid;
  v_event uuid;
  v_far_event uuid;
  v_limited uuid;
  v_result json;
  v_count integer;
  v_balance integer;
  v_i integer;
  v_user uuid;
  v_rank record;
begin
  insert into auth.users (id, aud, role, email)
  values
    (u_vendor, 'authenticated', 'authenticated', 'rg-vendor@test.local'),
    (u_a, 'authenticated', 'authenticated', 'rg-a@test.local'),
    (u_b, 'authenticated', 'authenticated', 'rg-b@test.local'),
    (u_vip, 'authenticated', 'authenticated', 'rg-vip@test.local')
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, grains_balance)
  values (u_vendor, 'Vendor', 'vendor', 0), (u_a, 'A', 'user', 0),
         (u_b, 'B', 'user', 0), (u_vip, 'VIP', 'user', 0)
  on conflict (id) do update set grains_balance = 0;

  insert into public.places (name, address, lat, lng, location, vendor_id)
  values ('Rank Cafe', '1 rue Rang', 43.7, 7.26,
          st_geogfromtext('SRID=4326;POINT(7.26 43.7)'), u_vendor)
  returning id into v_place;
  insert into public.places (name, address, lat, lng, location)
  values ('Second Cafe', '2 rue Rang', 43.71, 7.27,
          st_geogfromtext('SRID=4326;POINT(7.27 43.71)'))
  returning id into v_place2;

  -- VIP already earned 150 Grains (Explorateur), as the table owner.
  insert into public.grains_transactions (user_id, amount, reason)
  values (u_vip, 150, 'adjustment');
  update public.profiles set grains_balance = 150 where id = u_vip;

  insert into public.flash_drops (vendor_id, place_id, title, starts_at, ends_at, kind, event_category)
  values (u_vendor, v_place, 'Run en cours', now() - interval '10 minutes',
          now() + interval '1 hour', 'activity', 'sport')
  returning id into v_event;
  insert into public.flash_drops (vendor_id, place_id, title, starts_at, ends_at, kind, event_category)
  values (u_vendor, v_place2, 'DJ set ailleurs', now() - interval '10 minutes',
          now() + interval '1 hour', 'activity', 'music')
  returning id into v_far_event;
  -- 5 places, 1 reserved, in 3 days.
  insert into public.flash_drops (vendor_id, place_id, title, starts_at, ends_at, kind, event_category, max_uses)
  values (u_vendor, v_place, 'Atelier latte art', now() + interval '3 days',
          now() + interval '3 days 2 hours', 'activity', 'workshop', 5)
  returning id into v_limited;

  -- (1) Lifetime helpers are not callable by clients
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.grains_lifetime(u_vip);
    raise exception 'FAIL: grains_lifetime must not be callable by clients';
  exception
    when insufficient_privilege then null;
  end;
  v_result := public.my_grains();
  if (v_result ->> 'lifetime')::integer <> 0 or (v_result ->> 'priority')::boolean then
    raise exception 'FAIL: A my_grains unexpected %', v_result;
  end if;

  -- (2) Event presence: A joined the run, checks in on site -> 10 + 20
  v_result := public.join_drop(v_event);
  v_result := public.join_drop(v_far_event);
  v_result := public.check_in(v_place, 'quiet', 'good', 43.7, 7.26);
  if (v_result ->> 'grains_awarded')::integer <> 30
     or (v_result ->> 'event_grains')::integer <> 20 then
    raise exception 'FAIL: expected 10 + 20 for event presence, got %', v_result;
  end if;
  -- Again within 3 h: neither the visit nor the event pays twice
  v_result := public.check_in(v_place, 'quiet', 'good', 43.7, 7.26);
  if (v_result ->> 'grains_awarded')::integer <> 0 then
    raise exception 'FAIL: second check-in should award 0, got %', v_result;
  end if;
  reset role;

  -- B did not join: only the visit
  perform set_config('request.jwt.claim.sub', u_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_b::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.check_in(v_place, 'moderate', 'good', 43.7, 7.26);
  if (v_result ->> 'event_grains')::integer <> 0 then
    raise exception 'FAIL: B did not join, got %', v_result;
  end if;
  reset role;

  select grains_balance into v_balance from public.profiles where id = u_a;
  if v_balance <> 30 then
    raise exception 'FAIL: A balance should be 30, got %', v_balance;
  end if;
  select count(*)::integer into v_count from public.grains_transactions
  where user_id = u_a and reason = 'event_presence' and ref_id = v_event;
  if v_count <> 1 then
    raise exception 'FAIL: expected one event_presence row, got %', v_count;
  end if;

  -- (3) Reserved place: 4 regular members fill 4 of 5, A is refused the last,
  --     VIP gets it
  for v_i in 1..4 loop
    v_user := ('b000000' || v_i || '-0000-0000-0000-000000000000')::uuid;
    insert into auth.users (id, aud, role, email)
    values (v_user, 'authenticated', 'authenticated', 'rg-fill' || v_i || '@test.local');
    insert into public.drop_participations (flash_drop_id, user_id) values (v_limited, v_user);
  end loop;

  perform set_config('request.jwt.claim.sub', u_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.join_drop(v_limited);
  if v_result ->> 'error' is distinct from 'priority_only' then
    raise exception 'FAIL: expected priority_only, got %', v_result;
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', u_vip::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_vip::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.join_drop(v_limited);
  if not coalesce((v_result ->> 'ok')::boolean, false) then
    raise exception 'FAIL: priority member should join, got %', v_result;
  end if;
  reset role;

  -- (4) Suggested café joins Dropspot: +50 once to the person who suggested it
  insert into public.places (name, address, lat, lng, location, suggested_by)
  values ('Suggested Cafe', '3 rue Rang', 43.72, 7.28,
          st_geogfromtext('SRID=4326;POINT(7.28 43.72)'), u_b)
  returning id into v_suggested;
  update public.places set verification_status = 'verified' where id = v_suggested;
  update public.places set verification_status = 'pending' where id = v_suggested;
  update public.places set verification_status = 'verified' where id = v_suggested;
  select count(*)::integer into v_count from public.grains_transactions
  where user_id = u_b and reason = 'place_suggested';
  if v_count <> 1 then
    raise exception 'FAIL: expected one place_suggested row, got %', v_count;
  end if;

  -- (5) Rankings: Rank Cafe confirmed Wi-Fi (3 yes), Second Cafe announced
  insert into public.place_spec_votes (place_id, user_id, spec, vote)
  values (v_place, u_a, 'wifi', true), (v_place, u_b, 'wifi', true),
         (v_place, u_vip, 'wifi', true);
  insert into public.place_spec_declarations (place_id, spec, value)
  values (v_place2, 'wifi', true);

  -- Ranks and the all-cafés scores are read from a cache (pg_cron, every
  -- 5 min). The café sheet stays live: one café's scores show the vote at once.
  select count(*)::integer into v_count from public.get_place_specs(v_place)
  where spec = 'wifi' and status = 'confirmed';
  if v_count <> 1 then
    raise exception 'FAIL: get_place_specs(café) should be live, got %', v_count;
  end if;
  perform public.refresh_spec_caches();
  select count(*)::integer into v_count from public.get_place_specs()
  where place_id = v_place and spec = 'wifi' and status = 'confirmed';
  if v_count <> 1 then
    raise exception 'FAIL: cached get_place_specs() should match after refresh, got %', v_count;
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  select * into v_rank from public.get_spec_rankings('wifi') limit 1;
  if v_rank.place_id is distinct from v_place or v_rank.rank <> 1
     or v_rank.previous_rank is not null then
    raise exception 'FAIL: Rank Cafe should be new #1 for wifi, got %', row_to_json(v_rank);
  end if;
  select * into v_rank from public.get_place_ranks(v_place2) where spec = 'wifi';
  if v_rank.rank <> 2 or v_rank.total <> 2 then
    raise exception 'FAIL: Second Cafe should be 2 of 2, got %', row_to_json(v_rank);
  end if;
  -- Events ranking counts the café events
  select count(*)::integer into v_count from public.get_spec_rankings('events');
  if v_count <> 2 then
    raise exception 'FAIL: both cafés hold events, got %', v_count;
  end if;
  begin
    perform public.spec_scores_at(now(), null);
    raise exception 'FAIL: spec_scores_at must not be callable by anon';
  exception
    when insufficient_privilege then null;
  end;
  -- Cache tables and their refresh are server-only.
  begin
    perform public.refresh_spec_caches();
    raise exception 'FAIL: refresh_spec_caches must not be callable by anon';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.spec_ranks_cache limit 1;
    raise exception 'FAIL: anon must not read spec_ranks_cache';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.spec_scores_cache limit 1;
    raise exception 'FAIL: anon must not read spec_scores_cache';
  exception
    when insufficient_privilege then null;
  end;
  reset role;
end;
$$;

rollback;
