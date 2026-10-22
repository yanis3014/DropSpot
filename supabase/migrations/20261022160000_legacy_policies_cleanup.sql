-- Drop hand-made Supabase dashboard policies superseded by repo migrations
-- (place_members / vendor_plans). Idempotent: drop policy if exists.

-- places (legacy vendor_id-only CRUD from the dashboard)
drop policy if exists "Vendors can delete own places" on public.places;
drop policy if exists "Vendors can update own places" on public.places;
drop policy if exists "Vendors can view own places" on public.places;

-- flash_drops (legacy vendor_id-only CRUD from the dashboard; names use flash_drops)
drop policy if exists "Vendors can insert own flash_drops" on public.flash_drops;
drop policy if exists "Vendors can update own flash_drops" on public.flash_drops;
drop policy if exists "Vendors can delete own flash_drops" on public.flash_drops;
drop policy if exists "Vendors can view own flash_drops" on public.flash_drops;
