-- Security tests for flash drops (RLS, grains_reward trigger, validation).
-- Run against a DB that already has migrations applied, e.g.:
--   supabase test db
--   or: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/flash_drops_security.sql
--
-- Uses DO blocks + set local role authenticated (no pgTAP required).
-- Entire script runs in a transaction and rolls back.

begin;

do $$
declare
  vendor_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  vendor_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  client_c uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  place_a uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  place_b uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  drop_a uuid;
  drop_owned uuid;
  v_result json;
  v_balance integer;
  v_reward integer;
  v_pin text;
  v_count integer;
begin
  -- -----------------------------------------------------------------------
  -- Fixtures (owner / bypass RLS)
  -- -----------------------------------------------------------------------
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (
      vendor_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'vendor-a-flash@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      vendor_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'vendor-b-flash@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      client_c, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'client-c-flash@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    )
  on conflict (id) do nothing;

  insert into public.profiles (
    id, full_name, role, grains_balance,
    onboarding_completed_at, welcome_grains_claimed_at,
    preferences, onboarding_answers
  )
  values
    (vendor_a, 'Vendor A', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (vendor_b, 'Vendor B', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (client_c, 'Client C', 'user', 40, now(), now(), '{}', '{}'::jsonb)
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role,
    grains_balance = excluded.grains_balance,
    onboarding_completed_at = excluded.onboarding_completed_at,
    welcome_grains_claimed_at = excluded.welcome_grains_claimed_at;

  insert into public.places (id, name, vendor_id, lat, lng)
  values
    (place_a, 'Cafe A Flash', vendor_a, 43.7, 7.2),
    (place_b, 'Cafe B Flash', vendor_b, 43.7, 7.3)
  on conflict (id) do update set vendor_id = excluded.vendor_id;

  delete from public.flash_drop_redemptions
  where vendor_id in (vendor_a, vendor_b);
  delete from public.flash_drops
  where vendor_id in (vendor_a, vendor_b);

  -- -----------------------------------------------------------------------
  -- Act as vendor A
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', vendor_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', vendor_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  -- (1) Pro cannot create a drop on another vendor's place
  begin
    insert into public.flash_drops (
      vendor_id, place_id, title, starts_at, ends_at, is_active
    )
    values (
      vendor_a, place_b, 'Hack other cafe',
      now(), now() + interval '1 hour', true
    );
    raise exception 'FAIL: vendor A created a drop on vendor B place';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      -- expected: RLS / policy violation
      null;
  end;

  -- (2) grains_reward forced to 10 even if client sends 1000
  insert into public.flash_drops (
    vendor_id, place_id, title, starts_at, ends_at, is_active,
    grains_reward, max_uses
  )
  values (
    vendor_a, place_a, 'Forced grains',
    now(), now() + interval '1 hour', true,
    1000, 20
  )
  returning id, grains_reward, pin_code into drop_a, v_reward, v_pin;

  if v_reward is distinct from 10 then
    raise exception 'FAIL: grains_reward stored as % (expected 10)', v_reward;
  end if;

  if v_pin is null or length(btrim(v_pin)) < 4 then
    raise exception 'FAIL: pin_code was not generated server-side';
  end if;

  -- Update attempt to inflate grains_reward must also be forced back to 10
  update public.flash_drops
  set grains_reward = 1000
  where id = drop_a;

  select grains_reward into v_reward from public.flash_drops where id = drop_a;
  if v_reward is distinct from 10 then
    raise exception 'FAIL: update left grains_reward=% (expected 10)', v_reward;
  end if;

  -- (3) max_uses <= 0 rejected
  begin
    insert into public.flash_drops (
      vendor_id, place_id, title, starts_at, ends_at, is_active, max_uses
    )
    values (
      vendor_a, place_a, 'Bad max',
      now(), now() + interval '1 hour', true, 0
    );
    raise exception 'FAIL: max_uses=0 was accepted';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm like '%max_uses%' then
        null;
      else
        raise;
      end if;
  end;

  -- (4) ends_at <= starts_at rejected
  begin
    insert into public.flash_drops (
      vendor_id, place_id, title, starts_at, ends_at, is_active
    )
    values (
      vendor_a, place_a, 'Bad dates',
      now() + interval '2 hours', now() + interval '1 hour', true
    );
    raise exception 'FAIL: ends_at <= starts_at was accepted';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm like '%ends_at%' then
        null;
      else
        raise;
      end if;
  end;

  -- Own drop with known PIN for validation
  insert into public.flash_drops (
    vendor_id, place_id, title, starts_at, ends_at, is_active,
    pin_code, max_uses, current_uses
  )
  values (
    vendor_a, place_a, 'Validate me',
    now() - interval '5 minutes', now() + interval '2 hours', true,
    '4242', 50, 0
  )
  returning id into drop_owned;

  -- Snapshot balances as owner (RLS would hide other profiles)
  reset role;
  select grains_balance into v_balance
  from public.profiles
  where id = client_c;

  perform set_config('request.jwt.claim.sub', vendor_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', vendor_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  -- (5) Validation never changes any grains_balance (client or vendor)
  v_result := public.validate_flash_drop_code('4242', client_c);

  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: validate_flash_drop_code failed: %', v_result;
  end if;

  if coalesce((v_result ->> 'user_credited')::boolean, true) is not false then
    raise exception 'FAIL: user_credited was not false: %', v_result;
  end if;

  if coalesce((v_result ->> 'grains_awarded')::integer, -1) is distinct from 0 then
    raise exception 'FAIL: grains_awarded was not 0: %', v_result;
  end if;

  reset role;

  if (select grains_balance from public.profiles where id = client_c)
     is distinct from v_balance then
    raise exception 'FAIL: client grains_balance changed after validation';
  end if;

  if (select grains_balance from public.profiles where id = vendor_a)
     is distinct from 0 then
    raise exception 'FAIL: vendor grains_balance changed after validation';
  end if;

  select count(*) into v_count
  from public.flash_drop_redemptions
  where flash_drop_id = drop_owned
    and grains_awarded = 0;
  if v_count < 1 then
    raise exception 'FAIL: expected redemption with grains_awarded=0';
  end if;

  raise notice 'flash_drops_security: all assertions passed';
end $$;

rollback;
