-- Admin console (lot 1): admins must pass a 6-digit code (Supabase MFA TOTP).
--
-- is_admin() now also requires an aal2 session, so every admin RPC
-- (approve_claim, reject_claim, admin_set_vendor_plan, …) and every RLS
-- policy built on it refuses an admin who only typed a password.
-- is_admin_member() keeps the plain membership check, for the pages where an
-- admin sets up or types the code.
--
-- Impact ERP / Souley: an ERP signed in with an admin account must also
-- verify the code (aal2) before reading admin-only data.

-- ---------------------------------------------------------------------------
-- 1) Membership only (any assurance level)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;

comment on function public.is_admin_member() is
  'True when the session user is in admins, whatever the MFA level. Only for the 2FA setup pages; use is_admin() everywhere else.';

revoke execute on function public.is_admin_member() from public, anon;
grant execute on function public.is_admin_member() to authenticated;

-- ---------------------------------------------------------------------------
-- 2) is_admin(): membership + 6-digit code verified in this session
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  )
  and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

comment on function public.is_admin() is
  'True when the session user is in admins and verified their 6-digit code (aal2).';

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) admin_overview(): counters for the « À traiter » page
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return json_build_object(
    'pending_claims',
      (select count(*) from public.place_claims where status = 'pending'),
    'places_total',
      (select count(*) from public.places),
    'places_verified',
      (select count(*) from public.places where verification_status = 'verified'),
    'pros_active',
      (select count(*) from public.vendor_plans
        where plan = 'pro' and (pro_until is null or pro_until > now()))
  );
end;
$$;

comment on function public.admin_overview() is
  'Admin console counters. Admin (aal2) only.';

revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
