-- team_roles: set_member_role, leave_place, cancel_invitation, list_place_team.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/team_roles.sql

begin;

do $$
declare
  u_owner_a uuid := 'a1000001-0000-4000-8000-000000000001';
  u_manager_a uuid := 'a1000001-0000-4000-8000-000000000002';
  u_staff_a uuid := 'a1000001-0000-4000-8000-000000000003';
  u_owner_b uuid := 'a1000001-0000-4000-8000-000000000004';
  place_a uuid := 'b1000001-0000-4000-8000-000000000001';
  place_b uuid := 'b1000001-0000-4000-8000-000000000002';
  v_inv_id uuid;
  v_result json;
  v_role text;
  v_email text;
  v_name text;
  v_count integer;
  r record;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (
      u_owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'owner-a-team@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      u_manager_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'manager-a-team@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      u_staff_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'staff-a-team@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      u_owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'owner-b-team@test.local', crypt('x', gen_salt('bf')),
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
    (u_owner_a, 'Owner A Team', 'user', 0, now(), now(), '{}', '{}'::jsonb),
    (u_manager_a, 'Manager A Team', 'user', 0, now(), now(), '{}', '{}'::jsonb),
    (u_staff_a, 'Staff A Team', 'user', 0, now(), now(), '{}', '{}'::jsonb),
    (u_owner_b, 'Owner B Team', 'user', 0, now(), now(), '{}', '{}'::jsonb)
  on conflict (id) do update set full_name = excluded.full_name;

  insert into public.places (id, name, vendor_id, lat, lng)
  values
    (place_a, 'Cafe A Team', u_owner_a, 43.71, 7.21),
    (place_b, 'Cafe B Team', u_owner_b, 43.72, 7.22)
  on conflict (id) do update set
    vendor_id = excluded.vendor_id,
    name = excluded.name;

  insert into public.place_members (place_id, user_id, role)
  values
    (place_a, u_owner_a, 'owner'),
    (place_a, u_manager_a, 'manager'),
    (place_a, u_staff_a, 'staff'),
    (place_b, u_owner_b, 'owner')
  on conflict (place_id, user_id) do update set role = excluded.role;

  -- Free plan for place A vendor (manager role requires Pro)
  insert into public.vendor_plans (user_id, plan, pro_until)
  values (u_owner_a, 'free', null)
  on conflict (user_id) do update set plan = 'free', pro_until = null;

  -- -----------------------------------------------------------------------
  -- (1) manager cannot change a role
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_manager_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', u_manager_a::text,
      'role', 'authenticated',
      'email', 'manager-a-team@test.local'
    )::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.set_member_role(place_a, u_staff_a, 'manager');
  if coalesce((v_result ->> 'ok')::boolean, false) is true then
    raise exception 'FAIL: manager must not set_member_role';
  end if;
  if coalesce(v_result ->> 'error', '') is distinct from 'forbidden' then
    raise exception 'FAIL: manager set_member_role expected forbidden, got %', v_result;
  end if;

  reset role;

  -- -----------------------------------------------------------------------
  -- (2) last owner cannot be demoted
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', u_owner_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', u_owner_a::text,
      'role', 'authenticated',
      'email', 'owner-a-team@test.local'
    )::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.set_member_role(place_a, u_owner_a, 'staff');
  if coalesce((v_result ->> 'ok')::boolean, false) is true then
    raise exception 'FAIL: last owner must not be demoted';
  end if;
  if coalesce(v_result ->> 'error', '') is distinct from 'last_owner' then
    raise exception 'FAIL: demote last owner expected last_owner, got %', v_result;
  end if;

  -- -----------------------------------------------------------------------
  -- (3) last owner cannot leave
  -- -----------------------------------------------------------------------
  v_result := public.leave_place(place_a);
  if coalesce((v_result ->> 'ok')::boolean, false) is true then
    raise exception 'FAIL: last owner must not leave_place';
  end if;
  if coalesce(v_result ->> 'error', '') is distinct from 'last_owner' then
    raise exception 'FAIL: leave last owner expected last_owner, got %', v_result;
  end if;

  -- -----------------------------------------------------------------------
  -- (4) manager role refused without Pro
  -- -----------------------------------------------------------------------
  v_result := public.set_member_role(place_a, u_staff_a, 'manager');
  if coalesce((v_result ->> 'ok')::boolean, false) is true then
    raise exception 'FAIL: manager role without Pro must be refused';
  end if;
  if coalesce(v_result ->> 'error', '') is distinct from 'pro_required' then
    raise exception 'FAIL: expected pro_required, got %', v_result;
  end if;

  -- -----------------------------------------------------------------------
  -- (5) owner of café A cannot touch café B
  -- -----------------------------------------------------------------------
  v_result := public.set_member_role(place_b, u_owner_b, 'staff');
  if coalesce((v_result ->> 'ok')::boolean, false) is true then
    raise exception 'FAIL: owner A must not set roles on café B';
  end if;
  if coalesce(v_result ->> 'error', '') is distinct from 'forbidden' then
    raise exception 'FAIL: cross-café expected forbidden, got %', v_result;
  end if;

  v_result := public.cancel_invitation(
    '00000000-0000-0000-0000-000000000099'::uuid
  );
  -- not_found or forbidden both OK for unknown / other café
  if coalesce((v_result ->> 'ok')::boolean, false) is true then
    raise exception 'FAIL: cancel unknown invitation must fail';
  end if;

  -- Create pending invite on A then try cancel as owner B
  reset role;
  -- insert invitation as owner A
  perform set_config('request.jwt.claim.sub', u_owner_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', u_owner_a::text,
      'role', 'authenticated',
      'email', 'owner-a-team@test.local'
    )::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.invite_member(place_a, 'invitee-team@test.local', 'staff');
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: invite_member failed: %', v_result;
  end if;
  v_inv_id := (v_result ->> 'invitation_id')::uuid;

  reset role;
  perform set_config('request.jwt.claim.sub', u_owner_b::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', u_owner_b::text,
      'role', 'authenticated',
      'email', 'owner-b-team@test.local'
    )::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.cancel_invitation(v_inv_id);
  if coalesce((v_result ->> 'ok')::boolean, false) is true then
    raise exception 'FAIL: owner B must not cancel invite on café A';
  end if;
  if coalesce(v_result ->> 'error', '') is distinct from 'forbidden' then
    raise exception 'FAIL: cancel cross-café expected forbidden, got %', v_result;
  end if;

  -- -----------------------------------------------------------------------
  -- (6) list_place_team: staff sees names, email null
  -- -----------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claim.sub', u_staff_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', u_staff_a::text,
      'role', 'authenticated',
      'email', 'staff-a-team@test.local'
    )::text,
    true
  );
  execute 'set local role authenticated';

  v_count := 0;
  v_name := null;
  v_email := 'sentinel';
  for r in
    select * from public.list_place_team(place_a)
  loop
    v_count := v_count + 1;
    if r.user_id = u_owner_a then
      v_name := r.full_name;
      v_email := r.email;
    end if;
  end loop;

  if v_count < 3 then
    raise exception 'FAIL: staff should see all members of café A, got %', v_count;
  end if;
  if v_name is distinct from 'Owner A Team' then
    raise exception 'FAIL: staff should see full_name, got %', v_name;
  end if;
  if v_email is not null then
    raise exception 'FAIL: staff must get email null, got %', v_email;
  end if;

  -- -----------------------------------------------------------------------
  -- (7) owner sees emails
  -- -----------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claim.sub', u_owner_a::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', u_owner_a::text,
      'role', 'authenticated',
      'email', 'owner-a-team@test.local'
    )::text,
    true
  );
  execute 'set local role authenticated';

  v_email := null;
  for r in
    select * from public.list_place_team(place_a)
  loop
    if r.user_id = u_staff_a then
      v_email := r.email;
    end if;
  end loop;

  if v_email is distinct from 'staff-a-team@test.local' then
    raise exception 'FAIL: owner should see staff email, got %', v_email;
  end if;

  -- -----------------------------------------------------------------------
  -- (8) member of café B sees nothing of café A
  -- -----------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claim.sub', u_owner_b::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', u_owner_b::text,
      'role', 'authenticated',
      'email', 'owner-b-team@test.local'
    )::text,
    true
  );
  execute 'set local role authenticated';

  select count(*)::integer into v_count
  from public.list_place_team(place_a);

  if v_count is distinct from 0 then
    raise exception 'FAIL: owner B must see 0 rows for café A, got %', v_count;
  end if;

  -- -----------------------------------------------------------------------
  -- (9) anon cannot call list_place_team
  -- -----------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';

  begin
    select count(*)::integer into v_count
    from public.list_place_team(place_a);
    if v_count <> 0 then
      raise exception 'FAIL: anon must not list team rows';
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
  raise notice 'team_roles: all assertions passed';
end;
$$;

rollback;
