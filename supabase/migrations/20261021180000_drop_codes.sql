-- Per-client drop codes (2d): claim, redeem with Grains, stats Paris time.
-- validate_flash_drop_code(text, uuid) signature unchanged (legacy PIN caisse).

-- ---------------------------------------------------------------------------
-- 1) flash_drops extended fields
-- ---------------------------------------------------------------------------
alter table public.flash_drops
  add column if not exists kind text,
  add column if not exists discount_value numeric,
  add column if not exists discount_unit text,
  add column if not exists conditions text,
  add column if not exists stopped_at timestamptz;

update public.flash_drops
set kind = 'offer'
where kind is null;

alter table public.flash_drops
  alter column kind set default 'offer';

alter table public.flash_drops
  alter column kind set not null;

alter table public.flash_drops
  drop constraint if exists flash_drops_kind_check;

alter table public.flash_drops
  add constraint flash_drops_kind_check
  check (kind in ('discount', 'offer', 'special_price', 'activity'));

alter table public.flash_drops
  drop constraint if exists flash_drops_discount_unit_check;

alter table public.flash_drops
  add constraint flash_drops_discount_unit_check
  check (
    discount_unit is null
    or discount_unit in ('percent', 'eur')
  );

alter table public.flash_drops
  drop constraint if exists flash_drops_discount_coherence_check;

alter table public.flash_drops
  add constraint flash_drops_discount_coherence_check
  check (
    (
      kind = 'discount'
      and discount_value is not null
      and discount_unit is not null
    )
    or (kind <> 'discount')
  );

alter table public.flash_drops
  drop constraint if exists flash_drops_special_price_coherence_check;

alter table public.flash_drops
  add constraint flash_drops_special_price_coherence_check
  check (
    (
      kind = 'special_price'
      and discount_value is not null
      and discount_unit = 'eur'
    )
    or (kind <> 'special_price')
  );

comment on column public.flash_drops.stopped_at is
  'When set, drop is no longer claimable/redeemable (manual stop).';

-- ---------------------------------------------------------------------------
-- 2) drop_codes
-- ---------------------------------------------------------------------------
create table if not exists public.drop_codes (
  id uuid primary key default gen_random_uuid(),
  flash_drop_id uuid not null references public.flash_drops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  code char(6) not null,
  status text not null default 'issued'
    check (status in ('issued', 'redeemed', 'cancelled')),
  issued_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users (id) on delete set null,
  unique (code),
  unique (flash_drop_id, user_id)
);

create index if not exists drop_codes_flash_drop_id_idx
  on public.drop_codes (flash_drop_id);

create index if not exists drop_codes_user_id_idx
  on public.drop_codes (user_id);

create index if not exists drop_codes_status_idx
  on public.drop_codes (status);

comment on table public.drop_codes is
  'Personal redemption codes (6 chars, display XX-####). One issued row per user per drop.';

alter table public.drop_codes enable row level security;

drop policy if exists "Users read own drop codes" on public.drop_codes;
create policy "Users read own drop codes"
  on public.drop_codes for select
  using (auth.uid() = user_id);

