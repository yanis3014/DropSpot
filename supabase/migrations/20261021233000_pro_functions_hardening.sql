-- Same rules as 20261021090000_security_advisor_warnings.sql, applied to the
-- functions added by the pro migrations of 2026-10-21.
-- Supabase grants EXECUTE on new functions to anon explicitly (default
-- privileges), so "revoke ... from public" alone is not enough.

-- ---------------------------------------------------------------------------
-- 1. SECURITY DEFINER RPCs: signed-in users only (lint 0028)
-- ---------------------------------------------------------------------------
revoke execute on function public.has_place_role(uuid, text[]) from public, anon;
revoke execute on function public.invite_member(uuid, text, text) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.request_claim(uuid, text, text, text) from public, anon;
revoke execute on function public.cancel_claim(uuid) from public, anon;
revoke execute on function public.approve_claim(uuid, text) from public, anon;
revoke execute on function public.reject_claim(uuid, text) from public, anon;
revoke execute on function public.claim_drop(uuid) from public, anon;
revoke execute on function public.redeem_drop_code(uuid, text) from public, anon;
revoke execute on function public.cancel_redemption(uuid, text) from public, anon;
revoke execute on function public.stop_drop(uuid) from public, anon;
revoke execute on function public.add_drop_places(uuid, integer) from public, anon;
revoke execute on function public.vendor_today_stats(uuid) from public, anon;
revoke execute on function public.has_pro(uuid) from public, anon;
revoke execute on function public.my_vendor_plan() from public, anon;
revoke execute on function public.admin_set_vendor_plan(uuid, text, timestamptz) from public, anon;
revoke execute on function public.place_vendor_id(uuid) from public, anon;

grant execute on function public.has_place_role(uuid, text[]) to authenticated;
grant execute on function public.invite_member(uuid, text, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.request_claim(uuid, text, text, text) to authenticated;
grant execute on function public.cancel_claim(uuid) to authenticated;
grant execute on function public.approve_claim(uuid, text) to authenticated;
grant execute on function public.reject_claim(uuid, text) to authenticated;
grant execute on function public.claim_drop(uuid) to authenticated;
grant execute on function public.redeem_drop_code(uuid, text) to authenticated;
grant execute on function public.cancel_redemption(uuid, text) to authenticated;
grant execute on function public.stop_drop(uuid) to authenticated;
grant execute on function public.add_drop_places(uuid, integer) to authenticated;
grant execute on function public.vendor_today_stats(uuid) to authenticated;
grant execute on function public.has_pro(uuid) to authenticated;
grant execute on function public.my_vendor_plan() to authenticated;
grant execute on function public.admin_set_vendor_plan(uuid, text, timestamptz) to authenticated;
grant execute on function public.place_vendor_id(uuid) to authenticated;

-- Opening hours are shown on the public map: anon keeps these two.
-- place_open_status(uuid), places_open_status(uuid[])

-- Trigger functions: nobody calls them through the API.
revoke execute on function public.sync_place_vendor_from_owners() from public, anon, authenticated;
revoke execute on function public.sync_place_owner_from_vendor() from public, anon, authenticated;
revoke execute on function public.enforce_flash_drop_pro() from public, anon, authenticated;
revoke execute on function public.enforce_place_media_pro() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Pin search_path on helper functions (lint 0011)
-- ---------------------------------------------------------------------------
alter function public.format_drop_code(char) set search_path = public;
alter function public.normalize_drop_code_input(text) set search_path = public;
alter function public.flash_drop_is_live(public.flash_drops) set search_path = public;
alter function public.paris_day_bounds(timestamptz) set search_path = public;
alter function public.format_time_fr(time) set search_path = public;
alter function public.opening_time_in_slot(time, time, time) set search_path = public;
alter function public.opening_minutes_until_close(time, time, time) set search_path = public;
