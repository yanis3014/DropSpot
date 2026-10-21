-- place_open_status (Europe/Paris) smoke tests. Rolls back at end.

begin;

do $$
declare
  v_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_place uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_today date;
  v_status json;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values (
    v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'owner-hours@test.local', crypt('x', gen_salt('bf')),
    now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  )
  on conflict (id) do nothing;

  insert into public.profiles (
    id, full_name, role, grains_balance,
    onboarding_completed_at, welcome_grains_claimed_at,
    preferences, onboarding_answers
  )
  values (v_owner, 'Owner Hours', 'vendor', 0, now(), now(), '{}', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.places (id, name, vendor_id, lat, lng, verification_status)
  values (v_place, 'Hours Test Cafe', v_owner, 43.7, 7.2, 'verified')
  on conflict (id) do update set vendor_id = excluded.vendor_id;

  insert into public.place_members (place_id, user_id, role)
  values (v_place, v_owner, 'owner')
  on conflict do nothing;

  delete from public.place_opening_hours where place_id = v_place;
  delete from public.place_special_hours where place_id = v_place;

  v_today := (now() at time zone 'Europe/Paris')::date;

  insert into public.place_special_hours (
    place_id, on_date, opens, closes, closed, label
  )
  values (v_place, v_today, time '08:00', time '19:00', false, 'test day');

  v_status := public.place_open_status(v_place);

  if coalesce((v_status ->> 'ok')::boolean, false) is not true then
    raise exception 'FAIL: place_open_status not ok: %', v_status;
  end if;

  if coalesce((v_status ->> 'has_hours')::boolean, false) is not true then
    raise exception 'FAIL: expected has_hours true';
  end if;

  if (now() at time zone 'Europe/Paris')::time >= time '08:00'
     and (now() at time zone 'Europe/Paris')::time < time '19:00' then
    if coalesce((v_status ->> 'is_open')::boolean, false) is not true then
      raise exception 'FAIL: expected open during slot, got %', v_status;
    end if;
    if coalesce(v_status ->> 'detail', '') not like 'ferme à 19 h%' then
      raise exception 'FAIL: expected ferme à 19 h, got %', v_status ->> 'detail';
    end if;
  end if;

  raise notice 'opening_hours: assertions passed';
end $$;

rollback;
