-- Drops as events first: an event category on activity drops, and
-- « Je participe » (participations with an optional number of places).
--
-- An event is a flash_drops row with kind = 'activity' (value kept so the
-- ERP keeps working). Its places use the existing max_uses column.
--
-- Impact ERP / Souley: new nullable column flash_drops.event_category and new
-- table drop_participations (read the counts with drop_participants()).

-- ---------------------------------------------------------------------------
-- 1. Event category
-- ---------------------------------------------------------------------------
alter table public.flash_drops
  add column if not exists event_category text;

alter table public.flash_drops
  drop constraint if exists flash_drops_event_category_check;
alter table public.flash_drops
  add constraint flash_drops_event_category_check
  check (
    event_category is null
    or (
      kind = 'activity'
      and event_category in ('sport', 'music', 'workshop', 'meetup', 'tasting', 'other')
    )
  );

comment on column public.flash_drops.event_category is
  'Events only (kind = activity): sport, music, workshop, meetup, tasting, other.';

-- ---------------------------------------------------------------------------
-- 2. Participations
-- ---------------------------------------------------------------------------
create table if not exists public.drop_participations (
  flash_drop_id uuid not null references public.flash_drops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (flash_drop_id, user_id)
);

create index if not exists drop_participations_user_idx
  on public.drop_participations (user_id, created_at desc);

comment on table public.drop_participations is
  '« Je participe » on event drops. Written only by join_drop / leave_drop.';

alter table public.drop_participations enable row level security;

drop policy if exists "Users read own participations" on public.drop_participations;
create policy "Users read own participations"
  on public.drop_participations for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.drop_participations from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. join_drop / leave_drop
-- ---------------------------------------------------------------------------
create or replace function public.join_drop(p_drop uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_drop public.flash_drops%rowtype;
  v_count integer;
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

  insert into public.drop_participations (flash_drop_id, user_id)
  values (p_drop, v_uid);

  return json_build_object(
    'ok', true, 'joined', true, 'participants', v_count + 1, 'capacity', v_drop.max_uses
  );
end;
$$;

create or replace function public.leave_drop(p_drop uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  delete from public.drop_participations
  where flash_drop_id = p_drop and user_id = v_uid;

  select count(*)::integer into v_count
  from public.drop_participations where flash_drop_id = p_drop;

  return json_build_object('ok', true, 'joined', false, 'participants', v_count);
end;
$$;

revoke all on function public.join_drop(uuid) from public, anon;
revoke all on function public.leave_drop(uuid) from public, anon;
grant execute on function public.join_drop(uuid) to authenticated;
grant execute on function public.leave_drop(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Public counts (no user ids)
-- ---------------------------------------------------------------------------
create or replace function public.drop_participants(p_drops uuid[])
returns table (flash_drop_id uuid, participants integer)
language sql
stable
security definer
set search_path = public
as $$
  select dp.flash_drop_id, count(*)::integer
  from public.drop_participations dp
  where dp.flash_drop_id = any (p_drops)
  group by dp.flash_drop_id;
$$;

comment on function public.drop_participants(uuid[]) is
  'Number of participants per event drop. Public, returns no user ids.';

revoke all on function public.drop_participants(uuid[]) from public;
grant execute on function public.drop_participants(uuid[]) to anon, authenticated;
