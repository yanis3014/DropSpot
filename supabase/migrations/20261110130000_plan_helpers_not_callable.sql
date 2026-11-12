-- Security audit of 2026-11-10: plan helpers are internal.
--
-- IMPACT ERP: apply only once the ERP is confirmed not to call these four
-- functions through the API with a user session (service_role is unaffected).
--
-- Any signed-in user could call them with someone else's id and learn which
-- paid plan a café owner has, and who owns a café. The app never calls them
-- from the browser: they are only used inside other SECURITY DEFINER functions
-- (place_has_feature, my_vendor_plan, place_plan, enforce_flash_drop_pro…),
-- which keep working because they run with the owner's rights.
--
-- Left callable on purpose: has_place_role and place_has_feature (used by RLS
-- policies), is_pro, my_vendor_plan and place_plan (called by the app).

revoke all on function public.place_vendor_id(uuid) from public, anon, authenticated;
revoke all on function public.vendor_effective_plan(uuid) from public, anon, authenticated;
revoke all on function public.has_pro(uuid) from public, anon, authenticated;
revoke all on function public.vendor_has_feature(uuid, text) from public, anon, authenticated;
