-- Pro access: is_pro, handle_new_user, protect_profile_columns, profile.role sync.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pro_access.sql

begin;

do $$
declare
  u_signup uuid := '11111111-1111-1111-1111-111111111111';
  u_claim uuid := '22222222-2222-2222-2222-222222222222';
  u_invitee uuid := '33333333-3333-3333-3333-333333333333';
  u_owner uuid := '44444444-4444-4444-4444-444444444444';
  u_admin uuid := '55555555-5555-5555-5555-555555555555';
  place_u uuid := '66666666-6666-6666-6666-666666666666';
  place_inv uuid := '77777777-7777-7777-7777-777777777777';
  v_role text;
  v_pro boolean;
  v_result json;
  v_token text;
  v_claim_id uuid;
begin
  -- Fixtures
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (
      u_signup, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'signup-vendor-meta@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('role', 'vendor', 'full_name', 'Signup Vendor Meta'),
      now(), now()
    ),
    (
      u_claim, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'claimant@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      u_invitee, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'invitee@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      u_owner, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'owner-inv@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      u_admin, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'admin-pro-access@test.local', crypt('x', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    )
  on conflict (id) do nothing;

  -- on_auth_user_created (handle_new_user) created the profile from the
  -- auth.users insert above, with role=vendor in the metadata.
  select role into v_role from public.profiles where id = u_signup;
  if v_role is null then
    raise exception 'FAIL: handle_new_user did not create the profile';
  end if;
  if v_role is distinct from 'user' then
    raise exception 'FAIL: signup with vendor metadata must stay user, got %', v_role;
  end if;

  -- Client cannot change role
  perform set_config('request.jwt.claim.sub', u_signup::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_signup::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    update public.profiles set role = 'vendor' where id = u_signup;
    raise exception 'FAIL: client must not update profiles.role';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      null;
  end;

  reset role;

  insert into public.profiles (id, full_name, role, grains_balance, onboarding_completed_at, welcome_grains_claimed_at, preferences, onboarding_answers)
  values
    (u_claim, 'Claimant', 'user', 0, now(), now(), '{}', '{}'::jsonb),
    (u_invitee, 'Invitee', 'user', 0, now(), now(), '{}', '{}'::jsonb),
    (u_owner, 'Owner', 'user', 0, now(), now(), '{}', '{}'::jsonb),
    (u_admin, 'Admin', 'user', 0, now(), now(), '{}', '{}'::jsonb)
  on conflict (id) do update set role = excluded.role;

  insert into public.admins (user_id) values (u_admin)
  on conflict (user_id) do nothing;

  insert into public.places (id, name, vendor_id, lat, lng, verification_status)
  values
    (place_u, 'Unclaimed Pro Access', null, 43.7, 7.2, 'unclaimed'),
    (place_inv, 'Invite Cafe', u_owner, 43.7, 7.21, 'verified')
  on conflict (id) do update set vendor_id = excluded.vendor_id, name = excluded.name;

  insert into public.place_members (place_id, user_id, role)
  values (place_inv, u_owner, 'owner')
  on conflict (place_id, user_id) do update set role = 'owner';

  -- is_pro false before membership
  perform set_config('request.jwt.claim.sub', u_claim::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_claim::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  select public.is_pro(u_claim) into v_pro;
  if v_pro is not false then
    raise exception 'FAIL: is_pro should be false before claim, got %', v_pro;
  end if;

  v_result := public.request_claim(place_u, 'owner', 'phone', null);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: request_claim: %', v_result;
  end if;
  v_claim_id := (v_result ->> 'claim_id')::uuid;

  reset role;

  perform set_config('request.jwt.claim.sub', u_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_admin::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.approve_claim(v_claim_id, 'ok');
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: approve_claim: %', v_result;
  end if;

  reset role;

  perform set_config('request.jwt.claim.sub', u_claim::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_claim::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  select public.is_pro(u_claim) into v_pro;
  if v_pro is not true then
    raise exception 'FAIL: is_pro should be true after approve_claim';
  end if;

  select role into v_role from public.profiles where id = u_claim;
  if v_role is distinct from 'vendor' then
    raise exception 'FAIL: profiles.role should be vendor after approve, got %', v_role;
  end if;

  -- accept_invitation
  reset role;
  perform set_config('request.jwt.claim.sub', u_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_owner::text, 'email', 'owner-inv@test.local', 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.invite_member(place_inv, 'invitee@test.local', 'staff');
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: invite_member: %', v_result;
  end if;
  v_token := v_result ->> 'token';

  reset role;
  perform set_config('request.jwt.claim.sub', u_invitee::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_invitee::text, 'email', 'invitee@test.local', 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  select public.is_pro(u_invitee) into v_pro;
  if v_pro is not false then
    raise exception 'FAIL: invitee is_pro before accept should be false';
  end if;

  v_result := public.accept_invitation(v_token);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: accept_invitation: %', v_result;
  end if;

  select public.is_pro(u_invitee) into v_pro;
  if v_pro is not true then
    raise exception 'FAIL: is_pro should be true after accept_invitation';
  end if;

  select role into v_role from public.profiles where id = u_invitee;
  if v_role is distinct from 'vendor' then
    raise exception 'FAIL: invitee profiles.role should be vendor, got %', v_role;
  end if;

  reset role;
  perform set_config('request.jwt.claim.sub', u_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_owner::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_result := public.remove_member(place_inv, u_invitee);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: remove_member: %', v_result;
  end if;

  select public.is_pro(u_invitee) into v_pro;
  if v_pro is not false then
    raise exception 'FAIL: is_pro should be false after remove_member';
  end if;

  -- The owner cannot read another user's profile under RLS: check as admin.
  reset role;
  select role into v_role from public.profiles where id = u_invitee;
  if v_role is distinct from 'user' then
    raise exception 'FAIL: profiles.role should be user after remove, got %', v_role;
  end if;

  -- A pro (member of another café) cannot take an unclaimed café directly:
  -- claims go through request_claim + approve_claim.
  insert into public.places (id, name, lat, lng, vendor_id)
  values ('88888888-8888-8888-8888-888888888888', 'Unclaimed test cafe', 43.7, 7.26, null);

  perform set_config('request.jwt.claim.sub', u_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_owner::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  if public.is_pro(u_owner) is not true then
    raise exception 'FAIL: fixture owner should be pro';
  end if;

  begin
    update public.places
    set vendor_id = u_owner
    where id = '88888888-8888-8888-8888-888888888888';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  reset role;
  if exists (
    select 1 from public.places
    where id = '88888888-8888-8888-8888-888888888888' and vendor_id is not null
  ) or exists (
    select 1 from public.place_members
    where place_id = '88888888-8888-8888-8888-888888888888'
  ) then
    raise exception 'FAIL: a pro claimed an unclaimed cafe without verification';
  end if;

  raise notice 'pro_access: all assertions passed';
end $$;

rollback;
