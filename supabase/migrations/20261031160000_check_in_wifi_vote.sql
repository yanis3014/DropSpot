-- Map « Wi-Fi » filter: count the Wi-Fi answer of every check-in.
--
-- Since « Le pouls du café » (20261022220000), the Wi-Fi filter shows a café
-- only when its wifi specificity is confirmed, announced by the café, or has
-- more Yes than No (get_place_specs). But the Wi-Fi question every check-in
-- asks (« bon » / « lent ») was only used for the live vibe (last 3 h), never
-- as a vote: after 3 hours the answer was lost, and the filter stayed empty.
--
-- Fix: check_in() also writes the answer into place_spec_votes (spec 'wifi').
-- Same rules as the other votes (one per person and café, on site only since
-- check_in() checks the distance, 3 Yes to confirm). No extra Grains.
--
-- No backfill: the only check-ins with a Wi-Fi answer in production are test
-- check-ins from September.
--
-- Impact ERP / Souley: place_spec_votes gets 'wifi' rows written by check_in()
-- (no Grains ledger row for them). Same function signature and result.

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
  -- Presence at an event the user joined, once per event.
  c_event_reward constant integer := 20;
  -- An event counts from this long before it starts until it ends.
  c_event_early constant interval := interval '30 minutes';

  v_uid uuid := auth.uid();
  v_place public.places%rowtype;
  v_distance double precision;
  v_check_in_id uuid;
  v_reward integer := 0;
  v_reason text := 'ok';
  v_today integer;
  v_event record;
  v_event_reward integer := 0;
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
  end if;

  -- The Wi-Fi answer of the check-in is also this person's Yes / No on the
  -- « Wi-Fi solide » specificity (good = Yes, slow = No). One vote per person
  -- and café, the latest answer wins. No Grains here: the check-in already
  -- pays, and vote_place_spec() then sees the vote as already given.
  insert into public.place_spec_votes (place_id, user_id, spec, vote)
  values (p_place, v_uid, 'wifi', p_wifi = 'good')
  on conflict (place_id, user_id, spec)
  do update set vote = excluded.vote, updated_at = now();

  -- Events at this café the user joined, happening now, not yet rewarded.
  for v_event in
    select fd.id
    from public.flash_drops fd
    join public.drop_participations dp
      on dp.flash_drop_id = fd.id and dp.user_id = v_uid
    where fd.place_id = p_place
      and fd.kind = 'activity'
      and fd.is_active
      and fd.stopped_at is null
      and now() between fd.starts_at - c_event_early and fd.ends_at
      and not exists (
        select 1 from public.grains_transactions gt
        where gt.user_id = v_uid
          and gt.reason = 'event_presence'
          and gt.ref_id = fd.id
      )
  loop
    insert into public.grains_transactions (user_id, amount, reason, ref_id)
    values (v_uid, c_event_reward, 'event_presence', v_event.id);
    v_event_reward := v_event_reward + c_event_reward;
  end loop;

  if v_reward + v_event_reward > 0 then
    update public.profiles
    set grains_balance = coalesce(grains_balance, 0) + v_reward + v_event_reward
    where id = v_uid;
  end if;

  return json_build_object(
    'ok', true,
    'check_in_id', v_check_in_id,
    'grains_awarded', v_reward + v_event_reward,
    'event_grains', v_event_reward,
    'reason', v_reason
  );
end;
$$;

comment on function public.check_in(uuid, text, text, double precision, double precision) is
  'Check-in at a café: within 100 m (server-side distance), +10 Grains once per café per 3 h (max 5 per 24 h), +20 once per joined event happening there. The Wi-Fi answer counts as a vote on the wifi specificity.';

revoke all on function public.check_in(uuid, text, text, double precision, double precision)
  from public, anon;
grant execute on function public.check_in(uuid, text, text, double precision, double precision)
  to authenticated;
