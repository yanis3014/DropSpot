-- Align flash_drops with the table that exists in production.
-- In prod the table was created from the dashboard before
-- 20261012170000_flash_drops.sql, with two extra NOT NULL columns
-- (discount_type, discount_value) that the app never sends, so every insert
-- from /dashboard-pro failed. Drops now describe their offer with kind /
-- discount_value / discount_unit (20261021180000_drop_codes.sql); the legacy
-- discount_type column is kept (nullable) for the ERP.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'flash_drops'
      and column_name = 'discount_type' and is_nullable = 'NO'
  ) then
    alter table public.flash_drops alter column discount_type drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'flash_drops'
      and column_name = 'discount_value' and is_nullable = 'NO'
  ) then
    alter table public.flash_drops alter column discount_value drop not null;
  end if;
end $$;
