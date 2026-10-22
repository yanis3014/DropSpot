-- suggest_place: anon blocked, unclaimed + no members, direct insert denied, rate limit.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/suggest_place.sql

begin;

do $$
declare
  u_suggester uuid := 'a1111111-1111-1111-1111-111111111111';
  v_result json;
  v_place_id uuid;
  v_status text;
  v_vendor uuid;
  v_members integer;
  v_i integer;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values (
    u_suggester, '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'suggest@test.local', crypt('x', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  )
  on conflict (id) do nothing;

  insert into public.profiles (
    id, full_name, role, grains_balance,
    onboarding_completed_at, welcome_grains_claimed_at,
    preferences, onboarding_answers
  )
  values (
    u_suggester, 'Suggester', 'user', 0, now(), now(), '{}', '{}'::jsonb
  )
  on conflict (id) do update set role = excluded.role;

  -- -----------------------------------------------------------------------
  -- (1) anon cannot call suggest_place
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';

  begin
    v_result := public.suggest_place(
      'Anon Cafe', '1 rue Test', 'Nice', 43.7, 7.2
    );
    -- If EXECUTE was granted to anon by mistake, still expect not_authenticated
    -- when auth.uid() is null; otherwise privilege error is also OK.
    if coalesce((v_result ->> 'ok')::boolean, false) is true then
      raise exception 'FAIL: anon must not create a place via suggest_place';
    end if;
    if coalesce(v_result ->> 'error', '') is distinct from 'not_authenticated' then
      raise exception 'FAIL: anon expected not_authenticated, got %', v_result;
    end if;
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      -- permission denied / revoke from anon → OK
      null;
  end;

  reset role;

  -- -----------------------------------------------------------------------
  -- (2) authenticated suggest → unclaimed, no place_members
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_suggester::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_suggester::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.suggest_place(
    'Suggested Cafe One', '10 rue Alpha', 'Nice', 43.701, 7.265
  );
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: suggest_place failed: %', v_result;
  end if;

  v_place_id := (v_result ->> 'place_id')::uuid;

  select verification_status, vendor_id
  into v_status, v_vendor
  from public.places
  where id = v_place_id;

  if v_status is distinct from 'unclaimed' then
    raise exception 'FAIL: suggested place must be unclaimed, got %', v_status;
  end if;
  if v_vendor is not null then
    raise exception 'FAIL: suggested place must have vendor_id null';
  end if;

  select count(*)::integer into v_members
  from public.place_members
  where place_id = v_place_id;

  if v_members is distinct from 0 then
    raise exception 'FAIL: suggested place must have no place_members';
  end if;

  -- -----------------------------------------------------------------------
  -- (3) direct insert into places is refused for authenticated clients
  -- -----------------------------------------------------------------------
  begin
    insert into public.places (name, vendor_id, lat, lng)
    values ('Direct Insert Cafe', u_suggester, 43.7, 7.2);
    raise exception 'FAIL: authenticated must not insert places directly';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      null;
  end;

  -- -----------------------------------------------------------------------
  -- (4) 4th suggestion within 24h is refused
  -- -----------------------------------------------------------------------
  for v_i in 2..3 loop
    v_result := public.suggest_place(
      'Suggested Cafe ' || v_i::text,
      v_i::text || ' rue Beta',
      'Nice',
      43.7 + v_i * 0.001,
      7.26 + v_i * 0.001
    );
    if coalesce((v_result ->> 'ok')::boolean, false) is not true then
      raise exception 'FAIL: suggest_place #% failed: %', v_i, v_result;
    end if;
  end loop;

  v_result := public.suggest_place(
    'Suggested Cafe Four', '4 rue Gamma', 'Nice', 43.71, 7.27
  );
  if coalesce((v_result ->> 'ok')::boolean, false) is true then
    raise exception 'FAIL: 4th suggest_place in 24h must be refused';
  end if;
  if coalesce(v_result ->> 'error', '') is distinct from 'rate_limited' then
    raise exception 'FAIL: expected rate_limited, got %', v_result;
  end if;

  reset role;
end;
$$;

rollback;
