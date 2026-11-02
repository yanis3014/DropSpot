-- Three offers (Présence, Analytics, Premium) and an admin-editable grid of
-- which offer unlocks which pro feature. Every server-side gate that used to
-- ask "is this vendor Pro?" now asks "does this vendor's offer include
-- feature X?" (vendor_has_feature / place_has_feature).
--
-- Impact ERP / Souley:
--   * vendor_plans.plan values change: 'free' -> 'presence', 'pro' -> 'premium';
--     'analytics' is new. pro_until keeps its name and now means "end of the
--     paid offer" (analytics or premium); after that date the café is back on
--     Présence.
--   * has_pro(user) keeps its signature and now means "paid offer active"
--     (analytics or premium).
--   * New table plan_features (read-only for everyone signed in) and new
--     functions vendor_effective_plan, vendor_has_feature, place_has_feature,
--     place_plan, admin_plan_features, admin_set_plan_feature.
--   * my_vendor_plan() returns two more keys (effective_plan, features).
--   * admin_set_vendor_plan accepts 'presence' | 'analytics' | 'premium'
--     (the old 'free' / 'pro' are still accepted and mapped).

-- ---------------------------------------------------------------------------
-- 1) vendor_plans: three offers
-- ---------------------------------------------------------------------------
alter table public.vendor_plans drop constraint if exists vendor_plans_plan_check;

update public.vendor_plans set plan = 'presence' where plan = 'free';
update public.vendor_plans set plan = 'premium' where plan = 'pro';

alter table public.vendor_plans alter column plan set default 'presence';
alter table public.vendor_plans
  add constraint vendor_plans_plan_check
  check (plan in ('presence', 'analytics', 'premium'));

comment on table public.vendor_plans is
  'B2B offer per café owner account (presence | analytics | premium). Writable by admins only (RPC). No payment flow.';
comment on column public.vendor_plans.pro_until is
  'End of the paid offer (analytics or premium). Null = no end date. After it, the account is on presence.';

-- ---------------------------------------------------------------------------
-- 2) plan_features: which offers unlock each feature
-- ---------------------------------------------------------------------------
-- Feature keys are a closed list (labels live in the app,
-- src/lib/pro/planFeatures.ts). A feature missing from the table is locked
-- for everyone.
create table if not exists public.plan_features (
  feature text primary key
    check (feature in (
      'drops',
      'recurring_drops',
      'team_staff',
      'team_manager',
      'gallery_full',
      'stats_history',
      'stats_insights'
    )),
  plans text[] not null default '{}'
    check (plans <@ array['presence', 'analytics', 'premium']::text[]),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.plan_features is
  'Admin-edited grid: for each pro feature, the offers that include it. Read by every server-side gate.';

alter table public.plan_features enable row level security;

drop policy if exists "Signed-in users read plan features" on public.plan_features;
create policy "Signed-in users read plan features"
  on public.plan_features for select
  to authenticated
  using (true);

revoke all on public.plan_features from public, anon;
grant select on public.plan_features to authenticated;
-- No direct writes: admin_set_plan_feature only.

-- Starting grid = what the app did before this migration, so nobody loses
-- a feature: old Free = Présence, old Pro = Premium, Analytics = the stats.
insert into public.plan_features (feature, plans) values
  ('drops',           array['presence', 'analytics', 'premium']),
  ('team_staff',      array['presence', 'analytics', 'premium']),
  ('stats_history',   array['analytics', 'premium']),
  ('stats_insights',  array['analytics', 'premium']),
  ('team_manager',    array['premium']),
  ('gallery_full',    array['premium']),
  ('recurring_drops', array['premium'])
on conflict (feature) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Helpers
-- ---------------------------------------------------------------------------
create or replace function public.vendor_effective_plan(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when vp.plan = 'presence' then 'presence'
        when vp.pro_until is null or vp.pro_until > now() then vp.plan
        else 'presence'
      end
      from public.vendor_plans vp
      where vp.user_id = p_user
    ),
    'presence'
  );
$$;

comment on function public.vendor_effective_plan(uuid) is
  'Offer in force for a café owner account: its plan, or presence once pro_until has passed.';

create or replace function public.vendor_has_feature(p_user uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select public.vendor_effective_plan(p_user) = any (pf.plans)
      from public.plan_features pf
      where pf.feature = p_feature
    ),
    false
  );
