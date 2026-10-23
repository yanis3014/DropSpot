-- Admin console (lot 2): action log, cafés, users, Pro plans.
--
-- Every admin read goes through SECURITY DEFINER functions gated by
-- is_admin() (admin + 6-digit code). Every admin write leaves a row in
-- admin_actions, written only by these functions and triggers.
--
-- Impact ERP / Souley: new table admin_actions (read-only for admins) and
-- two new nullable columns places.reviewed_at / places.reviewed_by. Nothing
-- renamed or removed.

-- ---------------------------------------------------------------------------
-- 1) admin_actions: append-only log
-- ---------------------------------------------------------------------------
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null check (target_type in ('place', 'user', 'claim', 'plan')),
  target_id uuid,
  target_label text,
  details jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.admin_actions is
  'Admin action log. Written only by admin functions and triggers; read by admins (aal2).';

create index if not exists admin_actions_created_idx
  on public.admin_actions (created_at desc);
create index if not exists admin_actions_target_idx
  on public.admin_actions (target_type, target_id, created_at desc);

alter table public.admin_actions enable row level security;

drop policy if exists "Admins read admin actions" on public.admin_actions;
create policy "Admins read admin actions"
  on public.admin_actions for select
  to authenticated
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policy: rows come from the functions below only.
revoke insert, update, delete on public.admin_actions from anon, authenticated;

-- Internal writer (not callable from the API).
create or replace function public.log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_target_label text default null,
  p_details jsonb default '{}'::jsonb,
  p_note text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.admin_actions (
    admin_id, action, target_type, target_id, target_label, details, note
  )
  values (
    auth.uid(), p_action, p_target_type, p_target_id, p_target_label,
    coalesce(p_details, '{}'::jsonb), nullif(btrim(coalesce(p_note, '')), '')
  );
$$;

