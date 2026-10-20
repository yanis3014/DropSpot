-- Security tests for profile Grains / role / place-photos.
-- Run against a DB that already has migrations applied, e.g.:
--   supabase test db
--   or: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/profile_grains_security.sql
--
-- Uses DO blocks + set local role authenticated (no pgTAP required).
-- Entire script runs in a transaction and rolls back.

begin;

do $$
declare
  user_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  user_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  place_a uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  place_b uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_awarded integer;
  v_count integer;
  v_ok boolean;
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
      user_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'a-security@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      user_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'b-security@test.local', crypt('x', gen_salt('bf')),
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
    (user_a, 'Alice', 'user', 0, null, null, '{}', '{}'::jsonb),
    (user_b, 'Bob', 'user', 10, now(), now(), '{}', '{}'::jsonb)
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role,
    grains_balance = excluded.grains_balance,
    onboarding_completed_at = excluded.onboarding_completed_at,
    welcome_grains_claimed_at = excluded.welcome_grains_claimed_at;

  delete from public.grains_transactions where user_id in (user_a, user_b);
  insert into public.grains_transactions (user_id, amount, reason)
  values (user_b, 10, 'adjustment');

  insert into public.places (id, name, vendor_id, lat, lng)
  values
    (place_a, 'Cafe A', user_a, 43.7, 7.2),
    (place_b, 'Cafe B', user_b, 43.7, 7.3)
  on conflict (id) do update set vendor_id = excluded.vendor_id;

  -- -----------------------------------------------------------------------
  -- Act as A
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  -- (1) Allowed profile fields
  update public.profiles
  set
    full_name = 'Alice OK',
    avatar_url = 'https://example.com/a.png',
    preferences = array['remote'],
    onboarding_answers = '{"mood":"focus"}'::jsonb
  where id = user_a;

  -- (2) grains_balance blocked
  begin
    update public.profiles set grains_balance = 9999 where id = user_a;
    raise exception 'FAIL: A was able to set grains_balance';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm like '%grains_balance%' then
        null; -- expected
      else
        raise;
      end if;
  end;

  -- (3) welcome_grains_claimed_at blocked
  begin
    update public.profiles set welcome_grains_claimed_at = now() where id = user_a;
    raise exception 'FAIL: A was able to set welcome_grains_claimed_at';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm like '%welcome_grains_claimed_at%' then
        null;
      else
        raise;
      end if;
  end;

  -- (4) role → owner blocked
  begin
    update public.profiles set role = 'owner' where id = user_a;
    raise exception 'FAIL: A was able to set role=owner';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm like '%role%' then
        null;
      else
        raise;
      end if;
  end;

  -- (5) user → vendor allowed before onboarding
  update public.profiles set role = 'vendor' where id = user_a;
  if (select role from public.profiles where id = user_a) is distinct from 'vendor' then
    raise exception 'FAIL: A could not become vendor before onboarding';
  end if;

  -- Reset via owner for next assertions
  reset role;
  update public.profiles
  set
    role = 'vendor',
    onboarding_completed_at = now(),
    welcome_grains_claimed_at = null,
    grains_balance = 0
  where id = user_a;

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  -- (6) vendor → user blocked
  begin
    update public.profiles set role = 'user' where id = user_a;
    raise exception 'FAIL: A was able to go vendor → user';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm like '%role%' then
        null;
      else
        raise;
      end if;
  end;

  -- (7) user → vendor after onboarding blocked
  reset role;
  update public.profiles
  set role = 'user', onboarding_completed_at = now()
  where id = user_a;

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    update public.profiles set role = 'vendor' where id = user_a;
    raise exception 'FAIL: A became vendor after onboarding';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm like '%role%' then
        null;
      else
        raise;
      end if;
  end;

  -- (8–10) claim_welcome_grains idempotent + ledger
  reset role;
  update public.profiles
  set
    role = 'user',
    onboarding_completed_at = now(),
    welcome_grains_claimed_at = null,
    grains_balance = 0
  where id = user_a;
  delete from public.grains_transactions
  where user_id = user_a and reason = 'welcome';

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_awarded := public.claim_welcome_grains();
  if v_awarded is distinct from 50 then
    raise exception 'FAIL: first claim_welcome_grains returned % (expected 50)', v_awarded;
  end if;

  v_awarded := public.claim_welcome_grains();
  if v_awarded is distinct from 0 then
    raise exception 'FAIL: second claim_welcome_grains returned % (expected 0)', v_awarded;
  end if;

  select count(*) into v_count
  from public.grains_transactions
  where user_id = user_a and reason = 'welcome' and amount = 50;
  if v_count is distinct from 1 then
    raise exception 'FAIL: expected 1 welcome ledger row, got %', v_count;
  end if;

  if (select grains_balance from public.profiles where id = user_a) is distinct from 50 then
    raise exception 'FAIL: grains_balance not 50 after claim';
  end if;

  -- (11) A cannot see B ledger
  select count(*) into v_count
  from public.grains_transactions
  where user_id = user_b;
  if v_count is distinct from 0 then
    raise exception 'FAIL: A can see B grains_transactions (count=%)', v_count;
  end if;

  -- (12–14) storage place-photos
  reset role;
  delete from storage.objects
  where bucket_id = 'place-photos'
    and (
      name like user_a::text || '/%'
      or name like user_b::text || '/%'
    );

  insert into storage.objects (
    id, bucket_id, name, owner, owner_id,
    created_at, updated_at, last_accessed_at, metadata, path_tokens, version
  )
  values (
    gen_random_uuid(),
    'place-photos',
    user_b::text || '/' || place_b::text || '/venue/x.jpg',
    user_b,
    user_b,
    now(), now(), now(),
    '{}'::jsonb,
    array[user_b::text, place_b::text, 'venue', 'x.jpg'],
    '1'
  );

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  -- delete B's object must affect 0 rows under RLS (or throw)
  delete from storage.objects
  where bucket_id = 'place-photos'
    and name = user_b::text || '/' || place_b::text || '/venue/x.jpg';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: A deleted B place-photos (rows=%)', v_count;
  end if;

  -- upload into B's place folder under A's uid prefix must fail WITH CHECK
  begin
    insert into storage.objects (
      id, bucket_id, name, owner, owner_id,
      created_at, updated_at, last_accessed_at, metadata, path_tokens, version
    )
    values (
      gen_random_uuid(),
      'place-photos',
      user_a::text || '/' || place_b::text || '/venue/y.jpg',
      user_a,
      user_a,
      now(), now(), now(),
      '{}'::jsonb,
      array[user_a::text, place_b::text, 'venue', 'y.jpg'],
      '1'
    );
    raise exception 'FAIL: A uploaded under a place they do not own';
  exception
    when insufficient_privilege then
      null;
    when others then
      -- RLS violation / check violation
      if sqlerrm like '%FAIL:%' then
        raise;
      end if;
      null;
  end;

  -- overwrite B's object must fail
  begin
    update storage.objects
    set metadata = '{"hacked":true}'::jsonb
    where bucket_id = 'place-photos'
      and name = user_b::text || '/' || place_b::text || '/venue/x.jpg';
    get diagnostics v_count = row_count;
    if v_count <> 0 then
      raise exception 'FAIL: A updated B place-photos';
    end if;
  exception
    when others then
      if sqlerrm like '%FAIL:%' then
        raise;
      end if;
      null;
  end;

  raise notice 'profile_grains_security: all assertions passed';
end $$;

rollback;
