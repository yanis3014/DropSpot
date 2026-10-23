-- join_drop / leave_drop / drop_participants: events only, places respected,
-- participations private, no direct writes.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/drop_events.sql

begin;

do $$
declare
  u_vendor uuid := 'e0000000-0000-0000-0000-000000000001';
  u_a uuid := 'e1111111-1111-1111-1111-111111111111';
  u_b uuid := 'e2222222-2222-2222-2222-222222222222';
  u_c uuid := 'e3333333-3333-3333-3333-333333333333';
  v_place uuid;
  v_event uuid;
  v_offer uuid;
  v_ended uuid;
  v_result json;
  v_count integer;
begin
  insert into auth.users (id, aud, role, email)
  values
    (u_vendor, 'authenticated', 'authenticated', 'ev-vendor@test.local'),
    (u_a, 'authenticated', 'authenticated', 'ev-a@test.local'),
    (u_b, 'authenticated', 'authenticated', 'ev-b@test.local'),
    (u_c, 'authenticated', 'authenticated', 'ev-c@test.local')
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role)
  values (u_vendor, 'Vendor', 'vendor'), (u_a, 'A', 'user'),
         (u_b, 'B', 'user'), (u_c, 'C', 'user')
  on conflict (id) do nothing;

  insert into public.places (name, address, lat, lng, vendor_id)
  values ('Event Cafe', '1 rue Event', 43.7, 7.26, u_vendor)
  returning id into v_place;

  -- Rows written as the table owner (the client-role trigger is skipped).
  insert into public.flash_drops (vendor_id, place_id, title, starts_at, ends_at, kind, event_category, max_uses)
  values (u_vendor, v_place, 'Run du port', now() + interval '1 day', now() + interval '1 day 2 hours', 'activity', 'sport', 2)
  returning id into v_event;

  insert into public.flash_drops (vendor_id, place_id, title, starts_at, ends_at, kind)
  values (u_vendor, v_place, 'Cookie offert', now(), now() + interval '2 hours', 'offer')
  returning id into v_offer;

  insert into public.flash_drops (vendor_id, place_id, title, starts_at, ends_at, kind, event_category)
  values (u_vendor, v_place, 'DJ set fini', now() - interval '3 hours', now() - interval '1 hour', 'activity', 'music')
  returning id into v_ended;

  -- (1) event_category only on events
  begin
    update public.flash_drops set event_category = 'sport' where id = v_offer;
    raise exception 'FAIL: event_category must be refused on an offer';
  exception
    when check_violation then null;
  end;

  -- (2) anon cannot join
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  begin
    v_result := public.join_drop(v_event);
    if coalesce((v_result ->> 'ok')::boolean, false) then
      raise exception 'FAIL: anon must not join';
    end if;
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      null;
  end;
  reset role;

  -- (3) A joins; joining twice is idempotent; offers and ended events refused
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_result := public.join_drop(v_event);
  if not coalesce((v_result ->> 'ok')::boolean, false)
     or (v_result ->> 'participants')::integer <> 1 then
    raise exception 'FAIL: A join expected 1 participant, got %', v_result;
  end if;
  v_result := public.join_drop(v_event);
  if (v_result ->> 'participants')::integer <> 1 then
    raise exception 'FAIL: second join must not add a participant, got %', v_result;
  end if;

  v_result := public.join_drop(v_offer);
  if v_result ->> 'error' is distinct from 'not_event' then
    raise exception 'FAIL: expected not_event, got %', v_result;
  end if;
  v_result := public.join_drop(v_ended);
  if v_result ->> 'error' is distinct from 'ended' then
    raise exception 'FAIL: expected ended, got %', v_result;
  end if;

  begin
    insert into public.drop_participations (flash_drop_id, user_id) values (v_event, u_b);
    raise exception 'FAIL: direct insert into drop_participations must be refused';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      null;
  end;
  reset role;

  -- (4) B fills the last place, C is refused; B cannot see A's row
  perform set_config('request.jwt.claim.sub', u_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_b::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.join_drop(v_event);
  if (v_result ->> 'participants')::integer <> 2 then
    raise exception 'FAIL: B join expected 2, got %', v_result;
  end if;
  select count(*)::integer into v_count from public.drop_participations;
  if v_count <> 1 then
    raise exception 'FAIL: B must only see own participation (saw %)', v_count;
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', u_c::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_c::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.join_drop(v_event);
  if v_result ->> 'error' is distinct from 'full' then
    raise exception 'FAIL: expected full, got %', v_result;
  end if;
  reset role;

  -- (5) A leaves, C can join; anon reads the count only
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.leave_drop(v_event);
  if (v_result ->> 'participants')::integer <> 1 then
    raise exception 'FAIL: after leave expected 1, got %', v_result;
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', u_c::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_c::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_result := public.join_drop(v_event);
  if not coalesce((v_result ->> 'ok')::boolean, false) then
    raise exception 'FAIL: C should join after A left, got %', v_result;
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  select participants into v_count from public.drop_participants(array[v_event]);
  if v_count <> 2 then
    raise exception 'FAIL: anon count expected 2, got %', v_count;
  end if;
  select count(*)::integer into v_count from public.drop_participations;
  if v_count <> 0 then
    raise exception 'FAIL: anon must not read participations (saw %)', v_count;
  end if;
  reset role;
end;
$$;

rollback;