revoke execute on function public.log_admin_action(text, text, uuid, text, jsonb, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Log claim decisions and plan changes made by admins
-- ---------------------------------------------------------------------------
create or replace function public.trg_log_claim_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected')
     and public.is_admin() then
    perform public.log_admin_action(
      case when new.status = 'approved' then 'approve_claim' else 'reject_claim' end,
      'claim',
      new.id,
      (select p.name from public.places p where p.id = new.place_id),
      jsonb_build_object('place_id', new.place_id, 'user_id', new.user_id),
      new.note
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.trg_log_claim_review() from public, anon, authenticated;

drop trigger if exists place_claims_log_review on public.place_claims;
create trigger place_claims_log_review
  after update of status on public.place_claims
  for each row execute function public.trg_log_claim_review();

create or replace function public.trg_log_vendor_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin()
     and (tg_op = 'INSERT'
          or new.plan is distinct from old.plan
          or new.pro_until is distinct from old.pro_until) then
    perform public.log_admin_action(
      'set_plan',
      'plan',
      new.user_id,
      (select u.email from auth.users u where u.id = new.user_id),
      jsonb_build_object(
        'plan', new.plan,
        'pro_until', new.pro_until,
        'previous_plan', case when tg_op = 'UPDATE' then old.plan end
      ),
      null
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.trg_log_vendor_plan() from public, anon, authenticated;

drop trigger if exists vendor_plans_log_change on public.vendor_plans;
create trigger vendor_plans_log_change
  after insert or update on public.vendor_plans
  for each row execute function public.trg_log_vendor_plan();

-- Suspensions happen in Supabase Auth (server action); the server logs them
-- through this narrow entry point, still as the signed-in admin.
create or replace function public.admin_log_user_action(
  p_action text,
  p_user uuid,
  p_note text default null
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
  if p_action not in ('suspend_user', 'unsuspend_user') then
    return json_build_object('ok', false, 'error', 'invalid_action');
  end if;
  perform public.log_admin_action(
    p_action, 'user', p_user,
    (select u.email from auth.users u where u.id = p_user),
    '{}'::jsonb, p_note
  );
  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_log_user_action(text, uuid, text) from public, anon;
grant execute on function public.admin_log_user_action(text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Cafés: review of client suggestions, list, edit
-- ---------------------------------------------------------------------------
alter table public.places
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null;

comment on column public.places.reviewed_at is
  'When an admin checked a client-suggested café (null = still to review).';

create index if not exists places_to_review_idx
  on public.places (created_at)
  where suggested_by is not null and reviewed_at is null;

create or replace function public.admin_list_places(
  p_query text default null,
  p_filter text default 'all',
  p_limit integer default 50
)
returns table (
  id uuid,
  name text,
  address text,
  city text,
  verification_status text,
  suggested_by_email text,
  reviewed_at timestamptz,
  created_at timestamptz,
  members_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    p.id, p.name, p.address, p.city, p.verification_status,
    su.email::text,
    p.reviewed_at, p.created_at,
    (select count(*)::integer from public.place_members m where m.place_id = p.id)
  from public.places p
  left join auth.users su on su.id = p.suggested_by
  where (v_q is null
         or p.name ilike '%' || v_q || '%'
         or p.address ilike '%' || v_q || '%'
         or coalesce(p.city, '') ilike '%' || v_q || '%')
    and case coalesce(p_filter, 'all')
          when 'to_review' then p.suggested_by is not null and p.reviewed_at is null
          when 'unclaimed' then p.verification_status = 'unclaimed'
          when 'verified' then p.verification_status = 'verified'
          else true
        end
  order by
    case when p_filter = 'to_review' then p.created_at end asc,
    p.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke execute on function public.admin_list_places(text, text, integer) from public, anon;
grant execute on function public.admin_list_places(text, text, integer) to authenticated;

create or replace function public.admin_update_place(
  p_place uuid,
  p_name text,
  p_address text,
  p_city text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.places%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_address text := btrim(coalesce(p_address, ''));
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_old from public.places where id = p_place for update;
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if length(v_name) < 2 or length(v_name) > 120 then
    return json_build_object('ok', false, 'error', 'invalid_name');
  end if;
  if length(v_address) < 3 or length(v_address) > 200 then
    return json_build_object('ok', false, 'error', 'invalid_address');
  end if;

  update public.places
  set name = v_name, address = v_address, city = v_city
  where id = p_place;

  perform public.log_admin_action(
    'update_place', 'place', p_place, v_name,
    jsonb_build_object(
      'before', jsonb_build_object('name', v_old.name, 'address', v_old.address, 'city', v_old.city),
      'after', jsonb_build_object('name', v_name, 'address', v_address, 'city', v_city)
    ),
    null
  );

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_update_place(uuid, text, text, text) from public, anon;
grant execute on function public.admin_update_place(uuid, text, text, text) to authenticated;

create or replace function public.admin_mark_place_reviewed(p_place uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  update public.places
  set reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_place and reviewed_at is null
  returning name into v_name;

  if v_name is null then
    return json_build_object('ok', false, 'error', 'not_found_or_done');
  end if;

  perform public.log_admin_action('review_place', 'place', p_place, v_name, '{}'::jsonb, null);
  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_mark_place_reviewed(uuid) from public, anon;
grant execute on function public.admin_mark_place_reviewed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Users: search and detail
-- ---------------------------------------------------------------------------
create or replace function public.admin_search_users(
  p_query text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  email text,
  full_name text,
  username text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  grains_balance integer,
  is_admin boolean,
  places_count integer,
  plan text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    u.id, u.email::text, pr.full_name, pr.username,
    u.created_at, u.last_sign_in_at, u.banned_until,
    coalesce(pr.grains_balance, 0),
    exists (select 1 from public.admins a where a.user_id = u.id),
    (select count(*)::integer from public.place_members m where m.user_id = u.id),
    vp.plan
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  left join public.vendor_plans vp on vp.user_id = u.id
  where v_q is null
     or u.email ilike '%' || v_q || '%'
     or coalesce(pr.full_name, '') ilike '%' || v_q || '%'
     or coalesce(pr.username, '') ilike '%' || v_q || '%'
  order by u.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke execute on function public.admin_search_users(text, integer) from public, anon;
grant execute on function public.admin_search_users(text, integer) to authenticated;

create or replace function public.admin_user_detail(p_user uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user record;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
         pr.full_name, pr.username, pr.role, coalesce(pr.grains_balance, 0) as grains_balance
  into v_user
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  where u.id = p_user;

  if not found then
    return null;
  end if;

  return json_build_object(
    'id', v_user.id,
    'email', v_user.email,
    'created_at', v_user.created_at,
    'last_sign_in_at', v_user.last_sign_in_at,
    'banned_until', v_user.banned_until,
    'full_name', v_user.full_name,
    'username', v_user.username,
    'role', v_user.role,
    'grains_balance', v_user.grains_balance,
    'is_admin', exists (select 1 from public.admins a where a.user_id = p_user),
    'plan', (select json_build_object('plan', vp.plan, 'pro_until', vp.pro_until,
                                      'has_pro', public.has_pro(p_user))
             from public.vendor_plans vp where vp.user_id = p_user),
    'places', coalesce((
      select json_agg(json_build_object('id', p.id, 'name', p.name, 'role', m.role)
                      order by p.name)
      from public.place_members m join public.places p on p.id = m.place_id
      where m.user_id = p_user), '[]'::json),
    'check_ins_count', (select count(*) from public.check_ins c where c.user_id = p_user),
    'suggested_count', (select count(*) from public.places p where p.suggested_by = p_user),
    'grains', coalesce((
      select json_agg(g order by g.created_at desc)
      from (select t.amount, t.reason, t.created_at
            from public.grains_transactions t
            where t.user_id = p_user
            order by t.created_at desc limit 10) g), '[]'::json),
    'actions', coalesce((
      select json_agg(a order by a.created_at desc)
      from (select x.action, x.note, x.created_at
            from public.admin_actions x
            where x.target_id = p_user and x.target_type in ('user', 'plan')
            order by x.created_at desc limit 10) a), '[]'::json)
  );
end;
$$;

revoke execute on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Pro plans: every café account (owner or with a plan row)
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_vendors()
returns table (
  user_id uuid,
  email text,
  full_name text,
  places text,
  plan text,
  pro_until timestamptz,
  has_pro boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
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
    coalesce(vp.plan, 'free'), vp.pro_until,
    public.has_pro(v.user_id),
    vp.updated_at
  from vendors v
  join auth.users u on u.id = v.user_id
  left join public.profiles pr on pr.id = v.user_id
  left join public.vendor_plans vp on vp.user_id = v.user_id
  order by public.has_pro(v.user_id) desc, u.email;
end;
$$;

revoke execute on function public.admin_list_vendors() from public, anon;
grant execute on function public.admin_list_vendors() to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Log page: actions with the admin's name
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_actions(
  p_limit integer default 100,
  p_before timestamptz default null
)
returns table (
  id uuid,
  admin_name text,
  action text,
  target_type text,
  target_id uuid,
  target_label text,
  details jsonb,
  note text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    coalesce(nullif(pr.full_name, ''), u.email::text, 'Admin supprimé'),
    a.action, a.target_type, a.target_id, a.target_label, a.details, a.note, a.created_at
  from public.admin_actions a
  left join auth.users u on u.id = a.admin_id
  left join public.profiles pr on pr.id = a.admin_id
  where p_before is null or a.created_at < p_before
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke execute on function public.admin_list_actions(integer, timestamptz) from public, anon;
grant execute on function public.admin_list_actions(integer, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) admin_overview(): + cafés suggested by clients still to review
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
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
      (select count(*) from public.vendor_plans
        where plan = 'pro' and (pro_until is null or pro_until > now()))
  );
end;
$$;