$$;

create or replace function public.place_has_feature(p_place uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.vendor_has_feature(public.place_vendor_id(p_place), p_feature);
$$;

-- has_pro keeps its name for existing callers (ERP, admin): paid offer active.
create or replace function public.has_pro(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.vendor_effective_plan(p_user) <> 'presence';
$$;

comment on function public.has_pro(uuid) is
  'True when the account is on a paid offer (analytics or premium) that has not ended.';

-- ---------------------------------------------------------------------------
-- 4) Offer as seen from the pro space
-- ---------------------------------------------------------------------------
create or replace function public.my_vendor_plan()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.vendor_plans%rowtype;
  v_effective text;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_row from public.vendor_plans vp where vp.user_id = v_uid;
  v_effective := public.vendor_effective_plan(v_uid);

  return json_build_object(
    'ok', true,
    'plan', coalesce(v_row.plan, 'presence'),
    'pro_until', v_row.pro_until,
    'has_pro', v_effective <> 'presence',
    'effective_plan', v_effective,
    'features', coalesce((
      select json_agg(pf.feature order by pf.feature)
      from public.plan_features pf
      where v_effective = any (pf.plans)
    ), '[]'::json)
  );
end;
$$;

-- Offer of a café's owner, for any member of that café (a manager or an
-- équipier sees what the café can do, not what their own account has).
create or replace function public.place_plan(p_place uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_vendor uuid;
  v_row public.vendor_plans%rowtype;
  v_effective text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if not (
    public.has_place_role(p_place, array['owner', 'manager', 'staff'])
    or public.is_admin()
  ) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_vendor := public.place_vendor_id(p_place);
  select * into v_row from public.vendor_plans vp where vp.user_id = v_vendor;
  v_effective := public.vendor_effective_plan(v_vendor);

  return json_build_object(
    'ok', true,
    'plan', coalesce(v_row.plan, 'presence'),
    'pro_until', v_row.pro_until,
    'has_pro', v_effective <> 'presence',
    'effective_plan', v_effective,
    'features', coalesce((
      select json_agg(pf.feature order by pf.feature)
      from public.plan_features pf
      where v_effective = any (pf.plans)
    ), '[]'::json)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Admin: offer per account, feature grid
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_vendor_plan(
  p_user uuid,
  p_plan text,
  p_pro_until timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := case p_plan when 'free' then 'presence' when 'pro' then 'premium' else p_plan end;
  v_until timestamptz;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_user is null then
    return json_build_object('ok', false, 'error', 'invalid_user');
  end if;

  if v_plan is null or v_plan not in ('presence', 'analytics', 'premium') then
    return json_build_object('ok', false, 'error', 'invalid_plan');
  end if;

  v_until := case when v_plan = 'presence' then null else p_pro_until end;

  insert into public.vendor_plans (user_id, plan, pro_until, updated_at)
  values (p_user, v_plan, v_until, now())
  on conflict (user_id) do update
  set plan = excluded.plan,
      pro_until = excluded.pro_until,
      updated_at = now();

  return json_build_object(
    'ok', true,
    'user_id', p_user,
    'plan', v_plan,
    'pro_until', v_until,
    'has_pro', public.has_pro(p_user),
    'effective_plan', public.vendor_effective_plan(p_user)
  );
end;
$$;

create or replace function public.admin_plan_features()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return json_build_object(
    'features', coalesce((
      select json_agg(json_build_object(
        'feature', pf.feature,
        'plans', pf.plans,
        'updated_at', pf.updated_at
      ) order by pf.feature)
      from public.plan_features pf
    ), '[]'::json),
    -- Café owner accounts per offer in force, to show who a change affects.
    'accounts', (
      with vendors as (
        select m.user_id from public.place_members m where m.role = 'owner'
        union
        select vp.user_id from public.vendor_plans vp
      )
      select json_build_object(
        'presence', count(*) filter (where public.vendor_effective_plan(v.user_id) = 'presence'),
        'analytics', count(*) filter (where public.vendor_effective_plan(v.user_id) = 'analytics'),
        'premium', count(*) filter (where public.vendor_effective_plan(v.user_id) = 'premium')
      )
      from vendors v
    )
  );
end;
$$;

-- The admin log also records grid changes.
alter table public.admin_actions drop constraint if exists admin_actions_target_type_check;
alter table public.admin_actions
  add constraint admin_actions_target_type_check
  check (target_type in ('place', 'user', 'claim', 'plan', 'plan_feature'));

create or replace function public.admin_set_plan_feature(
  p_feature text,
  p_plans text[]
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plans text[];
  v_previous text[];
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_feature is null or p_feature not in (
    'drops', 'recurring_drops', 'team_staff', 'team_manager',
    'gallery_full', 'stats_history', 'stats_insights'
  ) then
    return json_build_object('ok', false, 'error', 'invalid_feature');
  end if;

  if p_plans is null
     or not (p_plans <@ array['presence', 'analytics', 'premium']::text[]) then
    return json_build_object('ok', false, 'error', 'invalid_plans');
  end if;

  -- Stored in offer order, without duplicates.
  select coalesce(array_agg(x order by array_position(array['presence', 'analytics', 'premium'], x)), '{}')
  into v_plans
  from (select distinct unnest(p_plans) as x) s;

  select pf.plans into v_previous
  from public.plan_features pf
  where pf.feature = p_feature
  for update;

  insert into public.plan_features (feature, plans, updated_at, updated_by)
  values (p_feature, v_plans, now(), auth.uid())
  on conflict (feature) do update
  set plans = excluded.plans,
      updated_at = now(),
      updated_by = auth.uid();

  if v_previous is distinct from v_plans then
    perform public.log_admin_action(
      'set_plan_feature',
      'plan_feature',
      null,
      p_feature,
      jsonb_build_object('feature', p_feature, 'plans', v_plans, 'previous_plans', v_previous),
      null
    );
  end if;

  return json_build_object('ok', true, 'feature', p_feature, 'plans', v_plans);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Drops: creating or editing needs the "drops" feature; managers also
--    need "team_manager". Deleting stays open to owners.
-- ---------------------------------------------------------------------------
drop policy if exists "Owners and managers insert flash drops" on public.flash_drops;
create policy "Owners and managers insert flash drops"
  on public.flash_drops for insert
  with check (
    vendor_id = (select p.vendor_id from public.places p where p.id = place_id)
    and public.place_has_feature(place_id, 'drops')
    and (
      public.has_place_role(place_id, array['owner'])
      or (
        public.has_place_role(place_id, array['manager'])
        and public.place_has_feature(place_id, 'team_manager')
      )
    )
  );

drop policy if exists "Owners and managers update flash drops" on public.flash_drops;
create policy "Owners and managers update flash drops"
  on public.flash_drops for update
  using (
    public.place_has_feature(place_id, 'drops')
    and (
      public.has_place_role(place_id, array['owner'])
      or (
        public.has_place_role(place_id, array['manager'])
        and public.place_has_feature(place_id, 'team_manager')
      )
    )
  )
  with check (
    vendor_id = (select p.vendor_id from public.places p where p.id = place_id)
    and public.place_has_feature(place_id, 'drops')
    and (
      public.has_place_role(place_id, array['owner'])
      or (
        public.has_place_role(place_id, array['manager'])
        and public.place_has_feature(place_id, 'team_manager')
      )
    )
  );

drop policy if exists "Owners and managers delete flash drops" on public.flash_drops;
create policy "Owners and managers delete flash drops"
  on public.flash_drops for delete
  using (
    public.has_place_role(place_id, array['owner'])
    or (
      public.has_place_role(place_id, array['manager'])
      and public.place_has_feature(place_id, 'team_manager')
    )
  );

-- ---------------------------------------------------------------------------
-- 7) Existing gates, now read from the grid (bodies otherwise unchanged)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_flash_drop_pro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_vendor uuid;
begin
  if coalesce(NEW.is_recurring, false) then
    v_vendor := public.place_vendor_id(NEW.place_id);
    if not public.vendor_has_feature(v_vendor, 'recurring_drops') then
      raise exception 'pro_required: recurring drops are not in this plan'
        using errcode = 'P0001';
    end if;
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_place_media_pro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_vendor uuid;
  v_venue_count integer;
  c_free_venue_max constant integer := 3;
begin
  v_vendor := public.place_vendor_id(NEW.place_id);
  if public.vendor_has_feature(v_vendor, 'gallery_full') then
    return NEW;
  end if;

  if NEW.category is distinct from 'venue' then
    raise exception 'pro_required: food and menu gallery are not in this plan'
      using errcode = 'P0001';
  end if;

  select count(*)::integer into v_venue_count
  from public.place_media pm
  where pm.place_id = NEW.place_id
    and pm.category = 'venue'
    and (TG_OP = 'INSERT' or pm.id is distinct from NEW.id);

  if v_venue_count >= c_free_venue_max then
    raise exception 'pro_required: free plan allows up to % venue photos', c_free_venue_max
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.invite_member(p_place_id uuid, p_email text, p_role text DEFAULT 'staff'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(btrim(p_email));
  v_actor_email text;
  v_token text;
  v_id uuid;
  v_vendor uuid;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if not public.has_place_role(p_place_id, array['owner']) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    return json_build_object('ok', false, 'error', 'invalid_email');
  end if;

  if p_role is null or p_role not in ('owner', 'manager', 'staff') then
    return json_build_object('ok', false, 'error', 'invalid_role');
  end if;

  if p_role in ('manager', 'staff') then
    v_vendor := public.place_vendor_id(p_place_id);
    if not public.vendor_has_feature(
      v_vendor,
      case when p_role = 'manager' then 'team_manager' else 'team_staff' end
    ) then
      return json_build_object('ok', false, 'error', 'pro_required');
    end if;
  end if;

  v_actor_email := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  if v_actor_email <> '' and v_actor_email = v_email then
    return json_build_object('ok', false, 'error', 'cannot_invite_self');
  end if;

  if exists (
    select 1 from auth.users u
    where u.id = v_actor
      and lower(u.email) = v_email
  ) then
    return json_build_object('ok', false, 'error', 'cannot_invite_self');
  end if;

  if exists (
    select 1
    from public.place_members m
    join auth.users u on u.id = m.user_id
    where m.place_id = p_place_id
      and lower(u.email) = v_email
  ) then
    return json_build_object('ok', false, 'error', 'already_member');
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  delete from public.place_invitations
  where place_id = p_place_id
    and lower(email) = v_email
    and accepted_at is null;

  insert into public.place_invitations (
    place_id, email, role, token, invited_by, expires_at
  )
  values (
    p_place_id, v_email, p_role, v_token, v_actor, now() + interval '14 days'
  )
  returning id into v_id;

  return json_build_object(
    'ok', true,
    'invitation_id', v_id,
    'token', v_token,
    'email', v_email,
    'role', p_role,
    'expires_at', (now() + interval '14 days')
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_inv public.place_invitations%rowtype;
  v_vendor uuid;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_token is null or btrim(p_token) = '' then
    return json_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_actor;

  if v_email is null then
    return json_build_object('ok', false, 'error', 'no_email');
  end if;

  select * into v_inv
  from public.place_invitations
  where token = btrim(p_token)
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_inv.accepted_at is not null then
    return json_build_object('ok', false, 'error', 'already_accepted');
  end if;

  if v_inv.expires_at <= now() then
    return json_build_object('ok', false, 'error', 'expired');
  end if;

  if lower(v_inv.email) is distinct from v_email then
    return json_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  if v_inv.role in ('manager', 'staff') then
    v_vendor := public.place_vendor_id(v_inv.place_id);
    if not public.vendor_has_feature(
      v_vendor,
      case when v_inv.role = 'manager' then 'team_manager' else 'team_staff' end
    ) then
      return json_build_object('ok', false, 'error', 'pro_required');
    end if;
  end if;

  insert into public.place_members (place_id, user_id, role)
  values (v_inv.place_id, v_actor, v_inv.role)
  on conflict (place_id, user_id) do update
  set role = excluded.role;

  update public.place_invitations
  set accepted_at = now()
  where id = v_inv.id;

  return json_build_object(
    'ok', true,
    'place_id', v_inv.place_id,
    'role', v_inv.role
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_member_role(p_place_id uuid, p_user_id uuid, p_role text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_current text;
  v_owner_count integer;
  v_vendor uuid;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if not public.has_place_role(p_place_id, array['owner']) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_role is null or p_role not in ('owner', 'manager', 'staff') then
    return json_build_object('ok', false, 'error', 'invalid_role');
  end if;

  -- Serialise team changes on this café so two concurrent demotions
  -- cannot both pass the last-owner check.
  perform 1 from public.places where id = p_place_id for update;

  select m.role into v_current
  from public.place_members m
  where m.place_id = p_place_id
    and m.user_id = p_user_id;

  if v_current is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_current = p_role then
    return json_build_object('ok', true, 'role', p_role);
  end if;

  -- Never leave the café without an owner
  if v_current = 'owner' and p_role is distinct from 'owner' then
    select count(*)::integer into v_owner_count
    from public.place_members m
    where m.place_id = p_place_id
      and m.role = 'owner';

    if v_owner_count <= 1 then
      return json_build_object('ok', false, 'error', 'last_owner');
    end if;
  end if;

  if p_role = 'manager' then
    v_vendor := public.place_vendor_id(p_place_id);
    if not public.vendor_has_feature(v_vendor, 'team_manager') then
      return json_build_object('ok', false, 'error', 'pro_required');
    end if;
  end if;

  update public.place_members
  set role = p_role
  where place_id = p_place_id
    and user_id = p_user_id;

  return json_build_object('ok', true, 'role', p_role);
end;
$function$;

CREATE OR REPLACE FUNCTION public.pro_place_summary(p_place uuid, p_days integer DEFAULT 7, p_until timestamp with time zone DEFAULT now())
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  -- FREE_STATS_MAX_DAYS: without the stats_history feature, a café may only request this many days of summary.
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
     and not public.place_has_feature(p_place, 'stats_history')
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
$function$;

CREATE OR REPLACE FUNCTION public.pro_place_insights(p_place uuid, p_days integer DEFAULT 30)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if not public.place_has_feature(p_place, 'stats_insights')
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_vendors()
 RETURNS TABLE(user_id uuid, email text, full_name text, places text, plan text, pro_until timestamp with time zone, has_pro boolean, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with vendors as (
    select m.user_id from public.place_members m where m.role = 'owner'
    union
    select vp.user_id from public.vendor_plans vp
  )
  select
    v.user_id, u.email::text, pr.full_name,
    (select string_agg(p.name, ', ' order by p.name)
       from public.place_members m join public.places p on p.id = m.place_id
      where m.user_id = v.user_id and m.role = 'owner'),
    coalesce(vp.plan, 'presence'), vp.pro_until,
    public.has_pro(v.user_id),
    vp.updated_at
  from vendors v
  join auth.users u on u.id = v.user_id
  left join public.profiles pr on pr.id = v.user_id
  left join public.vendor_plans vp on vp.user_id = v.user_id
  order by public.has_pro(v.user_id) desc, u.email;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_overview()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return json_build_object(
    'pending_claims',
      (select count(*) from public.place_claims where status = 'pending'),
    'places_to_review',
      (select count(*) from public.places
        where suggested_by is not null and reviewed_at is null),
    'places_total',
      (select count(*) from public.places),
    'places_verified',
      (select count(*) from public.places where verification_status = 'verified'),
    'pros_active',
      (select count(*) from public.vendor_plans vp
        where public.vendor_effective_plan(vp.user_id) <> 'presence')
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 8) Grants (signed-in users only; helpers stay callable for RLS)
-- ---------------------------------------------------------------------------
revoke execute on function public.vendor_effective_plan(uuid) from public, anon;
revoke execute on function public.vendor_has_feature(uuid, text) from public, anon;
revoke execute on function public.place_has_feature(uuid, text) from public, anon;
revoke execute on function public.place_plan(uuid) from public, anon;
revoke execute on function public.admin_plan_features() from public, anon;
revoke execute on function public.admin_set_plan_feature(text, text[]) from public, anon;
revoke execute on function public.has_pro(uuid) from public, anon;
revoke execute on function public.my_vendor_plan() from public, anon;
revoke execute on function public.admin_set_vendor_plan(uuid, text, timestamptz) from public, anon;

grant execute on function public.vendor_effective_plan(uuid) to authenticated;
grant execute on function public.vendor_has_feature(uuid, text) to authenticated;
grant execute on function public.place_has_feature(uuid, text) to authenticated;
grant execute on function public.place_plan(uuid) to authenticated;
grant execute on function public.admin_plan_features() to authenticated;
grant execute on function public.admin_set_plan_feature(text, text[]) to authenticated;
grant execute on function public.has_pro(uuid) to authenticated;
grant execute on function public.my_vendor_plan() to authenticated;
grant execute on function public.admin_set_vendor_plan(uuid, text, timestamptz) to authenticated;
