-- Three offers + admin-edited feature grid. Rolls back at end.
-- Proves: every gate follows plan_features, only admins edit the grid,
-- a member sees the café owner's offer, an expired offer falls back to presence.

begin;

do $$
declare
  v_admin uuid := 'c1c1c1c1-0000-0000-0000-00000000f001';
  v_owner uuid := 'c1c1c1c1-0000-0000-0000-00000000f002';
  v_staff uuid := 'c1c1c1c1-0000-0000-0000-00000000f003';
  v_other uuid := 'c1c1c1c1-0000-0000-0000-00000000f004';
  v_place uuid := 'c1c1c1c1-0000-0000-0000-00000000f005';
  v_drop uuid := 'c1c1c1c1-0000-0000-0000-00000000f006';
  v_res json;
  v_err text;
  v_count integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin-pf@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner-pf@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    (v_staff, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'staff-pf@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'other-pf@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
  on conflict (id) do nothing;

  insert into public.admins (user_id) values (v_admin) on conflict do nothing;

  insert into public.profiles (id, full_name, role, grains_balance,
    onboarding_completed_at, welcome_grains_claimed_at, preferences, onboarding_answers)
  values
    (v_admin, 'Admin PF', 'user', 0, now(), now(), '{}', '{}'::jsonb),
    (v_owner, 'Owner PF', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (v_staff, 'Staff PF', 'user', 0, now(), now(), '{}', '{}'::jsonb),
    (v_other, 'Other PF', 'user', 0, now(), now(), '{}', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.places (id, name, vendor_id, lat, lng, verification_status)
  values (v_place, 'Plan Features Cafe', v_owner, 43.7, 7.2, 'verified')
  on conflict (id) do update set vendor_id = v_owner;

  insert into public.place_members (place_id, user_id, role)
  values (v_place, v_owner, 'owner'), (v_place, v_staff, 'staff')
  on conflict (place_id, user_id) do update set role = excluded.role;

  insert into public.vendor_plans (user_id, plan, pro_until)
  values (v_owner, 'presence', null)
  on conflict (user_id) do update set plan = 'presence', pro_until = null;

  -- 1. Starting grid = behaviour before the migration.
  if not public.vendor_has_feature(v_owner, 'drops') then
    raise exception 'FAIL 1a: presence should include drops by default';
  end if;
  if public.vendor_has_feature(v_owner, 'stats_history') then
    raise exception 'FAIL 1b: presence should not include stats_history by default';
  end if;
  if public.vendor_has_feature(v_owner, 'unknown_feature') then
    raise exception 'FAIL 1c: unknown feature must be locked';
  end if;

  -- 2. Expired paid offer = presence.
  update public.vendor_plans set plan = 'analytics', pro_until = now() - interval '1 day'
  where user_id = v_owner;
  if public.vendor_effective_plan(v_owner) <> 'presence' or public.has_pro(v_owner) then
    raise exception 'FAIL 2a: expired analytics should be presence';
  end if;
  update public.vendor_plans set pro_until = now() + interval '1 day' where user_id = v_owner;
  if public.vendor_effective_plan(v_owner) <> 'analytics' or not public.has_pro(v_owner) then
    raise exception 'FAIL 2b: running analytics should be analytics';
  end if;
  if not public.place_has_feature(v_place, 'stats_history')
     or public.place_has_feature(v_place, 'gallery_full') then
    raise exception 'FAIL 2c: analytics grid wrong';
  end if;

  -- 3. A non-admin cannot edit the grid (RPC or direct write).
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_res := public.admin_set_plan_feature('gallery_full', array['presence', 'analytics', 'premium']);
  if v_res ->> 'error' is distinct from 'forbidden' then
    raise exception 'FAIL 3a: owner edited the grid: %', v_res;
  end if;

  begin
    update public.plan_features set plans = array['presence'] where feature = 'gallery_full';
    get diagnostics v_count = row_count;
    if v_count > 0 then
      raise exception 'FAIL 3b: owner updated plan_features directly';
    end if;
  exception when insufficient_privilege then null;
  end;

  begin
    v_res := public.admin_plan_features();
    raise exception 'FAIL 3c: owner read admin_plan_features';
  exception when insufficient_privilege then null;
  end;

  reset role;

  -- 4. Admin removes drops from analytics: the owner can no longer create one.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';

  v_res := public.admin_set_plan_feature('drops', array['premium', 'presence', 'premium']);
  if (v_res ->> 'ok')::boolean is not true then
    raise exception 'FAIL 4a: admin_set_plan_feature: %', v_res;
  end if;
  if (select plans from public.plan_features where feature = 'drops') <> array['presence', 'premium'] then
    raise exception 'FAIL 4b: plans not normalised';
  end if;

  v_res := public.admin_set_plan_feature('drops', array['gold']);
  if v_res ->> 'error' is distinct from 'invalid_plans' then
    raise exception 'FAIL 4c: invalid plan accepted: %', v_res;
  end if;

  v_res := public.admin_plan_features();
  if (v_res -> 'accounts' ->> 'analytics')::integer < 1 then
    raise exception 'FAIL 4d: account counts missing: %', v_res;
  end if;

  reset role;

  select count(*) into v_count from public.admin_actions
  where action = 'set_plan_feature' and target_label = 'drops' and admin_id = v_admin;
  if v_count <> 1 then
    raise exception 'FAIL 4e: grid change not logged once (%)', v_count;
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    insert into public.flash_drops (id, vendor_id, place_id, title, starts_at, ends_at, is_active, kind)
    values (v_drop, v_owner, v_place, 'Grid test', now(), now() + interval '1 hour', true, 'offer');
    raise exception 'FAIL 4f: drop created without the drops feature';
  exception when insufficient_privilege then null;
  end;

  -- 5. Inviting an équipier follows team_staff.
  reset role;
  update public.plan_features set plans = array['premium'] where feature = 'team_staff';
  execute 'set local role authenticated';
  v_res := public.invite_member(v_place, 'new-staff-pf@test.local', 'staff');
  if v_res ->> 'error' is distinct from 'pro_required' then
    raise exception 'FAIL 5a: staff invite should need team_staff: %', v_res;
  end if;

  -- 6. Stats beyond 7 days follow stats_history (analytics has it).
  v_res := public.pro_place_summary(v_place, 30);
  if v_res is null then
    raise exception 'FAIL 6a: analytics owner should read 30 days';
  end if;

  -- 7. A member sees the café owner's offer; an outsider does not.
  reset role;
  perform set_config('request.jwt.claim.sub', v_staff::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_res := public.place_plan(v_place);
  if v_res ->> 'effective_plan' is distinct from 'analytics'
     or (v_res -> 'features')::jsonb ? 'drops' then
    raise exception 'FAIL 7a: staff should see the owner offer: %', v_res;
  end if;

  reset role;
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_other::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_res := public.place_plan(v_place);
  if v_res ->> 'error' is distinct from 'forbidden' then
    raise exception 'FAIL 7b: outsider read the café offer: %', v_res;
  end if;
  if (select count(*) from public.plan_features) <> 7 then
    raise exception 'FAIL 7c: signed-in users should read the grid';
  end if;

  reset role;
  raise notice 'plan_features: all assertions passed';
end $$;

rollback;
