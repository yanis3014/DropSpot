-- Address Supabase Security Advisor warnings (2026-10-21).
-- Does NOT touch public.spatial_ref_sys (owned by supabase_admin, cannot be
-- altered or revoked from the postgres role) nor the logic of any function.

-- ---------------------------------------------------------------------------
-- 1. Pin search_path on trigger functions (lint 0011)
-- ---------------------------------------------------------------------------
alter function public.set_updated_at() set search_path = public;
alter function public.protect_profile_columns() set search_path = public;

-- ---------------------------------------------------------------------------
-- 2. SECURITY DEFINER functions: no execution without signing in (lint 0028)
-- Functions get EXECUTE for PUBLIC by default, so revoke from PUBLIC too.
-- ---------------------------------------------------------------------------
revoke execute on function public.claim_welcome_grains() from public, anon;
revoke execute on function public.validate_flash_drop_code(text, uuid) from public, anon;
revoke execute on function public.vendor_today_stats() from public, anon;

grant execute on function public.claim_welcome_grains() to authenticated;
grant execute on function public.validate_flash_drop_code(text, uuid) to authenticated;
grant execute on function public.vendor_today_stats() to authenticated;

-- handle_new_user is only a trigger on auth.users: nobody calls it via the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. place-photos: stop anyone from listing the bucket (lint 0025)
-- The bucket stays public, so getPublicUrl links keep working without a
-- SELECT policy. Vendors still need SELECT on their own files for remove().
-- ---------------------------------------------------------------------------
drop policy if exists "Public read place photos" on storage.objects;

drop policy if exists "Vendors read own place photos" on storage.objects;
create policy "Vendors read own place photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'place-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
