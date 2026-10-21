-- Checks for 20261021090000_security_advisor_warnings.sql.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security_advisor_warnings.sql
do $$
begin
  if has_function_privilege('anon', 'public.claim_welcome_grains()', 'execute')
     or has_function_privilege('anon', 'public.validate_flash_drop_code(text, uuid)', 'execute')
     or has_function_privilege('anon', 'public.vendor_today_stats()', 'execute')
     or has_function_privilege('anon', 'public.handle_new_user()', 'execute')
     or has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') then
    raise exception 'FAIL: anon (or authenticated for handle_new_user) can still execute a SECURITY DEFINER function';
  end if;

  if not (has_function_privilege('authenticated', 'public.claim_welcome_grains()', 'execute')
     and has_function_privilege('authenticated', 'public.validate_flash_drop_code(text, uuid)', 'execute')
     and has_function_privilege('authenticated', 'public.vendor_today_stats()', 'execute')) then
    raise exception 'FAIL: authenticated lost EXECUTE on an RPC used by the app';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'SELECT' and qual = '(bucket_id = ''place-photos''::text)'
  ) then
    raise exception 'FAIL: a broad SELECT policy still allows listing place-photos';
  end if;

  if exists (
    select 1 from pg_proc
    where oid in ('public.set_updated_at()'::regprocedure, 'public.protect_profile_columns()'::regprocedure)
      and proconfig is null
  ) then
    raise exception 'FAIL: trigger function without a fixed search_path';
  end if;

  raise notice 'OK: security advisor warnings fixed';
end $$;
