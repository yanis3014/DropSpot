-- Rankings per specificity (« Top de Nice », real rank on the café page) and
-- a purpose for Grains:
--   * Grains scale (server constants): presence 10, Yes/No vote 5 (daily cap),
--     presence at an event you joined 20, suggested café that joins 50.
--     A used promo code no longer earns Grains (it moved to event presence).
--   * Status from Grains earned over time (lifetime, never lost by spending):
--     from « Explorateur » (100 earned), 20 % of the places of a limited drop
--     are reserved, until the day before an event / 30 min after an offer starts.
--
-- Impact ERP / Souley: new ledger reasons 'event_presence' and
-- 'place_suggested'; redeem_drop_code() no longer writes a 'flash_drop' row;
-- claim_drop() refuses once all places are claimed ('sold_out') and may
-- answer 'priority_only'. New public readers get_spec_rankings() and
-- get_place_ranks().

-- ---------------------------------------------------------------------------
-- 1. Ledger reasons
-- ---------------------------------------------------------------------------
alter table public.grains_transactions
  drop constraint if exists grains_transactions_reason_check;
alter table public.grains_transactions
  add constraint grains_transactions_reason_check
  check (reason = any (array['welcome', 'check_in', 'flash_drop', 'endorsement',
                             'adjustment', 'spec_vote', 'event_presence',
                             'place_suggested']));

create index if not exists grains_transactions_ref_idx
  on public.grains_transactions (reason, ref_id);

