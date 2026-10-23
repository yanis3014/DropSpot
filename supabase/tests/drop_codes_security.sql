-- Security tests for drop_codes claim/redeem (2d).
-- Run against a DB with all migrations applied, e.g.:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/drop_codes_security.sql
--
-- Covers: self-redeem forbidden, single-use codes, last-stock sold_out (serializes
-- via FOR UPDATE on flash_drops — true dual-session race is same invariant),
-- cross-place staff blocked, stop_drop / add_drop_places on unlimited drops.
-- Entire script runs in a transaction and rolls back.

begin;

do $$
declare
  client_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  client_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  staff_a uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  staff_b uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  place_a uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  place_b uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  drop_a uuid := '11111111-1111-1111-1111-111111111111';
  drop_unlimited uuid := '22222222-2222-2222-2222-222222222222';
  v_claim_a json;
  v_claim_b json;
  v_code_a char(6);
  v_code_b char(6);
  v_redeem json;
  v_balance integer;
  v_count integer;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (
      client_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'client-a@test.local', crypt('x', gen_salt('bf')),
      now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      client_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'client-b@test.local', crypt('x', gen_salt('bf')),
      now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      staff_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'staff-a@test.local', crypt('x', gen_salt('bf')),
      now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      staff_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'staff-b@test.local', crypt('x', gen_salt('bf')),
      now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    )
  on conflict (id) do nothing;

  insert into public.profiles (
    id, full_name, role, grains_balance,
    onboarding_completed_at, welcome_grains_claimed_at,
    preferences, onboarding_answers
  )
  values
    (client_a, 'Client A', 'user', 0, now(), now(), '{}', '{}'::jsonb),
    (client_b, 'Client B', 'user', 0, now(), now(), '{}', '{}'::jsonb),
    (staff_a, 'Staff A', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (staff_b, 'Staff B', 'vendor', 0, now(), now(), '{}', '{}'::jsonb)
  on conflict (id) do update set
    full_name = excluded.full_name,
    grains_balance = 0;

  insert into public.places (id, name, vendor_id, lat, lng, verification_status)
  values
    (place_a, 'Cafe A Codes', client_a, 43.7, 7.2, 'verified'),
    (place_b, 'Cafe B Codes', staff_b, 43.7, 7.3, 'verified')
  on conflict (id) do update set
    verification_status = 'verified',
    vendor_id = excluded.vendor_id;

  delete from public.place_members
  where place_id in (place_a, place_b);
  insert into public.place_members (place_id, user_id, role)
  values
    (place_a, client_a, 'owner'),
    (place_a, staff_a, 'staff'),
    (place_b, staff_b, 'owner');

  delete from public.drop_codes where flash_drop_id in (drop_a, drop_unlimited);
  delete from public.flash_drops where id in (drop_a, drop_unlimited);

  insert into public.flash_drops (
    id, vendor_id, place_id, title, kind,
    starts_at, ends_at, is_active, max_uses, current_uses, grains_reward
  )
  values (
    drop_a, client_a, place_a, 'Test drop', 'offer',
    now() - interval '5 minutes', now() + interval '2 hours', true,
    1, 0, 10
  );

  -- Clients claim personal codes
  perform set_config('request.jwt.claim.sub', client_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', client_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_claim_a := public.claim_drop(drop_a);
  if coalesce((v_claim_a ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: claim_drop A failed: %', v_claim_a;
  end if;
  v_code_a := (v_claim_a ->> 'code')::char(6);

  perform set_config('request.jwt.claim.sub', client_b::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', client_b::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  -- max_uses = 1 and A holds the only code: no more codes for B.
  v_claim_b := public.claim_drop(drop_a);
  if coalesce(v_claim_b ->> 'error', '') is distinct from 'sold_out' then
    raise exception 'FAIL: claim beyond places expected sold_out, got %', v_claim_b;
  end if;
  reset role;
  -- A code issued before the places were reduced (written as the table owner).
  v_code_b := public.generate_drop_code_value();
  insert into public.drop_codes (flash_drop_id, user_id, code, status)
  values (drop_a, client_b, v_code_b, 'issued');
  execute 'set local role authenticated';

  -- (0) A signed-in client who is not on the café team cannot redeem
  v_redeem := public.redeem_drop_code(place_a, public.format_drop_code(v_code_a));
  if coalesce(v_redeem ->> 'status', '') is distinct from 'not_found' then
    raise exception 'FAIL: non-member redeemed a code: %', v_redeem;
  end if;

  -- (1) A team member cannot redeem their own code (client A owns cafe A)
  perform set_config('request.jwt.claim.sub', client_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', client_a::text, 'role', 'authenticated')::text,
    true
  );
  v_redeem := public.redeem_drop_code(place_a, public.format_drop_code(v_code_a));
  if coalesce(v_redeem ->> 'status', '') is distinct from 'not_found' then
    raise exception 'FAIL: client redeemed own code: %', v_redeem;
  end if;

  -- Staff A redeems client A code -> ok
  perform set_config('request.jwt.claim.sub', staff_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', staff_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_redeem := public.redeem_drop_code(place_a, public.format_drop_code(v_code_a));
  if coalesce(v_redeem ->> 'status', '') is distinct from 'ok' then
    raise exception 'FAIL: staff redeem expected ok, got %', v_redeem;
  end if;

  -- (2) Code single-use: second redeem -> already_used
  v_redeem := public.redeem_drop_code(place_a, public.format_drop_code(v_code_a));
  if coalesce(v_redeem ->> 'status', '') is distinct from 'already_used' then
    raise exception 'FAIL: expected already_used, got %', v_redeem;
  end if;

  -- (3) Last stock: max_uses=1, second code -> sold_out
  v_redeem := public.redeem_drop_code(place_a, public.format_drop_code(v_code_b));
  if coalesce(v_redeem ->> 'status', '') is distinct from 'sold_out' then
    raise exception 'FAIL: expected sold_out on last slot, got %', v_redeem;
  end if;

  -- (4) Staff B cannot redeem at cafe A (wrong place)
  perform set_config('request.jwt.claim.sub', staff_b::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', staff_b::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_redeem := public.redeem_drop_code(place_b, public.format_drop_code(v_code_b));
  if coalesce(v_redeem ->> 'status', '') is distinct from 'not_found' then
    raise exception 'FAIL: staff B redeemed code at wrong place: %', v_redeem;
  end if;

  reset role;
  select grains_balance into v_balance from public.profiles where id = client_a;
  -- A used promo code no longer earns Grains (moved to event presence).
  if v_balance is distinct from 0 then
    raise exception 'FAIL: client A grains expected 0, got %', v_balance;
  end if;

  -- (5) add_drop_places never caps an unlimited drop; stop_drop ends it for clients too
  insert into public.flash_drops (
    id, vendor_id, place_id, title, kind,
    starts_at, ends_at, is_active, max_uses, current_uses, grains_reward
  )
  values (
    drop_unlimited, client_a, place_a, 'Unlimited drop', 'offer',
    now() - interval '5 minutes', now() + interval '2 hours', true,
    null, 0, 10
  );

  perform set_config('request.jwt.claim.sub', client_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', client_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_redeem := public.add_drop_places(drop_unlimited, 5);
  if coalesce(v_redeem ->> 'error', '') is distinct from 'unlimited' then
    raise exception 'FAIL: add_drop_places on unlimited drop: %', v_redeem;
  end if;

  v_redeem := public.stop_drop(drop_unlimited);
  if coalesce((v_redeem ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: owner could not stop drop: %', v_redeem;
  end if;

  reset role;
  if exists (
    select 1 from public.flash_drops
    where id = drop_unlimited
      and (is_active or stopped_at is null or max_uses is not null)
  ) then
    raise exception 'FAIL: stopped drop still active, or unlimited drop got capped';
  end if;

  raise notice 'drop_codes_security: all assertions passed';
end $$;

rollback;
