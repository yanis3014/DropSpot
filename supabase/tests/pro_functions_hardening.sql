-- Checks for 20261021233000_pro_functions_hardening.sql.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pro_functions_hardening.sql
do $$
declare
  v_fn text;
begin
  -- No SECURITY DEFINER function in public is callable without signing in,
  -- except the public readers used by the map without an account
  -- (opening hours, live vibes, event participant counts and café
  -- specificities, no user ids).
  select string_agg(p.oid::regprocedure::text, ', ')
  into v_fn
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.prosecdef
    and p.proname not in ('place_open_status', 'places_open_status', 'get_place_vibes', 'drop_participants', 'get_place_specs',
                           'get_spec_rankings', 'get_place_ranks')
    and has_function_privilege('anon', p.oid, 'execute');
  if v_fn is not null then
    raise exception 'FAIL: anon can execute SECURITY DEFINER functions: %', v_fn;
  end if;

  -- Every function written for the app pins its search_path.
  select string_agg(p.oid::regprocedure::text, ', ')
  into v_fn
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proconfig is null
    and not exists (
      select 1 from pg_depend d
      where d.objid = p.oid and d.deptype = 'e'
    );
  if v_fn is not null then
    raise exception 'FAIL: functions without a fixed search_path: %', v_fn;
  end if;

  -- The app still reaches the RPCs it needs.
  if not (
    has_function_privilege('authenticated', 'public.redeem_drop_code(uuid, text)', 'execute')
    and has_function_privilege('authenticated', 'public.vendor_today_stats(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.request_claim(uuid, text, text, text)', 'execute')
    and has_function_privilege('anon', 'public.places_open_status(uuid[])', 'execute')
  ) then
    raise exception 'FAIL: the app lost EXECUTE on an RPC it uses';
  end if;

  raise notice 'OK: pro functions hardened';
end $$;
