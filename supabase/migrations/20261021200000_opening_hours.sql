-- Structured opening hours (Europe/Paris) + place_open_status RPC.
-- places.opening_hours (text) unchanged for ERP / affichage libre.

-- ---------------------------------------------------------------------------
-- 1) Tables
-- ---------------------------------------------------------------------------
create table if not exists public.place_opening_hours (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  opens time not null,
  closes time not null,
  created_at timestamptz not null default now(),
  check (opens is distinct from closes)
);

create index if not exists place_opening_hours_place_weekday_idx
  on public.place_opening_hours (place_id, weekday, opens);

comment on table public.place_opening_hours is
  'Weekly recurring slots (ISO weekday 1=Mon … 7=Sun). Multiple rows per day allowed.';
comment on column public.place_opening_hours.weekday is 'ISO day of week: 1 Monday … 7 Sunday.';

create table if not exists public.place_special_hours (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  on_date date not null,
  opens time,
  closes time,
  closed boolean not null default false,
  label text,
  created_at timestamptz not null default now(),
  check (
    (closed and opens is null and closes is null)
    or (
      not closed
      and opens is not null
      and closes is not null
      and opens is distinct from closes
    )
  )
);

create index if not exists place_special_hours_place_date_idx
  on public.place_special_hours (place_id, on_date);

comment on table public.place_special_hours is
  'Date-specific overrides. closed=true with null times = closed all day; else one slot.';

-- ---------------------------------------------------------------------------
-- 2) RLS — lecture publique, écriture owner
-- ---------------------------------------------------------------------------
alter table public.place_opening_hours enable row level security;
alter table public.place_special_hours enable row level security;

drop policy if exists "Public read place_opening_hours" on public.place_opening_hours;
create policy "Public read place_opening_hours"
  on public.place_opening_hours for select
  using (true);

drop policy if exists "Owner manage place_opening_hours" on public.place_opening_hours;
create policy "Owner manage place_opening_hours"
  on public.place_opening_hours for all
  using (public.has_place_role(place_id, array['owner']))
  with check (public.has_place_role(place_id, array['owner']));

drop policy if exists "Public read place_special_hours" on public.place_special_hours;
create policy "Public read place_special_hours"
  on public.place_special_hours for select
  using (true);

drop policy if exists "Owner manage place_special_hours" on public.place_special_hours;
create policy "Owner manage place_special_hours"
  on public.place_special_hours for all
  using (public.has_place_role(place_id, array['owner']))
  with check (public.has_place_role(place_id, array['owner']));

grant select on public.place_opening_hours to anon, authenticated;
grant select on public.place_special_hours to anon, authenticated;
grant all on public.place_opening_hours to authenticated;
grant all on public.place_special_hours to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Helpers
-- ---------------------------------------------------------------------------
create or replace function public.format_time_fr(p_t time)
returns text
language sql
immutable
as $$
  select case
    when date_part('minute', p_t)::integer = 0 then
      trim(to_char(p_t, 'FMHH24')) || ' h'
    else
      trim(to_char(p_t, 'FMHH24')) || ' h ' || ltrim(to_char(p_t, 'MI'), '0')
  end;
$$;

create or replace function public.opening_time_in_slot(
  p_opens time,
  p_closes time,
  p_now time
)
returns boolean
language sql
immutable
as $$
  select case
    when p_closes > p_opens then
      p_now >= p_opens and p_now < p_closes
    else
      p_now >= p_opens or p_now < p_closes
  end;
$$;

create or replace function public.opening_minutes_until_close(
  p_opens time,
  p_closes time,
  p_now time
)
returns integer
language plpgsql
immutable
as $$
declare
  v_now_min integer;
  v_close_min integer;
