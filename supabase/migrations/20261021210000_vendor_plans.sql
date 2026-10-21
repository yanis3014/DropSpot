-- Vendor plans (admin-managed), has_pro, notification prefs, Pro-gated features.

-- ---------------------------------------------------------------------------
-- 1) vendor_plans
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'pro')),
  pro_until timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.vendor_plans is
  'B2B plan per vendor account. Writable by admins only (RPC). No payment flow.';

alter table public.vendor_plans enable row level security;

drop policy if exists "Users read own vendor plan" on public.vendor_plans;
create policy "Users read own vendor plan"
  on public.vendor_plans for select
  using (auth.uid() = user_id);

-- No direct INSERT/UPDATE/DELETE for clients (admin RPC only).

-- Backfill free plan for existing place owners
insert into public.vendor_plans (user_id, plan)
select distinct p.vendor_id, 'free'
from public.places p
where p.vendor_id is not null
on conflict (user_id) do nothing;

insert into public.vendor_plans (user_id, plan)
select pr.id, 'free'
from public.profiles pr
where pr.role in ('vendor', 'owner')
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2) has_pro
-- ---------------------------------------------------------------------------
create or replace function public.has_pro(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        vp.plan = 'pro'
        and (vp.pro_until is null or vp.pro_until > now())
      from public.vendor_plans vp
      where vp.user_id = p_user
    ),
    false
  );
$$;

comment on function public.has_pro(uuid) is
  'True when vendor_plans.plan = pro and pro_until is null or in the future.';

revoke all on function public.has_pro(uuid) from public;
grant execute on function public.has_pro(uuid) to anon, authenticated;

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
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_row
  from public.vendor_plans vp
  where vp.user_id = v_uid;

  if not found then
    return json_build_object(
      'ok', true,
      'plan', 'free',
      'pro_until', null,
      'has_pro', false
    );
  end if;

  return json_build_object(
    'ok', true,
    'plan', v_row.plan,
    'pro_until', v_row.pro_until,
    'has_pro', public.has_pro(v_uid)
  );
end;
$$;

revoke all on function public.my_vendor_plan() from public;
grant execute on function public.my_vendor_plan() to authenticated;

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
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_user is null then
    return json_build_object('ok', false, 'error', 'invalid_user');
  end if;

  if p_plan is null or p_plan not in ('free', 'pro') then
    return json_build_object('ok', false, 'error', 'invalid_plan');
  end if;

  insert into public.vendor_plans (user_id, plan, pro_until, updated_at)
  values (
    p_user,
    p_plan,
    case when p_plan = 'pro' then p_pro_until else null end,
    now()
  )
  on conflict (user_id) do update
  set
    plan = excluded.plan,
    pro_until = excluded.pro_until,
    updated_at = now();

  return json_build_object(
    'ok', true,
    'user_id', p_user,
    'plan', p_plan,
    'pro_until', case when p_plan = 'pro' then p_pro_until else null end,
    'has_pro', public.has_pro(p_user)
  );
end;
$$;

revoke all on function public.admin_set_vendor_plan(uuid, text, timestamptz) from public;
grant execute on function public.admin_set_vendor_plan(uuid, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) notification_preferences (+ quiet hours on global row)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null,
  push boolean not null default true,
  email boolean not null default false,
  quiet_from time,
  quiet_to time,
  updated_at timestamptz not null default now(),
  primary key (user_id, event),
  check (event ~ '^[a-z][a-z0-9_]{0,63}$')
);

comment on table public.notification_preferences is
  'Per-user notification channels. event=global holds quiet_from/quiet_to (Do not disturb).';

alter table public.notification_preferences enable row level security;

drop policy if exists "Users manage own notification preferences" on public.notification_preferences;
create policy "Users manage own notification preferences"
  on public.notification_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.notification_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Recurring drops column
-- ---------------------------------------------------------------------------
alter table public.flash_drops
  add column if not exists is_recurring boolean not null default false;

comment on column public.flash_drops.is_recurring is
  'Pro only: weekly recurring drop template (ERP / future scheduler).';

-- ---------------------------------------------------------------------------
-- 5) Pro enforcement helpers
-- ---------------------------------------------------------------------------
create or replace function public.place_vendor_id(p_place uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.vendor_id from public.places p where p.id = p_place;
$$;

revoke all on function public.place_vendor_id(uuid) from public;
grant execute on function public.place_vendor_id(uuid) to authenticated;

create or replace function public.enforce_flash_drop_pro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor uuid;
begin
  if coalesce(NEW.is_recurring, false) then
    v_vendor := public.place_vendor_id(NEW.place_id);
    if not public.has_pro(v_vendor) then
      raise exception 'pro_required: recurring drops require Pro'
        using errcode = 'P0001';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists flash_drops_enforce_pro on public.flash_drops;
create trigger flash_drops_enforce_pro
  before insert or update of is_recurring, place_id on public.flash_drops
  for each row execute function public.enforce_flash_drop_pro();

create or replace function public.enforce_place_media_pro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor uuid;
  v_venue_count integer;
  c_free_venue_max constant integer := 3;
begin
  v_vendor := public.place_vendor_id(NEW.place_id);
  if public.has_pro(v_vendor) then
    return NEW;
  end if;

  if NEW.category is distinct from 'venue' then
    raise exception 'pro_required: food and menu gallery require Pro'
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
$$;

drop trigger if exists place_media_enforce_pro on public.place_media;
create trigger place_media_enforce_pro
  before insert or update of category, place_id on public.place_media
  for each row execute function public.enforce_place_media_pro();

-- ---------------------------------------------------------------------------
-- 6) flash_drops RLS — managers need Pro (defense in depth)
-- ---------------------------------------------------------------------------
drop policy if exists "Owners and managers insert flash drops" on public.flash_drops;
create policy "Owners and managers insert flash drops"
  on public.flash_drops for insert
  with check (
    vendor_id = (select p.vendor_id from public.places p where p.id = place_id)
    and (
      public.has_place_role(place_id, array['owner'])
      or (
        public.has_place_role(place_id, array['manager'])
        and public.has_pro(public.place_vendor_id(place_id))
      )
    )
  );

drop policy if exists "Owners and managers update flash drops" on public.flash_drops;
create policy "Owners and managers update flash drops"
  on public.flash_drops for update
  using (
    public.has_place_role(place_id, array['owner'])
    or (
      public.has_place_role(place_id, array['manager'])
      and public.has_pro(public.place_vendor_id(place_id))
    )
  )
  with check (
    vendor_id = (select p.vendor_id from public.places p where p.id = place_id)
    and (
      public.has_place_role(place_id, array['owner'])
      or (
        public.has_place_role(place_id, array['manager'])
        and public.has_pro(public.place_vendor_id(place_id))
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
      and public.has_pro(public.place_vendor_id(place_id))
    )
  );

-- ---------------------------------------------------------------------------
-- 7) invite_member / accept_invitation — manager role requires Pro
-- ---------------------------------------------------------------------------
create or replace function public.invite_member(
  p_place_id uuid,
  p_email text,
  p_role text default 'staff'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
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

  if p_role = 'manager' then
    v_vendor := public.place_vendor_id(p_place_id);
    if not public.has_pro(v_vendor) then
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
$$;

create or replace function public.accept_invitation(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
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

  if v_inv.role = 'manager' then
    v_vendor := public.place_vendor_id(v_inv.place_id);
    if not public.has_pro(v_vendor) then
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
$$;
