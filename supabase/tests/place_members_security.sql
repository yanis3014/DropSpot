-- Security tests for place_members / invitations / has_place_role RLS.
-- Run against a DB that already has migrations applied, e.g.:
--   supabase test db
--   or: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/place_members_security.sql
--
-- Uses DO blocks + set local role authenticated (no pgTAP required).
-- Entire script runs in a transaction and rolls back.

begin;

do $$
declare
  owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  manager_a uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  staff_a uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  owner_b uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  place_a uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  place_b uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_result json;
  v_count integer;
  v_name text;
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
      owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'owner-a@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      manager_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'manager-a@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      staff_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'staff-a@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'owner-b@test.local', crypt('x', gen_salt('bf')),
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
    (owner_a, 'Owner A', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (manager_a, 'Manager A', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (staff_a, 'Staff A', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (owner_b, 'Owner B', 'vendor', 0, now(), now(), '{}', '{}'::jsonb)
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role,
    grains_balance = excluded.grains_balance,
    onboarding_completed_at = excluded.onboarding_completed_at,
    welcome_grains_claimed_at = excluded.welcome_grains_claimed_at;

  insert into public.places (id, name, vendor_id, lat, lng)
  values
    (place_a, 'Cafe A Members', owner_a, 43.7, 7.2),
    (place_b, 'Cafe B Members', owner_b, 43.7, 7.3)
  on conflict (id) do update set
    vendor_id = excluded.vendor_id,
    name = excluded.name;

  -- Ensure owner membership (trigger / backfill); add manager + staff on A
  insert into public.place_members (place_id, user_id, role)
  values
    (place_a, owner_a, 'owner'),
    (place_b, owner_b, 'owner'),
    (place_a, manager_a, 'manager'),
    (place_a, staff_a, 'staff')
  on conflict (place_id, user_id) do update
  set role = excluded.role;

  -- -----------------------------------------------------------------------
  -- (1) Staff cannot modify the place fiche
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', staff_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', staff_a::text,
      'role', 'authenticated',
      'email', 'staff-a@test.local'
    )::text,
    true
  );
  execute 'set local role authenticated';

  begin
    update public.places
    set name = 'Hacked by staff'
    where id = place_a;
    get diagnostics v_count = row_count;
    if v_count <> 0 then
      raise exception 'FAIL: staff updated place fiche (rows=%)', v_count;
    end if;
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      null;
  end;

  reset role;
  select name into v_name from public.places where id = place_a;
  if v_name is distinct from 'Cafe A Members' then
    raise exception 'FAIL: place name changed by staff to %', v_name;
  end if;

  -- -----------------------------------------------------------------------
  -- (2) Manager of cafe A sees nothing of cafe B roster
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', manager_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', manager_a::text,
      'role', 'authenticated',
      'email', 'manager-a@test.local'
    )::text,
    true
  );
  execute 'set local role authenticated';

  select count(*) into v_count
  from public.place_members
  where place_id = place_b;

  if v_count is distinct from 0 then
    raise exception 'FAIL: manager A can see place B members (count=%)', v_count;
  end if;

  select count(*) into v_count
  from public.place_invitations
  where place_id = place_b;

  if v_count is distinct from 0 then
    raise exception 'FAIL: manager A can see place B invitations (count=%)', v_count;
  end if;

  -- Manager can see cafe A members
  select count(*) into v_count
  from public.place_members
  where place_id = place_a;
  if v_count < 1 then
    raise exception 'FAIL: manager A cannot see place A members';
  end if;

  -- -----------------------------------------------------------------------
  -- (3) Cannot self-invite
  -- -----------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claim.sub', owner_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', owner_a::text,
      'role', 'authenticated',
      'email', 'owner-a@test.local'
    )::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.invite_member(place_a, 'owner-a@test.local', 'staff');
  if coalesce(v_result ->> 'ok', 'true') = 'true' then
    raise exception 'FAIL: owner could self-invite: %', v_result;
  end if;
  if coalesce(v_result ->> 'error', '') is distinct from 'cannot_invite_self' then
    raise exception 'FAIL: expected cannot_invite_self, got %', v_result;
  end if;

  -- Sanity: inviting someone else works
  v_result := public.invite_member(place_a, 'newhire@test.local', 'staff');
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: invite_member failed: %', v_result;
  end if;

  -- Staff cannot invite
  perform set_config('request.jwt.claim.sub', staff_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', staff_a::text,
      'role', 'authenticated',
      'email', 'staff-a@test.local'
    )::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.invite_member(place_a, 'other@test.local', 'staff');
  if coalesce(v_result ->> 'error', '') is distinct from 'forbidden' then
    raise exception 'FAIL: staff invite should be forbidden, got %', v_result;
  end if;

  -- Cannot remove last owner
  perform set_config('request.jwt.claim.sub', owner_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', owner_a::text,
      'role', 'authenticated',
      'email', 'owner-a@test.local'
    )::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.remove_member(place_a, owner_a);
  if coalesce(v_result ->> 'error', '') is distinct from 'last_owner' then
    raise exception 'FAIL: expected last_owner, got %', v_result;
  end if;

  raise notice 'place_members_security: all assertions passed';
end $$;

rollback;
