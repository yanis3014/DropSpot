-- Optional category column for places (Remote, Specialty, Brunch, Sport, Chill, …).
-- Values are normalized case-insensitively in the app (src/lib/filters.ts).
alter table public.places
  add column if not exists category text;

comment on column public.places.category is
  'Free-text category (e.g. Remote, Specialty, Brunch, Sport, Chill). Matching is case-insensitive in the app.';

-- Helpful indexes if you store lat/lng as plain numeric columns.
-- (Skipped if columns don't exist yet — create them only when needed.)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'places' and column_name = 'lat'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'places' and column_name = 'lng'
  ) then
    create index if not exists places_lat_lng_idx on public.places (lat, lng);
  end if;
end $$;
