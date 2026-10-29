-- Place stats: unique daily views / directions (place_events) and
-- pro_place_summary aggregates for the café dashboard.
--
-- Impact ERP / Souley: new table place_events (readable only via functions),
-- new function pro_place_summary callable by an admin session with 6-digit
-- MFA. No existing columns modified.

-- ---------------------------------------------------------------------------
-- 1. place_events — one row per person, café, kind and Paris day
-- ---------------------------------------------------------------------------
create table if not exists public.place_events (
  id bigint generated always as identity primary key,
  place_id uuid not null references public.places (id) on delete cascade,
  kind text not null check (kind in ('view', 'directions')),
  source text null check (source in ('map', 'list', 'top', 'drop', 'direct')),
  -- sha256 hex of the visitor key (auth.uid() or anon uuid). Never store clear ids.
  viewer_hash text not null,
  day date not null default ((now() at time zone 'Europe/Paris')::date),
  created_at timestamptz not null default now(),
  unique (place_id, kind, viewer_hash, day)
);

create index if not exists place_events_place_day_idx
  on public.place_events (place_id, day);

comment on table public.place_events is
  'Unique daily views / directions per visitor hash. RLS on, no policies: nobody reads or writes directly; only log_place_event / pro_place_summary.';

alter table public.place_events enable row level security;

revoke all on table public.place_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. log_place_event — fire-and-forget from the public place sheet
-- ---------------------------------------------------------------------------
create or replace function public.log_place_event(
  p_place uuid,
  p_kind text,
  p_source text default null,
  p_anon_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_hash text;
  v_day date := (now() at time zone 'Europe/Paris')::date;
begin
  -- Visitor key: logged-in user, else anonymous id from the client.
  v_key := coalesce(v_uid::text, p_anon_id::text);
  if v_key is null then
    return;
  end if;

  if p_place is null or not exists (select 1 from public.places where id = p_place) then
    return;
  end if;

  -- Café team looking at their own sheet must not inflate the numbers.
  if v_uid is not null and exists (
    select 1 from public.place_members m
    where m.place_id = p_place and m.user_id = v_uid
  ) then
    return;
  end if;

  if p_kind is null or p_kind not in ('view', 'directions') then
    raise exception 'invalid_kind';
  end if;

  if p_source is not null and p_source not in ('map', 'list', 'top', 'drop', 'direct') then
    raise exception 'invalid_source';
  end if;

  v_hash := encode(extensions.digest(convert_to(v_key, 'UTF8'), 'sha256'), 'hex');

  insert into public.place_events (place_id, kind, source, viewer_hash, day)
  values (p_place, p_kind, p_source, v_hash, v_day)
  on conflict (place_id, kind, viewer_hash, day) do nothing;
end;
$$;

comment on function public.log_place_event(uuid, text, text, uuid) is
  'Records at most one view/directions event per visitor hash, café and Paris day. Ignores missing places and place members.';

revoke all on function public.log_place_event(uuid, text, text, uuid) from public;
grant execute on function public.log_place_event(uuid, text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. pro_place_summary — owner/manager (or admin), free capped at 7 days
-- ---------------------------------------------------------------------------
create or replace function public.pro_place_summary(
  p_place uuid,
  p_days int default 7,
  p_until timestamptz default now()
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  -- FREE_STATS_MAX_DAYS: free plan may only request this many days of summary.
  c_free_stats_max_days constant integer := 7;

  v_until timestamptz := coalesce(p_until, now());
  v_from timestamptz;
  v_views integer;
  v_directions integer;
  v_check_ins integer;
  v_unique_visitors integer;
  v_saves integer;
  v_codes_redeemed integer;
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

  if p_days > c_free_stats_max_days
     and not public.has_pro(public.place_vendor_id(p_place))
     and not public.is_admin() then
    raise exception 'pro_required';
  end if;

  v_from := v_until - make_interval(days => p_days);

  select
    count(*) filter (where pe.kind = 'view')::integer,
    count(*) filter (where pe.kind = 'directions')::integer
  into v_views, v_directions
  from public.place_events pe
  where pe.place_id = p_place
    -- Exactly p_days Paris days, ending on the day of v_until.
    and pe.day > (v_from at time zone 'Europe/Paris')::date
    and pe.day <= (v_until at time zone 'Europe/Paris')::date;

  select
    count(*)::integer,
    count(distinct c.user_id)::integer
  into v_check_ins, v_unique_visitors
  from public.check_ins c
  where c.place_id = p_place
    and c.created_at > v_from
    and c.created_at <= v_until;

  select count(*)::integer into v_saves
  from public.saved_places sp
  where sp.place_id = p_place
    and sp.created_at > v_from
    and sp.created_at <= v_until;

  select count(*)::integer into v_codes_redeemed
  from public.drop_codes dc
  join public.flash_drops fd on fd.id = dc.flash_drop_id
  where fd.place_id = p_place
    and dc.status = 'redeemed'
    and dc.redeemed_at is not null
    and dc.redeemed_at > v_from
    and dc.redeemed_at <= v_until;

  return json_build_object(
    'from', v_from,
    'until', v_until,
    'days', p_days,
    'views', coalesce(v_views, 0),
    'directions', coalesce(v_directions, 0),
    'check_ins', coalesce(v_check_ins, 0),
    'unique_visitors', coalesce(v_unique_visitors, 0),
    'saves', coalesce(v_saves, 0),
    'codes_redeemed', coalesce(v_codes_redeemed, 0)
  );
end;
$$;

comment on function public.pro_place_summary(uuid, int, timestamptz) is
  'Aggregated café stats over p_days (7/30/90). Owner/manager or is_admin(); free capped at 7 days. No person ids.';

revoke all on function public.pro_place_summary(uuid, int, timestamptz) from public, anon;
grant execute on function public.pro_place_summary(uuid, int, timestamptz) to authenticated;
