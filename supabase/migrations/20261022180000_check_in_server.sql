-- Server-side check-in: presence verified in the database, Grains credited
-- through the ledger, and check-ins no longer readable by everyone.
--
-- Before: check_ins was readable by anyone (user_id + place + time, i.e. a
-- user's movements), inserted directly by the browser with no presence check,
-- and the +10 Grains lived in localStorage.
--
-- Impact ERP / Souley: check_ins is no longer readable by anon / other users.
-- Live crowd per café is served by get_place_vibes() (no user_id).

-- ---------------------------------------------------------------------------
-- 1. check_ins: own rows only, writes through check_in() only
-- ---------------------------------------------------------------------------
drop policy if exists "Check-ins visibles par tous" on public.check_ins;
drop policy if exists "vibes are public" on public.check_ins;
drop policy if exists "Check-in autorisé si connecté" on public.check_ins;
drop policy if exists "users insert own check-in" on public.check_ins;
drop policy if exists "Users read own check-ins" on public.check_ins;

create policy "Users read own check-ins"
  on public.check_ins for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.check_ins from anon, authenticated;

create index if not exists check_ins_place_created_idx
  on public.check_ins (place_id, created_at desc);
create index if not exists check_ins_user_created_idx
  on public.check_ins (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. check_in(): presence + cooldown + daily cap, Grains via the ledger
-- ---------------------------------------------------------------------------
create or replace function public.check_in(
  p_place uuid,
  p_crowd text,
  p_wifi text,
  p_lat double precision,
  p_lng double precision
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Physical presence required to check in (metres).
  c_proximity_m constant integer := 100;
  -- One rewarded check-in per café per window (the vibe can still be updated).
  c_cooldown constant interval := interval '3 hours';
  c_reward constant integer := 10;
  -- Max rewarded check-ins per user per rolling 24 h.
  c_daily_rewards constant integer := 5;

  v_uid uuid := auth.uid();
  v_place public.places%rowtype;
  v_distance double precision;
  v_check_in_id uuid;
  v_reward integer := 0;
  v_reason text := 'ok';
  v_today integer;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_crowd is null or p_crowd not in ('quiet', 'moderate', 'full')
     or p_wifi is null or p_wifi not in ('good', 'slow') then
    return json_build_object('ok', false, 'error', 'invalid_input');
  end if;

  if p_lat is null or p_lng is null
     or not (p_lat between -90 and 90)
     or not (p_lng between -180 and 180) then
    return json_build_object('ok', false, 'error', 'no_gps');
  end if;

  select * into v_place from public.places where id = p_place;
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_place.location is not null then
    v_distance := st_distance(
      v_place.location,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    );
  elsif v_place.lat is not null and v_place.lng is not null then
    v_distance := st_distance(
      st_setsrid(st_makepoint(v_place.lng, v_place.lat), 4326)::geography,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    );
  else
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_distance > c_proximity_m then
    return json_build_object(
      'ok', false, 'error', 'too_far', 'distance_m', round(v_distance)
    );
  end if;

  -- Serialise a user's check-ins so the cooldown and cap cannot be raced.
  perform pg_advisory_xact_lock(hashtext('check_in:' || v_uid::text));

  if exists (
    select 1 from public.check_ins c
    where c.user_id = v_uid
      and c.place_id = p_place
      and c.created_at > now() - c_cooldown
  ) then
    v_reason := 'cooldown';
  else
    select count(*)::integer into v_today
    from public.grains_transactions gt
    where gt.user_id = v_uid
      and gt.reason = 'check_in'
      and gt.created_at > now() - interval '24 hours';

    if v_today >= c_daily_rewards then
      v_reason := 'daily_cap';
    else
      v_reward := c_reward;
    end if;
  end if;

  insert into public.check_ins (user_id, place_id, crowd_level, wifi_speed)
  values (v_uid, p_place, p_crowd, p_wifi)
  returning id into v_check_in_id;

  if v_reward > 0 then
    insert into public.grains_transactions (user_id, amount, reason, ref_id)
    values (v_uid, v_reward, 'check_in', v_check_in_id);

    update public.profiles
    set grains_balance = coalesce(grains_balance, 0) + v_reward
    where id = v_uid;
  end if;

  return json_build_object(
    'ok', true,
    'check_in_id', v_check_in_id,
    'grains_awarded', v_reward,
    'reason', v_reason
  );
end;
$$;

comment on function public.check_in(uuid, text, text, double precision, double precision) is
  'Check-in at a café: within 100 m (server-side distance), +10 Grains once per café per 3 h, max 5 rewarded per 24 h.';

revoke all on function public.check_in(uuid, text, text, double precision, double precision)
  from public, anon;
grant execute on function public.check_in(uuid, text, text, double precision, double precision)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_place_vibes(): live crowd / Wi-Fi per café, without user ids
-- ---------------------------------------------------------------------------
create or replace function public.get_place_vibes(p_place uuid default null)
returns table (
  place_id uuid,
  crowd_level text,
  wifi_speed text,
  contributors integer,
  latest_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  -- Same 3 h window as the check-in cooldown. Most frequent answer wins,
  -- the most recent one breaks ties.
  with recent as (
    select c.place_id, c.user_id, c.crowd_level, c.wifi_speed, c.created_at
    from public.check_ins c
    where c.created_at > now() - interval '3 hours'
      and (p_place is null or c.place_id = p_place)
  ),
  crowd as (
    select r.place_id, r.crowd_level,
      row_number() over (
        partition by r.place_id
        order by count(*) desc, max(r.created_at) desc
      ) as rn
    from recent r
    where r.crowd_level is not null
    group by r.place_id, r.crowd_level
  ),
  wifi as (
    select r.place_id, r.wifi_speed,
      row_number() over (
        partition by r.place_id
        order by count(*) desc, max(r.created_at) desc
      ) as rn
    from recent r
    where r.wifi_speed is not null
    group by r.place_id, r.wifi_speed
  ),
  agg as (
    select r.place_id,
      count(distinct r.user_id)::integer as contributors,
      max(r.created_at) as latest_at
    from recent r
    group by r.place_id
  )
  select a.place_id, c.crowd_level, w.wifi_speed, a.contributors, a.latest_at
  from agg a
  left join crowd c on c.place_id = a.place_id and c.rn = 1
  left join wifi w on w.place_id = a.place_id and w.rn = 1;
$$;

comment on function public.get_place_vibes(uuid) is
  'Live vibe per café (last 3 h of check-ins): crowd, Wi-Fi, distinct contributors. No user ids.';

revoke all on function public.get_place_vibes(uuid) from public;
grant execute on function public.get_place_vibes(uuid) to anon, authenticated;
