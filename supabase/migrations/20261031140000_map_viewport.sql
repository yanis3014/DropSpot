-- Map: load only the cafés of the visible area, and their specificities.
--
-- Until now the map downloaded every café and the specificities of every
-- café at each opening (~1,3 Mo with 1 000 cafés). These two functions let
-- the app ask for one area and for a list of cafés.
--
-- New functions only: nothing changes for the existing ones or for the ERP.

-- MAP_BBOX_MAX_PLACES: most cafés returned for one area (closest to its
-- centre first). The app groups nearby pins into bubbles.
-- MAP_SPECS_MAX_PLACES: most cafés per specificities call.

create or replace function public.places_in_bbox(
  p_min_lng double precision,
  p_min_lat double precision,
  p_max_lng double precision,
  p_max_lat double precision,
  p_limit integer default 500
)
returns table (
  id uuid,
  name text,
  lat double precision,
  lng double precision,
  category text,
  has_plugs boolean,
  laptop_policy text,
  noise_level text,
  wifi_speed text,
  created_at timestamptz
)
language sql
stable
-- Invoker: the places RLS policies apply as for a direct select.
security invoker
set search_path = public, extensions
as $$
  with c as (
    select p.id, p.name,
      coalesce(p.lat, p.latitude::double precision,
               case when p.location is not null then st_y(p.location::geometry) end) as lat,
      coalesce(p.lng, p.longitude::double precision,
               case when p.location is not null then st_x(p.location::geometry) end) as lng,
      p.category, p.has_plugs, p.laptop_policy, p.noise_level, p.wifi_speed, p.created_at
    from public.places p
  )
  select c.id, c.name, c.lat, c.lng, c.category, c.has_plugs, c.laptop_policy,
    c.noise_level, c.wifi_speed, c.created_at
  from c
  where p_min_lng is not null and p_min_lat is not null
    and p_max_lng is not null and p_max_lat is not null
    and c.lat between p_min_lat and p_max_lat
    and c.lng between p_min_lng and p_max_lng
  order by (c.lat - (p_min_lat + p_max_lat) / 2) ^ 2
         + (c.lng - (p_min_lng + p_max_lng) / 2) ^ 2
  limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;

comment on function public.places_in_bbox(double precision, double precision, double precision, double precision, integer) is
  'Map pins of the cafés inside an area (lng/lat box), closest to its centre first, at most 1 000.';

revoke all on function public.places_in_bbox(double precision, double precision, double precision, double precision, integer) from public;
grant execute on function public.places_in_bbox(double precision, double precision, double precision, double precision, integer) to anon, authenticated;

-- Specificities of a list of cafés, from the cache refreshed every 5 min
-- (same columns as get_place_specs).
create or replace function public.get_places_specs(p_place_ids uuid[])
returns table (
  place_id uuid,
  spec text,
  declared boolean,
  yes_votes integer,
  no_votes integer,
  score numeric,
  status text,
  last_vote_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.place_id, c.spec, c.declared, c.yes_votes, c.no_votes, c.score, c.status, c.last_vote_at
  from (
    select distinct u.id
    from unnest(coalesce(p_place_ids, array[]::uuid[])) as u(id)
    where u.id is not null
    limit 1000
  ) ids
  join public.spec_scores_cache c on c.place_id = ids.id;
$$;

comment on function public.get_places_specs(uuid[]) is
  'Specificities of up to 1 000 cafés (cached, up to 5 min old). Public, no user ids.';

revoke all on function public.get_places_specs(uuid[]) from public;
grant execute on function public.get_places_specs(uuid[]) to anon, authenticated;
