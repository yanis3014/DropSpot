-- Security tests for place claims, claim-proofs storage, admin RPCs, verified drops.
-- Run against a DB that already has migrations applied, e.g.:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/place_claims_security.sql
--
-- Entire script runs in a transaction and rolls back.

begin;

do $$
declare
  claimant_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  claimant_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  admin_u uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  owner_pending uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  place_unclaimed uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  place_pending uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_result json;
  v_count integer;
  v_path_a text;
  v_path_b text;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (
      claimant_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'claim-a@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      claimant_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'claim-b@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      admin_u, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'admin@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      owner_pending, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'owner-pending@test.local', crypt('x', gen_salt('bf')),
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
    (claimant_a, 'Claim A', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (claimant_b, 'Claim B', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (admin_u, 'Admin', 'owner', 0, now(), now(), '{}', '{}'::jsonb),
    (owner_pending, 'Owner Pending', 'vendor', 0, now(), now(), '{}', '{}'::jsonb)
  on conflict (id) do update set role = excluded.role;

  insert into public.admins (user_id)
  values (admin_u)
  on conflict (user_id) do nothing;

  insert into public.places (
    id, name, vendor_id, lat, lng, verification_status
  )
  values
    (place_unclaimed, 'Unclaimed Cafe', null, 43.7, 7.2, 'unclaimed'),
    (
      place_pending,
      'Pending Cafe',
      owner_pending,
      43.7,
      7.3,
      'pending'
    )
  on conflict (id) do update set
    vendor_id = excluded.vendor_id,
    verification_status = excluded.verification_status,
    name = excluded.name;

  insert into public.place_members (place_id, user_id, role)
  values (place_pending, owner_pending, 'owner')
  on conflict (place_id, user_id) do update set role = 'owner';

  v_path_a := claimant_a::text || '/proof-a.pdf';
  v_path_b := claimant_b::text || '/proof-b.pdf';

  -- -----------------------------------------------------------------------
  -- (1) Non-admin cannot approve
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', claimant_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', claimant_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.request_claim(
    place_unclaimed, 'owner', 'document', v_path_a
  );
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: request_claim failed: %', v_result;
  end if;

  v_result := public.approve_claim((v_result ->> 'claim_id')::uuid, 'hack');
  if coalesce(v_result ->> 'error', '') is distinct from 'forbidden' then
    raise exception 'FAIL: non-admin approve expected forbidden, got %', v_result;
  end if;

  -- -----------------------------------------------------------------------
  -- (2) Pro cannot read another claimant's proof object
  -- -----------------------------------------------------------------------
  reset role;
  delete from storage.objects
  where bucket_id = 'claim-proofs'
    and name in (v_path_a, v_path_b);

  insert into storage.objects (
    id, bucket_id, name, owner, owner_id,
    created_at, updated_at, last_accessed_at, metadata, path_tokens, version
  )
  values (
    gen_random_uuid(),
    'claim-proofs',
    v_path_a,
    claimant_a,
    claimant_a,
    now(), now(), now(),
    '{}'::jsonb,
    string_to_array(v_path_a, '/'),
    '1'
  );

  perform set_config('request.jwt.claim.sub', claimant_b::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', claimant_b::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  select count(*) into v_count
  from storage.objects
  where bucket_id = 'claim-proofs'
    and name = v_path_a;

  if v_count is distinct from 0 then
    raise exception 'FAIL: claimant B can read A proof (count=%)', v_count;
  end if;

  -- -----------------------------------------------------------------------
  -- (3) No flash drop on pending café
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', owner_pending::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', owner_pending::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    insert into public.flash_drops (
      vendor_id, place_id, title, starts_at, ends_at, is_active
    )
    values (
      owner_pending,
      place_pending,
      'Should fail',
      now(),
      now() + interval '1 hour',
      true
    );
    raise exception 'FAIL: flash drop inserted on pending place';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      null;
  end;

  raise notice 'place_claims_security: all assertions passed';
end $$;

rollback;