drop policy if exists "Place members read drop codes" on public.drop_codes;
create policy "Place members read drop codes"
  on public.drop_codes for select
  using (
    exists (
      select 1
      from public.flash_drops fd
      where fd.id = drop_codes.flash_drop_id
        and public.has_place_role(fd.place_id, array['owner', 'manager', 'staff'])
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Helpers
-- ---------------------------------------------------------------------------
create or replace function public.format_drop_code(p_code char(6))
returns text
language sql
immutable
as $$
  select upper(substring(p_code from 1 for 2)) || '-' || substring(p_code from 3 for 4);
$$;

create or replace function public.normalize_drop_code_input(p_raw text)
returns char(6)
language plpgsql
immutable
as $$
declare
  v_clean text;
begin
  v_clean := upper(regexp_replace(coalesce(p_raw, ''), '[^A-Z0-9]', '', 'g'));
  if length(v_clean) <> 6 then
    return null;
  end if;
  return v_clean::char(6);
end;
$$;

create or replace function public.generate_drop_code_value()
returns char(6)
language plpgsql
volatile
set search_path = public
as $$
declare
  -- No ambiguous 0/O, 1/I/L
  v_letters constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ';
  v_digits constant text := '23456789';
  v_out text := '';
  v_i integer;
  v_attempt integer := 0;
begin
  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 80 then
      raise exception 'drop_codes: could not allocate unique code';
    end if;

    v_out := '';
    for v_i in 1..2 loop
      v_out := v_out || substr(v_letters, 1 + floor(random() * length(v_letters))::integer, 1);
    end for;
    for v_i in 1..4 loop
      v_out := v_out || substr(v_digits, 1 + floor(random() * length(v_digits))::integer, 1);
    end for;

    exit when not exists (
      select 1 from public.drop_codes dc where dc.code = v_out::char(6)
    );
  end loop;

  return v_out::char(6);
end;
$$;

create or replace function public.flash_drop_is_live(p_drop public.flash_drops)
returns boolean
language sql
stable
as $$
  select
    p_drop.is_active
    and p_drop.stopped_at is null
    and p_drop.starts_at <= now()
    and p_drop.ends_at > now();
$$;

create or replace function public.paris_day_bounds(p_now timestamptz default now())
returns table (day_start timestamptz, day_end timestamptz)
language sql
stable
as $$
  select
    (date_trunc('day', p_now at time zone 'Europe/Paris') at time zone 'Europe/Paris') as day_start,
    ((date_trunc('day', p_now at time zone 'Europe/Paris') + interval '1 day')
      at time zone 'Europe/Paris') as day_end;
$$;

-- ---------------------------------------------------------------------------
-- 4) claim_drop
-- ---------------------------------------------------------------------------
create or replace function public.claim_drop(p_drop uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_drop public.flash_drops%rowtype;
  v_place_status text;
  v_existing public.drop_codes%rowtype;
  v_code char(6);
  v_row public.drop_codes%rowtype;
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

revoke all on function public.claim_drop(uuid) from public;
grant execute on function public.claim_drop(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) redeem_drop_code
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
  -- Phase 2a grains reward (matches flash_drops.grains_reward default).
  c_flash_drop_grains constant integer := 10;

  v_actor uuid := auth.uid();
  v_norm char(6);
  v_dc public.drop_codes%rowtype;
  v_drop public.flash_drops%rowtype;
  v_prev_name text;
  v_reward integer;
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

  v_reward := coalesce(v_drop.grains_reward, c_flash_drop_grains);

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

  insert into public.grains_transactions (user_id, amount, reason, ref_id)
  values (v_dc.user_id, v_reward, 'flash_drop', v_dc.id);

  update public.profiles
  set grains_balance = coalesce(grains_balance, 0) + v_reward
  where id = v_dc.user_id;

  return json_build_object(
    'ok', true,
    'status', 'ok',
    'drop_code_id', v_dc.id,
    'flash_drop_id', v_drop.id,
    'title', v_drop.title,
    'grains_awarded', v_reward,
    'code_display', public.format_drop_code(v_dc.code)
  );
end;
$$;

revoke all on function public.redeem_drop_code(uuid, text) from public;
grant execute on function public.redeem_drop_code(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) cancel_redemption / stop_drop / add_drop_places
-- ---------------------------------------------------------------------------
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
  c_flash_drop_grains constant integer := 10;
  v_actor uuid := auth.uid();
  v_norm char(6);
  v_dc public.drop_codes%rowtype;
  v_drop public.flash_drops%rowtype;
  v_reward integer;
  v_grains_row public.grains_transactions%rowtype;
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

  select * into v_grains_row
  from public.grains_transactions gt
  where gt.ref_id = v_dc.id
    and gt.reason = 'flash_drop'
    and gt.amount > 0
  order by gt.created_at desc
  limit 1;

  v_reward := coalesce(v_grains_row.amount, coalesce(v_drop.grains_reward, c_flash_drop_grains));

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

  insert into public.grains_transactions (user_id, amount, reason, ref_id)
  values (v_dc.user_id, -v_reward, 'flash_drop', v_dc.id);

  update public.profiles
  set grains_balance = greatest(0, coalesce(grains_balance, 0) - v_reward)
  where id = v_dc.user_id;

  return json_build_object('ok', true, 'drop_code_id', v_dc.id, 'grains_reversed', v_reward);
end;
$$;

revoke all on function public.cancel_redemption(uuid, text) from public;
grant execute on function public.cancel_redemption(uuid, text) to authenticated;

create or replace function public.stop_drop(p_drop uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_drop public.flash_drops%rowtype;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select fd.* into v_drop
  from public.flash_drops fd
  where fd.id = p_drop
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if not public.has_place_role(v_drop.place_id, array['owner', 'manager']) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  update public.flash_drops
  set stopped_at = coalesce(stopped_at, now()), updated_at = now()
  where id = p_drop;

  return json_build_object('ok', true, 'flash_drop_id', p_drop, 'stopped_at', now());
end;
$$;

revoke all on function public.stop_drop(uuid) from public;
grant execute on function public.stop_drop(uuid) to authenticated;

create or replace function public.add_drop_places(p_drop uuid, p_n integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drop public.flash_drops%rowtype;
  v_new_max integer;
begin
  if p_n is null or p_n <= 0 then
    return json_build_object('ok', false, 'error', 'invalid_n');
  end if;

  select fd.* into v_drop
  from public.flash_drops fd
  where fd.id = p_drop
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if not public.has_place_role(v_drop.place_id, array['owner', 'manager']) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_new_max := coalesce(v_drop.max_uses, 0) + p_n;

  update public.flash_drops
  set max_uses = v_new_max, updated_at = now()
  where id = p_drop;

  return json_build_object(
    'ok', true,
    'flash_drop_id', p_drop,
    'max_uses', v_new_max
  );
end;
$$;

revoke all on function public.add_drop_places(uuid, integer) from public;
grant execute on function public.add_drop_places(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) vendor_today_stats(p_place) — Europe/Paris + validation list
-- ---------------------------------------------------------------------------
drop function if exists public.vendor_today_stats();

create or replace function public.vendor_today_stats(p_place uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_start timestamptz;
  v_end timestamptz;
  v_count integer;
  v_grains integer;
  v_rows json;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if not public.has_place_role(p_place, array['owner', 'manager', 'staff']) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select pb.day_start, pb.day_end into v_start, v_end
  from public.paris_day_bounds(now()) pb;

  select
    count(*)::integer,
    coalesce(sum(gt.amount), 0)::integer
  into v_count, v_grains
  from public.drop_codes dc
  join public.flash_drops fd on fd.id = dc.flash_drop_id
  left join public.grains_transactions gt
    on gt.ref_id = dc.id
   and gt.reason = 'flash_drop'
   and gt.amount > 0
  where fd.place_id = p_place
    and dc.status = 'redeemed'
    and dc.redeemed_at >= v_start
    and dc.redeemed_at < v_end;

  select coalesce(json_agg(row_to_json(t) order by t.sort_at desc), '[]'::json)
  into v_rows
  from (
    select
      dc.redeemed_at as sort_at,
      to_char(dc.redeemed_at at time zone 'Europe/Paris', 'HH24:MI') as time,
      fd.title as drop,
      public.format_drop_code(dc.code) as code,
      coalesce(
        nullif(trim(pr.full_name), ''),
        split_part(u.email, '@', 1),
        '—'
      ) as validator
    from public.drop_codes dc
    join public.flash_drops fd on fd.id = dc.flash_drop_id
    left join public.profiles pr on pr.id = dc.redeemed_by
    left join auth.users u on u.id = dc.redeemed_by
    where fd.place_id = p_place
      and dc.status = 'redeemed'
      and dc.redeemed_at >= v_start
      and dc.redeemed_at < v_end
    order by dc.redeemed_at desc
    limit 50
  ) t;

  return json_build_object(
    'ok', true,
    'validations_today', v_count,
    'grains_awarded_today', v_grains,
    'timezone', 'Europe/Paris',
    'validations', v_rows
  );
end;
$$;

revoke all on function public.vendor_today_stats(uuid) from public;
grant execute on function public.vendor_today_stats(uuid) to authenticated;

comment on function public.vendor_today_stats(uuid) is
  'Stats + liste des validations drop_codes du jour (calendrier Europe/Paris).';
