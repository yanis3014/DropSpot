-- Admin console lot 2: log, cafés, users, plans. Rolls back at end.

begin;

do $$
declare
  v_admin uuid := 'a1a1a1a1-0000-0000-0000-00000000b001';
  v_client uuid := 'a1a1a1a1-0000-0000-0000-00000000b002';
  v_owner uuid := 'a1a1a1a1-0000-0000-0000-00000000b003';
  v_suggested uuid := 'a1a1a1a1-0000-0000-0000-00000000b004';
  v_claimed uuid := 'a1a1a1a1-0000-0000-0000-00000000b005';
  v_claim uuid := 'a1a1a1a1-0000-0000-0000-00000000b006';
  v_res json;
  v_count integer;
  v_err text;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin-lot2@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    (v_client, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'client-lot2@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner-lot2@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
  on conflict (id) do nothing;

  insert into public.admins (user_id) values (v_admin) on conflict do nothing;

  insert into public.profiles (id, full_name, role, grains_balance,
    onboarding_completed_at, welcome_grains_claimed_at, preferences, onboarding_answers)
  values
    (v_admin, 'Admin Lot2', 'user', 0, now(), now(), '{}', '{}'::jsonb),
    (v_client, 'Léa Lot2', 'user', 0, now(), now(), '{}', '{}'::jsonb),
    (v_owner, 'Owner Lot2', 'vendor', 0, now(), now(), '{}', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.places (id, name, address, location, lat, lng, verification_status, suggested_by)
  values
    (v_suggested, 'Lot2 Suggested Cafe', '1 rue Test', 'POINT(7.2 43.7)', 43.7, 7.2, 'unclaimed', v_client),
    (v_claimed, 'Lot2 Claimed Cafe', '2 rue Test', 'POINT(7.2 43.7)', 43.7, 7.2, 'unclaimed', null)
  on conflict (id) do nothing;

  insert into public.place_claims (id, place_id, user_id, declared_role, proof_method, status)
  values (v_claim, v_claimed, v_owner, 'owner', 'document', 'pending')
  on conflict (id) do nothing;

  execute 'set local role authenticated';

  -- 1) A client cannot use any admin function, nor read the log
  perform set_config('request.jwt.claim.sub', v_client::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_client::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  v_err := null;
  begin
    perform * from public.admin_search_users(null, 10);
  exception when insufficient_privilege then v_err := 'denied';
  end;
  if v_err is distinct from 'denied' then
    raise exception 'FAIL: client can search users';
  end if;

  v_err := null;
  begin
    perform * from public.admin_list_places(null, 'all', 10);
  exception when insufficient_privilege then v_err := 'denied';
  end;
  if v_err is distinct from 'denied' then
    raise exception 'FAIL: client can list places as admin';
  end if;

  v_res := public.admin_update_place(v_suggested, 'Hacked', 'Hacked street', null);
  if (v_res ->> 'ok')::boolean then
    raise exception 'FAIL: client can update a place';
  end if;

  v_res := public.admin_set_user_suspended(v_owner, true, 'xxx');
  if (v_res ->> 'ok')::boolean then
    raise exception 'FAIL: client can suspend an account';
  end if;

  select count(*) into v_count from public.admin_actions;
  if v_count <> 0 then
    raise exception 'FAIL: client reads % admin actions', v_count;
  end if;

  v_err := null;
  begin
    insert into public.admin_actions (action, target_type) values ('fake', 'user');
  exception when insufficient_privilege then v_err := 'denied';
  end;
  if v_err is distinct from 'denied' then
    raise exception 'FAIL: client can insert into admin_actions';
  end if;

  -- 2) Admin without the 6-digit code is refused too
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);

  v_res := public.admin_mark_place_reviewed(v_suggested);
  if (v_res ->> 'ok')::boolean then
    raise exception 'FAIL: admin at aal1 can review a place';
  end if;

  -- 3) Admin with the code
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  select count(*) into v_count from public.admin_list_places('Lot2', 'to_review', 50);
  if v_count <> 1 then
    raise exception 'FAIL: to_review should list 1 café, got %', v_count;
  end if;

  v_res := public.admin_mark_place_reviewed(v_suggested);
  if not coalesce((v_res ->> 'ok')::boolean, false) then
    raise exception 'FAIL: review place: %', v_res;
  end if;

  select count(*) into v_count from public.admin_list_places('Lot2', 'to_review', 50);
  if v_count <> 0 then
    raise exception 'FAIL: reviewed café still to review';
  end if;

  v_res := public.admin_update_place(v_suggested, 'Lot2 Renamed Cafe', '1 rue Test', 'Nice');
  if not coalesce((v_res ->> 'ok')::boolean, false) then
    raise exception 'FAIL: update place: %', v_res;
  end if;
  v_res := public.admin_update_place(v_suggested, '', '1 rue Test', 'Nice');
  if coalesce((v_res ->> 'ok')::boolean, false) then
    raise exception 'FAIL: empty name accepted';
  end if;

  select count(*) into v_count from public.admin_search_users('lot2@test.local', 50);
  if v_count <> 3 then
    raise exception 'FAIL: search users should find 3, got %', v_count;
  end if;

  v_res := public.admin_user_detail(v_client);
  if v_res ->> 'email' is distinct from 'client-lot2@test.local'
     or (v_res ->> 'suggested_count')::int <> 1 then
    raise exception 'FAIL: user detail: %', v_res;
  end if;

  -- Claim decision and plan change are logged by triggers
  v_res := public.approve_claim(v_claim, 'Kbis ok');
  if not coalesce((v_res ->> 'ok')::boolean, false) then
    raise exception 'FAIL: approve claim: %', v_res;
  end if;

  v_res := public.admin_set_vendor_plan(v_owner, 'pro', now() + interval '30 days');
  if not coalesce((v_res ->> 'ok')::boolean, false) then
    raise exception 'FAIL: set plan: %', v_res;
  end if;

  select count(*) into v_count from public.admin_list_vendors() v where v.user_id = v_owner and v.has_pro;
  if v_count <> 1 then
    raise exception 'FAIL: owner should be listed as Pro';
  end if;

  v_res := public.admin_set_user_suspended(v_client, true, 'spam');
  if not coalesce((v_res ->> 'ok')::boolean, false) then
    raise exception 'FAIL: suspend: %', v_res;
  end if;

  select count(*) into v_count
  from public.admin_list_actions(100, null) a
  where a.admin_name is distinct from 'Admin supprimé'
    and a.action in ('review_place', 'update_place', 'approve_claim', 'set_plan', 'suspend_user');
  if v_count <> 5 then
    raise exception 'FAIL: expected 5 logged actions, got % : %', v_count, (select json_agg(json_build_object('n', a.admin_name, 'a', a.action)) from public.admin_list_actions(100, null) a);
  end if;

  if (public.admin_overview() ->> 'places_to_review') is null then
    raise exception 'FAIL: admin_overview missing places_to_review';
  end if;

  execute 'reset role';
end;
$$;

-- 4) Anonymous visitors cannot call any of it; the internal writer is closed
do $$
begin
  if has_function_privilege('anon', 'public.admin_search_users(text, integer)', 'execute')
     or has_function_privilege('anon', 'public.admin_user_detail(uuid)', 'execute')
     or has_function_privilege('anon', 'public.admin_list_places(text, text, integer)', 'execute')
     or has_function_privilege('anon', 'public.admin_list_actions(integer, timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.admin_list_vendors()', 'execute') then
    raise exception 'FAIL: anon can execute an admin function';
  end if;
  if has_function_privilege('authenticated',
       'public.log_admin_action(text, text, uuid, text, jsonb, text)', 'execute') then
    raise exception 'FAIL: authenticated can call log_admin_action directly';
  end if;
end;
$$;

rollback;
