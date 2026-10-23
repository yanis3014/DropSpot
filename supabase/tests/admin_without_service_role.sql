-- Claim proofs readable by admins only; suspension through the admin RPC. Rolls back at end.

begin;

do $$
declare
  v_admin uuid := 'a1a1a1a1-0000-0000-0000-00000000c001';
  v_client uuid := 'a1a1a1a1-0000-0000-0000-00000000c002';
  v_other uuid := 'a1a1a1a1-0000-0000-0000-00000000c003';
  v_res json;
  v_count integer;
  v_until timestamptz;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin-nosr@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    (v_client, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'client-nosr@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'other-nosr@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
  on conflict (id) do nothing;

  insert into public.admins (user_id) values (v_admin) on conflict do nothing;

  insert into storage.objects (bucket_id, name)
  values ('claim-proofs', v_other::text || '/claim/kbis.pdf');

  execute 'set local role authenticated';

  -- 1) A client cannot read someone else's proof, nor suspend anyone
  perform set_config('request.jwt.claim.sub', v_client::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_client::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  select count(*) into v_count from storage.objects
  where bucket_id = 'claim-proofs' and name like v_other::text || '/%';
  if v_count <> 0 then
    raise exception 'FAIL: client reads another user''s claim proof';
  end if;

  v_res := public.admin_set_user_suspended(v_other, true, 'spam');
  if coalesce((v_res ->> 'ok')::boolean, false) then
    raise exception 'FAIL: client can suspend';
  end if;

  -- 2) Admin without the 6-digit code: no proof
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);

  select count(*) into v_count from storage.objects
  where bucket_id = 'claim-proofs' and name like v_other::text || '/%';
  if v_count <> 0 then
    raise exception 'FAIL: admin at aal1 reads claim proofs';
  end if;

  -- 3) Admin with the code
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  select count(*) into v_count from storage.objects
  where bucket_id = 'claim-proofs' and name like v_other::text || '/%';
  if v_count <> 1 then
    raise exception 'FAIL: admin cannot read claim proof';
  end if;

  if coalesce((public.admin_set_user_suspended(v_other, true, '') ->> 'ok')::boolean, false) then
    raise exception 'FAIL: suspension without a reason accepted';
  end if;
  if coalesce((public.admin_set_user_suspended(v_admin, true, 'test') ->> 'ok')::boolean, false) then
    raise exception 'FAIL: admin can suspend themself';
  end if;

  v_res := public.admin_set_user_suspended(v_other, true, 'spam');
  if not coalesce((v_res ->> 'ok')::boolean, false) then
    raise exception 'FAIL: suspend: %', v_res;
  end if;
  execute 'reset role';
  select banned_until into v_until from auth.users where id = v_other;
  if v_until is null or v_until < now() + interval '50 years' then
    raise exception 'FAIL: banned_until not set: %', v_until;
  end if;
  execute 'set local role authenticated';

  v_res := public.admin_set_user_suspended(v_other, false, null);
  if not coalesce((v_res ->> 'ok')::boolean, false) then
    raise exception 'FAIL: unsuspend: %', v_res;
  end if;
  execute 'reset role';
  if (select banned_until from auth.users where id = v_other) is not null then
    raise exception 'FAIL: banned_until not cleared';
  end if;
  select count(*) into v_count from public.admin_actions
  where target_id = v_other and action in ('suspend_user', 'unsuspend_user');
  if v_count <> 2 then
    raise exception 'FAIL: expected 2 logged actions, got %', v_count;
  end if;
end;
$$;

do $$
begin
  if has_function_privilege('anon', 'public.admin_set_user_suspended(uuid, boolean, text)', 'execute') then
    raise exception 'FAIL: anon can call admin_set_user_suspended';
  end if;
end;
$$;

rollback;