begin
  v_now_min := (date_part('hour', p_now)::integer * 60)
    + date_part('minute', p_now)::integer;
  v_close_min := (date_part('hour', p_closes)::integer * 60)
    + date_part('minute', p_closes)::integer;

  if p_closes > p_opens then
    if p_now >= p_opens and p_now < p_closes then
      return v_close_min - v_now_min;
    end if;
    return null;
  end if;

  if p_now >= p_opens or p_now < p_closes then
    if p_now >= p_opens then
      return (24 * 60 - v_now_min) + v_close_min;
    end if;
    return v_close_min - v_now_min;
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) place_open_status(p_place)
-- ---------------------------------------------------------------------------
create or replace function public.place_open_status(p_place uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c_closing_soon_minutes constant integer := 45;

  v_local timestamp;
  v_date date;
  v_time time;
  v_dow smallint;
  v_has_hours boolean := false;
  v_use_special boolean := false;
  v_all_closed boolean := false;

  v_slot record;
  v_active_opens time;
  v_open boolean := false;
  v_closes time;
  v_mins_until integer;
  v_status text := 'closed';
  v_detail text;
  v_opens_at time;
  v_closes_at time;

  v_probe_date date;
  v_probe_dow smallint;
  v_probe_time time;
  v_days_ahead integer;
  v_best_opens time;
  v_best_date date;
begin
  if p_place is null then
    return json_build_object('ok', false, 'error', 'invalid_place');
  end if;

  if not exists (select 1 from public.places p where p.id = p_place) then
    return json_build_object('ok', false, 'error', 'place_not_found');
  end if;

  v_local := now() at time zone 'Europe/Paris';
  v_date := v_local::date;
  v_time := v_local::time;
  v_dow := extract(isodow from v_local)::smallint;

  select exists (
    select 1 from public.place_opening_hours h where h.place_id = p_place
  )
  or exists (
    select 1 from public.place_special_hours s where s.place_id = p_place
  )
  into v_has_hours;

  if not v_has_hours then
    return json_build_object(
      'ok', true,
      'has_hours', false,
      'is_open', null,
      'status', 'unknown',
      'timezone', 'Europe/Paris'
    );
  end if;

  select exists (
    select 1
    from public.place_special_hours s
    where s.place_id = p_place
      and s.on_date = v_date
  )
  into v_use_special;

  if v_use_special then
    select coalesce(bool_or(s.closed and s.opens is null and s.closes is null), false)
    into v_all_closed
    from public.place_special_hours s
    where s.place_id = p_place
      and s.on_date = v_date;

    if v_all_closed then
      v_open := false;
    else
      for v_slot in
        select s.opens, s.closes
        from public.place_special_hours s
        where s.place_id = p_place
          and s.on_date = v_date
          and not s.closed
          and s.opens is not null
          and s.closes is not null
        order by s.opens
      loop
        if public.opening_time_in_slot(v_slot.opens, v_slot.closes, v_time) then
          v_open := true;
          v_active_opens := v_slot.opens;
          v_closes := v_slot.closes;
          v_closes_at := v_slot.closes;
          exit;
        end if;
      end loop;
    end if;
  else
    for v_slot in
      select h.opens, h.closes
      from public.place_opening_hours h
      where h.place_id = p_place
        and h.weekday = v_dow
      order by h.opens
    loop
      if public.opening_time_in_slot(v_slot.opens, v_slot.closes, v_time) then
        v_open := true;
        v_active_opens := v_slot.opens;
        v_closes := v_slot.closes;
        v_closes_at := v_slot.closes;
        exit;
      end if;
    end loop;
  end if;

  if v_open then
    v_mins_until := public.opening_minutes_until_close(
      v_active_opens,
      v_closes,
      v_time
    );

    if v_mins_until is not null and v_mins_until <= c_closing_soon_minutes then
      v_status := 'closing_soon';
    else
      v_status := 'open';
    end if;

    v_detail := 'ferme à ' || public.format_time_fr(v_closes);

    return json_build_object(
      'ok', true,
      'has_hours', true,
      'is_open', true,
      'status', v_status,
      'closes_at', to_char(v_closes_at, 'HH24:MI'),
      'opens_at', null,
      'detail', v_detail,
      'timezone', 'Europe/Paris'
    );
  end if;

  -- Closed now: find next opening (today then up to 14 days)
  v_best_opens := null;
  v_best_date := null;

  for v_days_ahead in 0..14 loop
    v_probe_date := v_date + v_days_ahead;
    v_probe_dow := extract(isodow from v_probe_date)::smallint;
    v_probe_time := case when v_days_ahead = 0 then v_time else time '00:00' end;

    select exists (
      select 1
      from public.place_special_hours s
      where s.place_id = p_place
        and s.on_date = v_probe_date
    )
    into v_use_special;

    if v_use_special then
      select coalesce(bool_or(s.closed and s.opens is null and s.closes is null), false)
      into v_all_closed
      from public.place_special_hours s
      where s.place_id = p_place
        and s.on_date = v_probe_date;

      if v_all_closed then
        continue;
      end if;

      select s.opens
      into v_best_opens
      from public.place_special_hours s
      where s.place_id = p_place
        and s.on_date = v_probe_date
        and not s.closed
        and s.opens is not null
        and (
          v_days_ahead > 0
          or s.opens > v_probe_time
        )
      order by s.opens
      limit 1;

      if found then
        v_best_date := v_probe_date;
        exit;
      end if;
    else
      select h.opens
      into v_best_opens
      from public.place_opening_hours h
      where h.place_id = p_place
        and h.weekday = v_probe_dow
        and (
          v_days_ahead > 0
          or h.opens > v_probe_time
        )
      order by h.opens
      limit 1;

      if found then
        v_best_date := v_probe_date;
        exit;
      end if;
    end if;
  end loop;

  if v_best_opens is not null then
    v_opens_at := v_best_opens;
    if v_best_date = v_date then
      v_detail := 'ouvre à ' || public.format_time_fr(v_best_opens);
    elsif v_best_date = v_date + 1 then
      v_detail := 'ouvre demain à ' || public.format_time_fr(v_best_opens);
    else
      v_detail := 'ouvre le '
        || to_char(v_best_date, 'DD/MM')
        || ' à '
        || public.format_time_fr(v_best_opens);
    end if;
  else
    v_detail := null;
  end if;

  return json_build_object(
    'ok', true,
    'has_hours', true,
    'is_open', false,
    'status', 'closed',
    'closes_at', null,
    'opens_at', case when v_opens_at is null then null else to_char(v_opens_at, 'HH24:MI') end,
    'detail', v_detail,
    'timezone', 'Europe/Paris'
  );
end;
$$;

revoke all on function public.place_open_status(uuid) from public;
grant execute on function public.place_open_status(uuid) to anon, authenticated;

create or replace function public.places_open_status(p_place_ids uuid[])
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    json_object_agg(t.id::text, public.place_open_status(t.id)),
    '{}'::json
  )
  from (
    select distinct u.id
    from unnest(coalesce(p_place_ids, array[]::uuid[])) as u(id)
    where u.id is not null
    limit 500
  ) t;
$$;

revoke all on function public.places_open_status(uuid[]) from public;
grant execute on function public.places_open_status(uuid[]) to anon, authenticated;

comment on function public.place_open_status(uuid) is
  'Open/closed now in Europe/Paris with detail ("ferme à 19 h", "ouvre à 9 h").';
