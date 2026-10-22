-- After legacy_policies_cleanup: manager sans Pro ne peut pas créer un drop ;
-- owner peut toujours lire ses drops. Rolls back at end.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/legacy_policies_cleanup.sql

begin;

do $$
declare
  u_owner uuid := 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';
  u_manager uuid := 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0';
  p_cafe uuid := 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0';
  d_owner uuid := 'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0';
  d_mgr uuid := 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0';
  v_count integer;
  v_err text;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (
      u_owner, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'owner-legacy-pol@test.local', crypt('x', gen_salt('bf')),
      now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      u_manager, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'manager-legacy-pol@test.local', crypt('x', gen_salt('bf')),
      now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    )
  on conflict (id) do nothing;

  insert into public.profiles (
    id, full_name, role, grains_balance,
    onboarding_completed_at, welcome_grains_claimed_at,
    preferences, onboarding_answers
  )
  values
    (u_owner, 'Owner Legacy', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (u_manager, 'Manager Legacy', 'vendor', 0, now(), now(), '{}', '{}'::jsonb)
  on conflict (id) do update set role = excluded.role;

  insert into public.places (id, name, vendor_id, lat, lng, verification_status)
  values (p_cafe, 'Legacy Pol Cafe', u_owner, 43.7, 7.2, 'verified')
  on conflict (id) do update set
    vendor_id = excluded.vendor_id,
    verification_status = 'verified';

  delete from public.place_members where place_id = p_cafe;
  insert into public.place_members (place_id, user_id, role)
  values
    (p_cafe, u_owner, 'owner'),
    (p_cafe, u_manager, 'manager');

  -- Place vendor stays on free (no Pro) so manager inserts must fail RLS.
  insert into public.vendor_plans (user_id, plan, pro_until)
  values (u_owner, 'free', null)
  on conflict (user_id) do update set plan = 'free', pro_until = null;

  if public.has_pro(u_owner) then
    raise exception 'FAIL: owner plan must stay free for this test';
  end if;

  delete from public.flash_drops where id in (d_owner, d_mgr);

  -- Seed a drop as owner (security definer path via role reset + direct insert
  -- as table owner equivalent: use authenticated owner JWT).
  perform set_config('request.jwt.claim.sub', u_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_owner::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  insert into public.flash_drops (
    id, vendor_id, place_id, title, kind,
    starts_at, ends_at, is_active, max_uses, current_uses, grains_reward
  )
  values (
    d_owner, u_owner, p_cafe, 'Owner readable drop', 'offer',
    now() - interval '5 minutes', now() + interval '2 hours', true,
    10, 0, 10
  );

  select count(*)::integer into v_count
  from public.flash_drops
  where id = d_owner;

  if v_count is distinct from 1 then
    raise exception 'FAIL: owner must read own flash_drops, count=%', v_count;
  end if;

  reset role;

  -- Manager without Pro cannot insert a drop (RLS with check has_pro).
  perform set_config('request.jwt.claim.sub', u_manager::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', u_manager::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    insert into public.flash_drops (
      id, vendor_id, place_id, title, kind,
      starts_at, ends_at, is_active, max_uses, current_uses, grains_reward
    )
    values (
      d_mgr, u_owner, p_cafe, 'Manager blocked drop', 'offer',
      now(), now() + interval '1 hour', true, 5, 0, 10
    );
    raise exception 'FAIL: manager without Pro must not insert flash_drops';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      v_err := sqlerrm;
      -- RLS violation or check failure — both acceptable.
      if v_err is null or length(v_err) = 0 then
        raise exception 'FAIL: expected insert denial for manager without Pro';
      end if;
  end;

  reset role;

  raise notice 'legacy_policies_cleanup: all assertions passed';
end $$;

rollback;
