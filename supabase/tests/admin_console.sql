-- Admin console: is_admin() needs aal2, is_admin_member() does not,
-- admin_overview() is admin (aal2) only. Rolls back at end.

begin;

do $$
declare
  v_admin uuid := 'a0a0a0a0-0000-0000-0000-00000000a001';
  v_user uuid := 'a0a0a0a0-0000-0000-0000-00000000a002';
  v_place uuid := 'a0a0a0a0-0000-0000-0000-00000000a003';
  v_overview json;
  v_err text;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (
      v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'admin-console@test.local', crypt('x', gen_salt('bf')),
      now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      v_user, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'user-console@test.local', crypt('x', gen_salt('bf')),
      now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    )
  on conflict (id) do nothing;

  insert into public.admins (user_id) values (v_admin) on conflict do nothing;

  insert into public.places (id, name, lat, lng, verification_status)
  values (v_place, 'Console Test Cafe', 43.7, 7.2, 'unclaimed')
  on conflict (id) do nothing;

  execute 'set local role authenticated';

  -- 1) Admin with a password only (aal1)
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated', 'aal', 'aal1')::text,
    true
  );

  if public.is_admin() then
    raise exception 'FAIL: is_admin() true at aal1';
  end if;
  if not public.is_admin_member() then
    raise exception 'FAIL: is_admin_member() false for an admin at aal1';
  end if;

  v_err := null;
  begin
    perform public.admin_overview();
  exception when insufficient_privilege then
    v_err := 'denied';
  end;
  if v_err is distinct from 'denied' then
    raise exception 'FAIL: admin_overview() allowed at aal1';
  end if;

  -- 2) Same admin after the 6-digit code (aal2)
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );

  if not public.is_admin() then
    raise exception 'FAIL: is_admin() false at aal2';
  end if;

  v_overview := public.admin_overview();
  if coalesce((v_overview ->> 'places_total')::int, 0) < 1 then
    raise exception 'FAIL: admin_overview() places_total: %', v_overview;
  end if;
  if v_overview ->> 'pending_claims' is null
     or v_overview ->> 'places_verified' is null
     or v_overview ->> 'pros_active' is null then
    raise exception 'FAIL: admin_overview() missing keys: %', v_overview;
  end if;

  -- 3) Non-admin, even at aal2
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user::text, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );

  if public.is_admin() or public.is_admin_member() then
    raise exception 'FAIL: non-admin seen as admin';
  end if;

  v_err := null;
  begin
    perform public.admin_overview();
  exception when insufficient_privilege then
    v_err := 'denied';
  end;
  if v_err is distinct from 'denied' then
    raise exception 'FAIL: admin_overview() allowed for a non-admin';
  end if;

  execute 'reset role';
end;
$$;

-- 4) Anonymous visitors cannot call the new functions
do $$
begin
  if has_function_privilege('anon', 'public.is_admin_member()', 'execute') then
    raise exception 'FAIL: anon can execute is_admin_member()';
  end if;
  if has_function_privilege('anon', 'public.admin_overview()', 'execute') then
    raise exception 'FAIL: anon can execute admin_overview()';
  end if;
end;
$$;

rollback;
