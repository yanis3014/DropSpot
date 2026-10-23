-- vendor_plans / has_pro / Pro-gated features. Rolls back at end.

begin;

do $$
declare
  v_admin uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_owner uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_place uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_drop uuid := '11111111-1111-1111-1111-111111111111';
  v_inv json;
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
      'authenticated', 'admin-plan@test.local', crypt('x', gen_salt('bf')),
      now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'owner-plan@test.local', crypt('x', gen_salt('bf')),
      now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    )
  on conflict (id) do nothing;

  insert into public.admins (user_id) values (v_admin) on conflict do nothing;

  insert into public.profiles (
    id, full_name, role, grains_balance,
    onboarding_completed_at, welcome_grains_claimed_at,
    preferences, onboarding_answers
  )
  values
    (v_admin, 'Admin', 'vendor', 0, now(), now(), '{}', '{}'::jsonb),
    (v_owner, 'Owner Free', 'vendor', 0, now(), now(), '{}', '{}'::jsonb)
  on conflict (id) do update set role = excluded.role;

  insert into public.places (id, name, vendor_id, lat, lng, verification_status)
  values (v_place, 'Plan Test Cafe', v_owner, 43.7, 7.2, 'verified')
  on conflict (id) do update set vendor_id = v_owner;

  insert into public.place_members (place_id, user_id, role)
  values (v_place, v_owner, 'owner')
  on conflict (place_id, user_id) do update set role = 'owner';

  insert into public.vendor_plans (user_id, plan, pro_until)
  values (v_owner, 'free', null)
  on conflict (user_id) do update set plan = 'free', pro_until = null;

  if public.has_pro(v_owner) then
    raise exception 'FAIL: free owner should not has_pro';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_inv := public.invite_member(v_place, 'manager@test.local', 'manager');
  if coalesce((v_inv ->> 'ok')::boolean, false) is not false then
    raise exception 'FAIL: manager invite on free plan should fail: %', v_inv;
  end if;
  if coalesce(v_inv ->> 'error', '') is distinct from 'pro_required' then
    raise exception 'FAIL: expected pro_required, got %', v_inv;
  end if;

  delete from public.flash_drops where id = v_drop;
  begin
    insert into public.flash_drops (
      id, vendor_id, place_id, title, starts_at, ends_at,
      is_active, is_recurring, kind
    )
    values (
      v_drop, v_owner, v_place, 'Recurring test',
      now(), now() + interval '1 hour', true, true, 'offer'
    );
    raise exception 'FAIL: recurring insert should raise on free plan';
  exception
    when others then
      v_err := sqlerrm;
      if v_err not like '%pro_required%' then
        raise exception 'FAIL: unexpected error on recurring insert: %', v_err;
      end if;
  end;

  reset role;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
  execute 'set local role authenticated';

  v_inv := public.admin_set_vendor_plan(v_owner, 'pro', now() + interval '30 days');
  if coalesce((v_inv ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: admin_set_vendor_plan: %', v_inv;
  end if;

  reset role;

  if public.has_pro(v_owner) is not true then
    raise exception 'FAIL: owner should has_pro after admin grant';
  end if;

  raise notice 'vendor_plan_security: all assertions passed';
end $$;

rollback;
