-- Pro access only after admin approval: has_place_role / is_pro need a
-- verified café; pro_access_status + mark_pro_welcome_seen.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pro_access_after_approval.sql

begin;

do $$
declare
  u_gerant uuid := 'a1111111-1111-1111-1111-111111111111';
  u_legacy uuid := 'a2222222-2222-2222-2222-222222222222';
  u_admin uuid := 'a3333333-3333-3333-3333-333333333333';
  u_other uuid := 'a4444444-4444-4444-4444-444444444444';
  place_new uuid;
  place_legacy uuid := 'a5555555-5555-5555-5555-555555555555';
  v_result json;
  v_claim_id uuid;
  v_count integer;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', e, crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  from (values
    (u_gerant, 'gerant-wait@test.local'),
    (u_legacy, 'legacy-pending@test.local'),
    (u_admin, 'admin-wait@test.local'),
    (u_other, 'other-wait@test.local')
  ) as t(u, e)
  on conflict (id) do nothing;

  insert into public.admins (user_id) values (u_admin)
  on conflict (user_id) do nothing;

  -- A café with a member but still waiting for review (old direct-insert
  -- flow): the member must have no pro rights.
  insert into public.places (id, name, address, vendor_id, lat, lng, verification_status)
  values (place_legacy, 'Legacy Pending', '1 rue Test', u_legacy, 43.7, 7.2, 'pending')
  on conflict (id) do update set vendor_id = excluded.vendor_id,
    verification_status = excluded.verification_status;

  if not exists (
    select 1 from public.place_members where place_id = place_legacy and user_id = u_legacy
  ) then
    raise exception 'FAIL: fixture: legacy owner membership missing';
  end if;

  -- ---------------------------------------------------------------- legacy
  perform set_config('request.jwt.claim.sub', u_legacy::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_legacy::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  if public.is_pro() then
    raise exception 'FAIL: member of a pending café must not be pro';
  end if;
  if public.has_place_role(place_legacy, array['owner']) then
    raise exception 'FAIL: has_place_role true on a pending café';
  end if;

  update public.places set description = 'hack' where id = place_legacy;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: member edited a pending café';
  end if;

  select count(*) into v_count from public.place_members where place_id = place_legacy;
  if v_count <> 0 then
    raise exception 'FAIL: member of a pending café reads its team';
  end if;

  if public.pro_access_status() ->> 'state' <> 'none' then
    raise exception 'FAIL: legacy pending member state %', public.pro_access_status();
  end if;

  reset role;

  -- ---------------------------------------------------------------- gérant
  perform set_config('request.jwt.claim.sub', u_gerant::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_gerant::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  if public.pro_access_status() ->> 'state' <> 'none' then
    raise exception 'FAIL: new user state should be none';
  end if;

  v_result := public.suggest_place('Mon Nouveau Café', '3 rue Neuve', 'Nice', 43.71, 7.26);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: suggest_place: %', v_result;
  end if;
  place_new := (v_result ->> 'place_id')::uuid;

  v_result := public.request_claim(place_new, 'Gérant·e', 'phone', null);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: request_claim: %', v_result;
  end if;
  v_claim_id := (v_result ->> 'claim_id')::uuid;

  v_result := public.pro_access_status();
  if v_result ->> 'state' <> 'pending'
     or (v_result -> 'pending' ->> 'place_id')::uuid is distinct from place_new then
    raise exception 'FAIL: state after claim should be pending, got %', v_result;
  end if;
  if public.is_pro() then
    raise exception 'FAIL: pending gérant must not be pro';
  end if;

  reset role;

  -- --------------------------------------------------------------- approve
  perform set_config('request.jwt.claim.sub', u_admin::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_admin::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';

  v_result := public.approve_claim(v_claim_id, null);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: approve_claim: %', v_result;
  end if;

  reset role;

  -- Another user cannot mark the gérant's welcome as seen.
  perform set_config('request.jwt.claim.sub', u_other::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_other::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_result := public.mark_pro_welcome_seen();
  if (v_result ->> 'updated')::integer <> 0 then
    raise exception 'FAIL: other user marked a welcome: %', v_result;
  end if;

  begin
    update public.place_claims set welcomed_at = now() where id = v_claim_id;
    get diagnostics v_count = row_count;
    if v_count <> 0 then
      raise exception 'FAIL: direct update of place_claims allowed';
    end if;
  exception
    when insufficient_privilege then null;
  end;

  reset role;

  perform set_config('request.jwt.claim.sub', u_gerant::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_gerant::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_result := public.pro_access_status();
  if v_result ->> 'state' <> 'welcome'
     or (v_result -> 'welcome' ->> 'place_id')::uuid is distinct from place_new then
    raise exception 'FAIL: state after approval should be welcome, got %', v_result;
  end if;
  if not public.is_pro() then
    raise exception 'FAIL: approved gérant should be pro';
  end if;
  if not public.has_place_role(place_new, array['owner']) then
    raise exception 'FAIL: approved gérant should own the café';
  end if;

  v_result := public.mark_pro_welcome_seen();
  if (v_result ->> 'updated')::integer <> 1 then
    raise exception 'FAIL: mark_pro_welcome_seen: %', v_result;
  end if;

  if public.pro_access_status() ->> 'state' <> 'active' then
    raise exception 'FAIL: state after welcome should be active, got %',
      public.pro_access_status();
  end if;

  reset role;

  -- anon cannot call the status function
  begin
    execute 'set local role anon';
    perform public.pro_access_status();
    raise exception 'FAIL: anon called pro_access_status';
  exception
    when insufficient_privilege then null;
  end;
  reset role;

  raise notice 'pro_access_after_approval: all assertions passed';
end $$;

rollback;
