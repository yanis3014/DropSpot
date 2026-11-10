-- Security audit of 2026-11-10 (migrations 20261110120000 + 20261110130000).
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/audit_fixes.sql
-- Runs in a transaction and rolls back.

begin;

do $$
declare
  owner_a uuid := 'a1111111-aaaa-4111-8111-111111111111';
  owner_b uuid := 'b2222222-bbbb-4222-8222-222222222222';
  client_c uuid := 'c3333333-cccc-4333-8333-333333333333';
  place_a uuid := 'a4444444-aaaa-4444-8444-444444444444';
  place_b uuid := 'b5555555-bbbb-4555-8555-555555555555';
  v_count integer;
  v_col text;
  v_fn text;
  v_blocked boolean;
  v_json json;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  select x, '00000000-0000-0000-0000-000000000000', 'authenticated',
         'authenticated', 'audit-' || x::text || '@test.local', crypt('x', gen_salt('bf')),
         now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
         now(), now()
  from unnest(array[owner_a, owner_b, client_c]) x
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, grains_balance, preferences, onboarding_answers)
  values
    (owner_a, 'Audit Owner A', 'vendor', 0, '{}', '{}'::jsonb),
    (owner_b, 'Audit Owner B', 'vendor', 0, '{}', '{}'::jsonb),
    (client_c, 'Audit Client C', 'user', 0, '{}', '{}'::jsonb)
  on conflict (id) do update set full_name = excluded.full_name;

  insert into public.places (id, name, vendor_id, lat, lng, verification_status)
  values
    (place_a, 'Audit Cafe A', owner_a, 43.70, 7.26, 'verified'),
    (place_b, 'Audit Cafe B', owner_b, 43.71, 7.27, 'verified');

  insert into public.vendor_plans (user_id, plan, pro_until)
  values (owner_b, 'premium', null)
  on conflict (user_id) do update set plan = 'premium', pro_until = null;

  -- -----------------------------------------------------------------------
  -- (1) Owner A cannot change who owns / suggested / reviewed their café
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', owner_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', owner_a::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  foreach v_col in array array['vendor_id', 'owner_id', 'suggested_by', 'reviewed_by'] loop
    v_blocked := false;
    begin
      execute format('update public.places set %I = $1 where id = $2', v_col)
        using client_c, place_a;
    exception
      when check_violation then v_blocked := true;
    end;
    if not v_blocked then
      raise exception 'FAIL: owner could change places.%', v_col;
    end if;
  end loop;

  v_blocked := false;
  begin
    update public.places set reviewed_at = now() where id = place_a;
  exception
    when check_violation then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'FAIL: owner could change places.reviewed_at';
  end if;

  -- Giving the café away (vendor_id = null) is blocked too.
  v_blocked := false;
  begin
    update public.places set vendor_id = null where id = place_a;
  exception
    when check_violation then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'FAIL: owner could clear places.vendor_id';
  end if;

  -- The café sheet itself stays editable by its owner.
  update public.places set description = 'Audit description' where id = place_a;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'FAIL: owner must still edit their own café sheet, got % rows', v_count;
  end if;

  -- And still nothing on someone else's café.
  update public.places set description = 'pwned' where id = place_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: owner A updated café B (% rows)', v_count;
  end if;

  reset role;

  select count(*)::integer into v_count
  from public.place_members
  where place_id = place_a and user_id = client_c;
  if v_count <> 0 then
    raise exception 'FAIL: client C became a member of café A';
  end if;

  -- -----------------------------------------------------------------------
  -- (2) Server-side ownership changes still work (claim approval, admin SQL)
  -- -----------------------------------------------------------------------
  update public.places set reviewed_at = now(), reviewed_by = owner_b where id = place_a;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'FAIL: server-side review update must pass, got % rows', v_count;
  end if;

  -- -----------------------------------------------------------------------
  -- (3) Plan helpers are not callable through the API any more
  -- -----------------------------------------------------------------------
  select string_agg(p.oid::regprocedure::text, ', ')
  into v_fn
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('place_vendor_id', 'vendor_effective_plan', 'has_pro', 'vendor_has_feature')
    and (has_function_privilege('authenticated', p.oid, 'execute')
         or has_function_privilege('anon', p.oid, 'execute'));
  if v_fn is not null then
    raise exception 'FAIL: plan helpers still callable by API roles: %', v_fn;
  end if;

  perform set_config('request.jwt.claim.sub', client_c::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', client_c::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_blocked := false;
  begin
    perform public.vendor_effective_plan(owner_b);
  exception
    when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'FAIL: client C read the plan of owner B';
  end if;

  v_blocked := false;
  begin
    perform public.place_vendor_id(place_b);
  exception
    when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'FAIL: client C read the owner id of café B';
  end if;

  reset role;

  -- -----------------------------------------------------------------------
  -- (4) What the app relies on still works for the owner
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', owner_b::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', owner_b::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_json := public.my_vendor_plan();
  if v_json is null or (v_json ->> 'plan') is distinct from 'premium' then
    raise exception 'FAIL: my_vendor_plan must still return premium for owner B, got %', v_json;
  end if;

  if not public.place_has_feature(place_b, 'drops') then
    raise exception 'FAIL: place_has_feature must still answer for the café team';
  end if;

  -- Policies on flash_drops call place_has_feature: creating a drop still works.
  insert into public.flash_drops (vendor_id, place_id, title, starts_at, ends_at)
  values (owner_b, place_b, 'Audit drop', now(), now() + interval '1 hour');

  reset role;

  raise notice 'audit_fixes: all checks passed';
end $$;

rollback;
