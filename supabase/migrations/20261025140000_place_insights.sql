-- Place insights: Pro-only aggregates for the /statistiques screen.
--
-- Impact ERP / Souley: new function pro_place_insights (same admin access as
-- pro_place_summary). Definitions to validate with Souley: passage = one
-- check-in; returning visitor = 2+ distinct Paris check-in days in the
-- window; view = one per person, café and day. No existing columns modified.

create or replace function public.pro_place_insights(
  p_place uuid,
  p_days int default 30
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  -- RETURNING_MIN_VISITS: min distinct Paris check-in days to count as a regular.
  c_returning_min_visits constant integer := 2;
  -- MIN_AUDIENCE_SIZE: below this, audience is null so nobody can be re-identified.
  c_min_audience_size constant integer := 5;

  v_until timestamptz := now();
  v_from timestamptz;
  v_prev_until timestamptz;
  v_current json;
  v_previous json;
  v_by_hour integer[];
  v_by_weekday integer[];
  v_returning_share numeric;
  v_crowd json;
  v_wifi json;
  v_drops json;
  v_audience json;
  v_team json;
  v_visitor_count integer;
begin
  if not (
    public.has_place_role(p_place, array['owner', 'manager'])
    or public.is_admin()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_days is null or p_days not in (7, 30, 90) then
    raise exception 'invalid_period';
  end if;

  if not public.has_pro(public.place_vendor_id(p_place))
     and not public.is_admin() then
    raise exception 'pro_required';
  end if;

  v_from := v_until - make_interval(days => p_days);
  v_prev_until := v_from;

  v_current := public.pro_place_summary(p_place, p_days, v_until);
  v_previous := public.pro_place_summary(p_place, p_days, v_prev_until);

  select array(
    select coalesce((
      select count(*)::integer
      from public.check_ins c
      where c.place_id = p_place
        and c.created_at > v_from
        and c.created_at <= v_until
        and extract(hour from (c.created_at at time zone 'Europe/Paris'))::integer = h
    ), 0)
    from generate_series(0, 23) as h
  ) into v_by_hour;

  -- isodow: 1 = Monday … 7 = Sunday (Monday first).
  select array(
    select coalesce((
      select count(*)::integer
      from public.check_ins c
      where c.place_id = p_place
        and c.created_at > v_from
        and c.created_at <= v_until
        and extract(isodow from (c.created_at at time zone 'Europe/Paris'))::integer = d
    ), 0)
    from generate_series(1, 7) as d
  ) into v_by_weekday;

  select count(distinct c.user_id)::integer into v_visitor_count
  from public.check_ins c
  where c.place_id = p_place
    and c.created_at > v_from
    and c.created_at <= v_until;

  if v_visitor_count = 0 then
    v_returning_share := null;
  else
    select (
      count(*) filter (where days_visited >= c_returning_min_visits)
    )::numeric / count(*)::numeric
    into v_returning_share
    from (
      select c.user_id,
        count(distinct (c.created_at at time zone 'Europe/Paris')::date)::integer as days_visited
      from public.check_ins c
      where c.place_id = p_place
        and c.created_at > v_from
        and c.created_at <= v_until
      group by c.user_id
    ) v;
  end if;

  select coalesce(
    (select json_object_agg(crowd_level, cnt)
     from (
       select c.crowd_level, count(*)::integer as cnt
       from public.check_ins c
       where c.place_id = p_place
         and c.created_at > v_from
         and c.created_at <= v_until
         and c.crowd_level is not null
       group by c.crowd_level
     ) s),
    '{}'::json
  ) into v_crowd;

  select coalesce(
    (select json_object_agg(wifi_speed, cnt)
     from (
       select c.wifi_speed, count(*)::integer as cnt
       from public.check_ins c
       where c.place_id = p_place
         and c.created_at > v_from
         and c.created_at <= v_until
         and c.wifi_speed is not null
       group by c.wifi_speed
     ) s),
    '{}'::json
  ) into v_wifi;

  select coalesce(json_agg(row_to_json(d) order by d.starts_at desc), '[]'::json)
  into v_drops
  from (
    select
      fd.id,
      fd.title,
      fd.kind,
      fd.starts_at,
      fd.ends_at,
      (select count(*)::integer from public.drop_codes dc where dc.flash_drop_id = fd.id) as codes_issued,
      (select count(*)::integer from public.drop_codes dc
        where dc.flash_drop_id = fd.id and dc.status = 'redeemed') as codes_redeemed,
      (select count(*)::integer from public.drop_participations dp
        where dp.flash_drop_id = fd.id) as participants,
      (select count(*)::integer
        from public.drop_participations dp
        where dp.flash_drop_id = fd.id
          and exists (
            select 1 from public.check_ins c
            where c.user_id = dp.user_id
              and c.place_id = p_place
              and c.created_at >= fd.starts_at
              and c.created_at <= fd.ends_at
          )) as present
    from public.flash_drops fd
    where fd.place_id = p_place
      and fd.starts_at < v_until
      and fd.ends_at > v_from
  ) d;

  if v_visitor_count < c_min_audience_size then
    v_audience := null;
  else
    select coalesce(json_object_agg(envie, share), '{}'::json)
    into v_audience
    from (
      select e.envie,
        (count(distinct vis.user_id)::numeric / v_visitor_count::numeric) as share
      from (
        select unnest(array[
          'work', 'chill', 'friends', 'brunch', 'specialty',
          'matcha', 'terrace', 'sport', 'events'
        ]::text[]) as envie
      ) e
      left join (
        select distinct c.user_id
        from public.check_ins c
        where c.place_id = p_place
          and c.created_at > v_from
          and c.created_at <= v_until
      ) vis on exists (
        select 1 from public.profiles pr
        where pr.id = vis.user_id
          and pr.onboarding_answers -> 'envies' @> to_jsonb(e.envie)
      )
      group by e.envie
    ) a;
  end if;

  if public.has_place_role(p_place, array['owner']) or public.is_admin() then
    select coalesce(json_agg(row_to_json(t) order by t.codes_redeemed desc), '[]'::json)
    into v_team
    from (
      select
        split_part(
          coalesce(nullif(trim(pr.full_name), ''), 'Équipier'),
          ' ',
          1
        ) as first_name,
        count(*)::integer as codes_redeemed
      from public.drop_codes dc
      join public.flash_drops fd on fd.id = dc.flash_drop_id
      join public.place_members m
        on m.place_id = p_place and m.user_id = dc.redeemed_by
      left join public.profiles pr on pr.id = dc.redeemed_by
      where fd.place_id = p_place
        and dc.status = 'redeemed'
        and dc.redeemed_by is not null
        and dc.redeemed_at is not null
        and dc.redeemed_at > v_from
        and dc.redeemed_at <= v_until
      group by dc.redeemed_by, pr.full_name
    ) t;
  else
    v_team := null;
  end if;

  return json_build_object(
    'current', v_current,
    'previous', v_previous,
    'by_hour', to_json(v_by_hour),
    'by_weekday', to_json(v_by_weekday),
    'returning_share', v_returning_share,
    'crowd', v_crowd,
    'wifi', v_wifi,
    'drops', v_drops,
    'audience', v_audience,
    'team', v_team
  );
end;
$$;

comment on function public.pro_place_insights(uuid, int) is
  'Pro café insights (hours, weekdays, audience, drops, team). Owner/manager or is_admin(); Pro required. No person ids.';

revoke all on function public.pro_place_insights(uuid, int) from public, anon;
grant execute on function public.pro_place_insights(uuid, int) to authenticated;