-- ---------------------------------------------------------------------------
-- 2. Lifetime Grains and priority status
-- ---------------------------------------------------------------------------
create or replace function public.grains_lifetime(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::integer
  from public.grains_transactions
  where user_id = p_user and amount > 0;
$$;

comment on function public.grains_lifetime(uuid) is
  'Grains earned over time (positive ledger rows). Levels and priority use it, not the balance.';

revoke all on function public.grains_lifetime(uuid) from public, anon, authenticated;

-- Must stay in sync with PRIORITY_* constants in src/lib/grains.ts.
create or replace function public.drop_reserved_places(p_capacity integer)
returns integer
language sql
immutable
set search_path = public
as $$
  -- 20 % of the places (rounded up), only for drops of 5 places or more.
  select case
    when p_capacity is null or p_capacity < 5 then 0
    else ceil(p_capacity * 0.2)::integer
  end;
$$;

create or replace function public.is_priority_member(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and public.grains_lifetime(p_user) >= 100;
$$;

revoke all on function public.is_priority_member(uuid) from public, anon, authenticated;

create or replace function public.my_grains()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'balance', coalesce((select grains_balance from public.profiles where id = auth.uid()), 0),
    'lifetime', public.grains_lifetime(auth.uid()),
    'priority', public.is_priority_member(auth.uid())
  )
  where auth.uid() is not null;
$$;

revoke all on function public.my_grains() from public, anon;
grant execute on function public.my_grains() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. join_drop: reserved places for priority members
-- ---------------------------------------------------------------------------
create or replace function public.join_drop(p_drop uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Reserved places open to everyone this long before the event starts.
  c_reserved_until_before_start constant interval := interval '24 hours';

  v_uid uuid := auth.uid();
  v_drop public.flash_drops%rowtype;
  v_count integer;
  v_reserved integer;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  -- Lock the drop so two last-place joins cannot both succeed.
  select * into v_drop from public.flash_drops where id = p_drop for update;
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_drop.kind is distinct from 'activity' then
    return json_build_object('ok', false, 'error', 'not_event');
  end if;
  if not v_drop.is_active or v_drop.stopped_at is not null or v_drop.ends_at <= now() then
    return json_build_object('ok', false, 'error', 'ended');
  end if;

  select count(*)::integer into v_count
  from public.drop_participations where flash_drop_id = p_drop;

  if exists (
    select 1 from public.drop_participations
    where flash_drop_id = p_drop and user_id = v_uid
  ) then
    return json_build_object(
      'ok', true, 'joined', true, 'participants', v_count, 'capacity', v_drop.max_uses
    );
  end if;

  if v_drop.max_uses is not null and v_count >= v_drop.max_uses then
    return json_build_object(
      'ok', false, 'error', 'full', 'participants', v_count, 'capacity', v_drop.max_uses
    );
  end if;

  v_reserved := public.drop_reserved_places(v_drop.max_uses);
  if v_reserved > 0
     and v_count >= v_drop.max_uses - v_reserved
     and now() < v_drop.starts_at - c_reserved_until_before_start
     and not public.is_priority_member(v_uid) then
    return json_build_object(
      'ok', false, 'error', 'priority_only', 'participants', v_count,
      'capacity', v_drop.max_uses
    );
  end if;

  insert into public.drop_participations (flash_drop_id, user_id)
  values (p_drop, v_uid);

  return json_build_object(
    'ok', true, 'joined', true, 'participants', v_count + 1, 'capacity', v_drop.max_uses
  );
end;
$$;

revoke all on function public.join_drop(uuid) from public, anon;
grant execute on function public.join_drop(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. claim_drop: no more codes than places, reserved places
-- ---------------------------------------------------------------------------
create or replace function public.claim_drop(p_drop uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Reserved places open to everyone this long after the offer starts.
  c_reserved_until_after_start constant interval := interval '30 minutes';

  v_uid uuid := auth.uid();
  v_drop public.flash_drops%rowtype;
  v_place_status text;
  v_existing public.drop_codes%rowtype;
  v_code char(6);
  v_row public.drop_codes%rowtype;
  v_claimed integer;
  v_reserved integer;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select fd.* into v_drop
  from public.flash_drops fd
  where fd.id = p_drop
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'drop_not_found');
  end if;

  select p.verification_status into v_place_status
  from public.places p
  where p.id = v_drop.place_id;

  if v_place_status is distinct from 'verified' then
    return json_build_object('ok', false, 'error', 'place_not_verified');
  end if;

  if not public.flash_drop_is_live(v_drop) then
    return json_build_object('ok', false, 'error', 'drop_not_live');
  end if;

  select * into v_existing
  from public.drop_codes dc
  where dc.flash_drop_id = p_drop
    and dc.user_id = v_uid
    and dc.status in ('issued', 'redeemed');

  if found then
    return json_build_object(
      'ok', true,
      'drop_code_id', v_existing.id,
      'code', v_existing.code,
      'code_display', public.format_drop_code(v_existing.code),
      'status', v_existing.status,
      'flash_drop_id', p_drop
    );
  end if;

  if v_drop.max_uses is not null then
    select count(*)::integer into v_claimed
    from public.drop_codes dc
    where dc.flash_drop_id = p_drop and dc.status in ('issued', 'redeemed');

    if v_claimed >= v_drop.max_uses then
      return json_build_object('ok', false, 'error', 'sold_out');
    end if;

    v_reserved := public.drop_reserved_places(v_drop.max_uses);
    if v_reserved > 0
       and v_claimed >= v_drop.max_uses - v_reserved
       and now() < v_drop.starts_at + c_reserved_until_after_start
       and not public.is_priority_member(v_uid) then
      return json_build_object('ok', false, 'error', 'priority_only');
    end if;
  end if;

  v_code := public.generate_drop_code_value();

  insert into public.drop_codes (flash_drop_id, user_id, code, status)
  values (p_drop, v_uid, v_code, 'issued')
  returning * into v_row;

  return json_build_object(
    'ok', true,
    'drop_code_id', v_row.id,
    'code', v_row.code,
    'code_display', public.format_drop_code(v_row.code),
    'status', v_row.status,
    'flash_drop_id', p_drop
  );
end;
$$;

revoke all on function public.claim_drop(uuid) from public, anon;
grant execute on function public.claim_drop(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. redeem_drop_code / cancel_redemption: no Grains for a used promo code
-- ---------------------------------------------------------------------------
create or replace function public.redeem_drop_code(
  p_place uuid,
  p_code text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_norm char(6);
  v_dc public.drop_codes%rowtype;
  v_drop public.flash_drops%rowtype;
  v_prev_name text;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'status', 'not_authenticated');
  end if;

  if not public.has_place_role(p_place, array['owner', 'manager', 'staff']) then
    return json_build_object('ok', false, 'status', 'not_found');
  end if;

  v_norm := public.normalize_drop_code_input(p_code);
  if v_norm is null then
    return json_build_object('ok', false, 'status', 'not_found');
  end if;

  select dc.* into v_dc
  from public.drop_codes dc
  join public.flash_drops fd on fd.id = dc.flash_drop_id
  where dc.code = v_norm
    and fd.place_id = p_place
  for update of dc;

  if not found then
    return json_build_object('ok', false, 'status', 'not_found');
  end if;

  if v_dc.user_id = v_actor then
    return json_build_object('ok', false, 'status', 'not_found');
  end if;

  select fd.* into v_drop
  from public.flash_drops fd
  where fd.id = v_dc.flash_drop_id
  for update;

  if v_dc.status = 'redeemed' then
    select coalesce(pr.full_name, split_part(u.email, '@', 1))
    into v_prev_name
    from auth.users u
    left join public.profiles pr on pr.id = u.id
    where u.id = v_dc.redeemed_by;

    return json_build_object(
      'ok', false,
      'status', 'already_used',
      'redeemed_at', v_dc.redeemed_at,
      'redeemed_by_name', v_prev_name
    );
  end if;

  if v_dc.status = 'cancelled' then
    return json_build_object('ok', false, 'status', 'not_found');
  end if;

  if v_drop.stopped_at is not null or not public.flash_drop_is_live(v_drop) then
    return json_build_object('ok', false, 'status', 'ended');
  end if;

  if v_drop.max_uses is not null and v_drop.current_uses >= v_drop.max_uses then
    return json_build_object('ok', false, 'status', 'sold_out');
  end if;

  update public.drop_codes
  set
    status = 'redeemed',
    redeemed_at = now(),
    redeemed_by = v_actor
  where id = v_dc.id;

  update public.flash_drops
  set
    current_uses = current_uses + 1,
    updated_at = now()
  where id = v_drop.id;

  return json_build_object(
    'ok', true,
    'status', 'ok',
    'drop_code_id', v_dc.id,
    'flash_drop_id', v_drop.id,
    'title', v_drop.title,
    'grains_awarded', 0,
    'code_display', public.format_drop_code(v_dc.code)
  );
end;
$$;

revoke all on function public.redeem_drop_code(uuid, text) from public, anon;
grant execute on function public.redeem_drop_code(uuid, text) to authenticated;

create or replace function public.cancel_redemption(
  p_place uuid,
  p_code text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_norm char(6);
  v_dc public.drop_codes%rowtype;
  v_drop public.flash_drops%rowtype;
  v_reward integer;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if not public.has_place_role(p_place, array['owner', 'manager', 'staff']) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_norm := public.normalize_drop_code_input(p_code);
  if v_norm is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select dc.* into v_dc
  from public.drop_codes dc
  join public.flash_drops fd on fd.id = dc.flash_drop_id
  where dc.code = v_norm
    and fd.place_id = p_place
    and dc.status = 'redeemed'
  for update of dc;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_dc.redeemed_at is null or v_dc.redeemed_at < now() - interval '15 minutes' then
    return json_build_object('ok', false, 'error', 'window_expired');
  end if;

  if v_dc.redeemed_by is distinct from v_actor
     and not public.has_place_role(p_place, array['owner', 'manager']) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_drop
  from public.flash_drops fd
  where fd.id = v_dc.flash_drop_id
  for update;

  -- Only reverse Grains that were actually credited (codes used before this
  -- migration); net of any earlier reversal.
  select coalesce(sum(gt.amount), 0)::integer into v_reward
  from public.grains_transactions gt
  where gt.ref_id = v_dc.id
    and gt.reason = 'flash_drop';

  update public.drop_codes
  set
    status = 'issued',
    redeemed_at = null,
    redeemed_by = null
  where id = v_dc.id;

  update public.flash_drops
  set
    current_uses = greatest(0, current_uses - 1),
    updated_at = now()
  where id = v_drop.id;

  if v_reward > 0 then
    insert into public.grains_transactions (user_id, amount, reason, ref_id)
    values (v_dc.user_id, -v_reward, 'flash_drop', v_dc.id);

    update public.profiles
    set grains_balance = greatest(0, coalesce(grains_balance, 0) - v_reward)
    where id = v_dc.user_id;
  end if;

  return json_build_object(
    'ok', true, 'drop_code_id', v_dc.id, 'grains_reversed', greatest(v_reward, 0)
  );
end;
$$;

revoke all on function public.cancel_redemption(uuid, text) from public, anon;
grant execute on function public.cancel_redemption(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. check_in: + presence at an event you joined
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
  'Check-in at a café: within 100 m (server-side distance), +10 Grains once per café per 3 h (max 5 per 24 h), +20 once per joined event happening there.';

revoke all on function public.check_in(uuid, text, text, double precision, double precision)
  from public, anon;
grant execute on function public.check_in(uuid, text, text, double precision, double precision)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Suggested café that joins Dropspot: +50 to the person who suggested it
-- ---------------------------------------------------------------------------
create or replace function public.reward_place_suggestion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_reward constant integer := 50;
begin
  if new.verification_status = 'verified'
     and old.verification_status is distinct from 'verified'
     and new.suggested_by is not null
     and not exists (
       select 1 from public.grains_transactions gt
       where gt.reason = 'place_suggested' and gt.ref_id = new.id
     ) then
    insert into public.grains_transactions (user_id, amount, reason, ref_id)
    values (new.suggested_by, c_reward, 'place_suggested', new.id);

    update public.profiles
    set grains_balance = coalesce(grains_balance, 0) + c_reward
    where id = new.suggested_by;
  end if;
  return new;
end;
$$;

revoke all on function public.reward_place_suggestion() from public, anon, authenticated;

drop trigger if exists places_reward_suggestion on public.places;
create trigger places_reward_suggestion
  after update of verification_status on public.places
  for each row execute function public.reward_place_suggestion();

-- ---------------------------------------------------------------------------
-- 8. Scores at a date, rankings and ranks
-- ---------------------------------------------------------------------------
-- Same rules as get_place_specs(), at any date (votes changed after p_at are
-- left out, so last week's ranking is an approximation).
create or replace function public.spec_scores_at(p_at timestamptz, p_place uuid default null)
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
  with v as (
    select sv.place_id, sv.spec,
      count(*) filter (where sv.vote)::integer as yes_votes,
      count(*) filter (where not sv.vote)::integer as no_votes,
      coalesce(sum(case when sv.updated_at > p_at - interval '30 days' then 1.0 else 0.5 end)
        filter (where sv.vote), 0) as yes_w,
      coalesce(sum(case when sv.updated_at > p_at - interval '30 days' then 1.0 else 0.5 end)
        filter (where not sv.vote), 0) as no_w,
      max(sv.updated_at) as last_vote_at
    from public.place_spec_votes sv
    where sv.updated_at > p_at - interval '180 days'
      and sv.updated_at <= p_at
      and (p_place is null or sv.place_id = p_place)
    group by sv.place_id, sv.spec
  ),
  d as (
    select pd.place_id, pd.spec, pd.value
    from public.place_spec_declarations pd
    where pd.updated_at <= p_at
      and (p_place is null or pd.place_id = p_place)
  ),
  merged as (
    select coalesce(v.place_id, d.place_id) as place_id,
      coalesce(v.spec, d.spec) as spec,
      d.value as declared_value,
      coalesce(v.yes_votes, 0) as yes_votes,
      coalesce(v.no_votes, 0) as no_votes,
      coalesce(v.yes_w, 0) as yes_w,
      coalesce(v.no_w, 0) as no_w,
      v.last_vote_at
    from v
    full join d on d.place_id = v.place_id and d.spec = v.spec
  )
  select m.place_id, m.spec,
    coalesce(m.declared_value, false) as declared,
    m.yes_votes, m.no_votes,
    round(m.yes_w - m.no_w + case when m.declared_value then 1 else 0 end, 2) as score,
    case
      when m.yes_votes >= 3 and m.yes_w >= 2 * m.no_w then 'confirmed'
      when m.no_votes >= 2 and m.no_w >= m.yes_w then 'disputed'
      when m.declared_value is true then 'declared'
      when m.declared_value is false then 'absent'
      else 'pending'
    end as status,
    m.last_vote_at
  from merged m;
$$;

revoke all on function public.spec_scores_at(timestamptz, uuid) from public, anon, authenticated;

create or replace function public.get_place_specs(p_place uuid default null)
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
  select * from public.spec_scores_at(now(), p_place);
$$;

revoke all on function public.get_place_specs(uuid) from public;
grant execute on function public.get_place_specs(uuid) to anon, authenticated;

-- Ranked cafés per spec at a date. Eligible: confirmed, announced, or more
-- Yes than No. For « events », each event the café held or holds within 30
-- days adds 1 to the score (and makes it eligible).
create or replace function public.spec_ranks_at(p_at timestamptz)
returns table (
  place_id uuid,
  spec text,
  score numeric,
  yes_votes integer,
  rank integer
)
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select place_id, spec, score, yes_votes, no_votes, status
    from public.spec_scores_at(p_at, null)
  ),
  ev as (
    select fd.place_id, count(*)::integer as events
    from public.flash_drops fd
    where fd.kind = 'activity'
      and fd.stopped_at is null
      and fd.created_at <= p_at
      and fd.starts_at between p_at - interval '30 days' and p_at + interval '30 days'
    group by fd.place_id
  ),
  eligible as (
    select s.place_id, s.spec,
      s.score + case when s.spec = 'events' then coalesce(ev.events, 0) else 0 end as score,
      s.yes_votes
    from s
    left join ev on ev.place_id = s.place_id
    where s.status in ('confirmed', 'declared')
       or (s.status = 'pending' and s.yes_votes > s.no_votes)
    union all
    -- Cafés with events but no « events » specificity yet.
    select ev.place_id, 'events', ev.events::numeric, 0
    from ev
    where not exists (
      select 1 from s where s.place_id = ev.place_id and s.spec = 'events'
    )
  )
  select e.place_id, e.spec, e.score, e.yes_votes,
    rank() over (partition by e.spec order by e.score desc, e.yes_votes desc)::integer
  from eligible e
  join public.places p on p.id = e.place_id
  where e.score > 0;
$$;

revoke all on function public.spec_ranks_at(timestamptz) from public, anon, authenticated;

create or replace function public.get_spec_rankings(p_spec text, p_limit integer default 10)
returns table (
  place_id uuid,
  name text,
  image_url text,
  city text,
  score numeric,
  yes_votes integer,
  rank integer,
  previous_rank integer
)
language sql
stable
security definer
set search_path = public
as $$
  with now_r as (
    select * from public.spec_ranks_at(now()) where spec = p_spec
  ),
  week_r as (
    select * from public.spec_ranks_at(now() - interval '7 days') where spec = p_spec
  )
  select n.place_id, p.name, p.image_url, p.city, n.score, n.yes_votes, n.rank, w.rank
  from now_r n
  join public.places p on p.id = n.place_id
  left join week_r w on w.place_id = n.place_id
  order by n.rank, p.name
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

comment on function public.get_spec_rankings(text, integer) is
  '« Top de Nice » for one specificity, with last week''s rank. Public, no user ids.';

revoke all on function public.get_spec_rankings(text, integer) from public;
grant execute on function public.get_spec_rankings(text, integer) to anon, authenticated;

create or replace function public.get_place_ranks(p_place uuid)
returns table (spec text, rank integer, total integer)
language sql
stable
security definer
set search_path = public
as $$
  with r as (select * from public.spec_ranks_at(now()))
  select r.spec, r.rank,
    (select count(*)::integer from r r2 where r2.spec = r.spec) as total
  from r
  where r.place_id = p_place;
$$;

comment on function public.get_place_ranks(uuid) is
  'Rank of one café for each specificity (« 2e pour le Wi-Fi »). Public, no user ids.';

revoke all on function public.get_place_ranks(uuid) from public;
grant execute on function public.get_place_ranks(uuid) to anon, authenticated;
