-- « Le pouls du café » : one model for « is this café good for X? ».
--
-- Specificities use the onboarding vocabulary (wifi, plugs, calm, laptop,
-- terrace, matcha, specialty, brunch, events). The café declares them, the
-- community confirms or disputes them with Yes / No votes, only on site
-- (a check-in at the café in the last 3 h). The live crowd stays in
-- check_ins / get_place_vibes().
--
-- Replaces the trophies (place_endorsements, positive votes only): their rows
-- are copied as Yes votes; the table is kept but no longer written by the app.
--
-- Impact ERP / Souley: new tables place_spec_votes and place_spec_declarations
-- (read the consolidated state with get_place_specs()), new ledger reason
-- 'spec_vote'. place_endorsements is frozen.

-- ---------------------------------------------------------------------------
-- 1. Vocabulary
-- ---------------------------------------------------------------------------
create or replace function public.place_spec_ids()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['wifi', 'plugs', 'calm', 'laptop', 'terrace', 'matcha',
               'specialty', 'brunch', 'events']::text[];
$$;

comment on function public.place_spec_ids() is
  'Specificity ids, same vocabulary as the onboarding needs / envies.';

-- ---------------------------------------------------------------------------
-- 2. Votes (community, on site) and declarations (café)
-- ---------------------------------------------------------------------------
create table if not exists public.place_spec_votes (
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  spec text not null check (spec = any (public.place_spec_ids())),
  vote boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (place_id, user_id, spec)
);

create index if not exists place_spec_votes_place_idx
  on public.place_spec_votes (place_id, spec, updated_at desc);
create index if not exists place_spec_votes_user_idx
  on public.place_spec_votes (user_id, updated_at desc);

comment on table public.place_spec_votes is
  'Yes / No on a café specificity, one per user and spec. Written only by vote_place_spec().';

alter table public.place_spec_votes enable row level security;

drop policy if exists "Users read own spec votes" on public.place_spec_votes;
create policy "Users read own spec votes"
  on public.place_spec_votes for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.place_spec_votes from anon, authenticated;

create table if not exists public.place_spec_declarations (
  place_id uuid not null references public.places (id) on delete cascade,
  spec text not null check (spec = any (public.place_spec_ids())),
  -- true: « on a », false: « on n'a pas ».
  value boolean not null,
  declared_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (place_id, spec)
);

comment on table public.place_spec_declarations is
  'What the café says about itself. Written only by declare_place_spec().';

alter table public.place_spec_declarations enable row level security;

-- Team members see who declared what; everyone else reads get_place_specs().
drop policy if exists "Place team reads declarations" on public.place_spec_declarations;
create policy "Place team reads declarations"
  on public.place_spec_declarations for select
  using (public.has_place_role(place_id, array['owner', 'manager', 'staff']));

revoke insert, update, delete on public.place_spec_declarations from anon, authenticated;

-- Seed declarations from the café columns that carry real information
-- (laptop_policy and noise_level have defaults, so only explicit values count).
insert into public.place_spec_declarations (place_id, spec, value)
select id, 'plugs', true from public.places where has_plugs is true
union all
select id, 'wifi', true from public.places where wifi_speed in ('fast', 'fiber')
union all
select id, 'calm', true from public.places where noise_level = 'quiet'
union all
select id, 'laptop', false from public.places where laptop_policy = 'none'
on conflict (place_id, spec) do nothing;

-- Trophies become Yes votes.
insert into public.place_spec_votes (place_id, user_id, spec, vote, created_at, updated_at)
select e.place_id, e.user_id,
  case e.category
    when 'wifi' then 'wifi'
    when 'coffee' then 'specialty'
    when 'comfort' then 'calm'
    when 'food' then 'brunch'
  end,
  true, e.created_at, e.created_at
from public.place_endorsements e
where e.category in ('wifi', 'coffee', 'comfort', 'food')
on conflict (place_id, user_id, spec) do nothing;

-- The app no longer writes trophies.
revoke insert, update, delete on public.place_endorsements from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Ledger reason for votes
-- ---------------------------------------------------------------------------
alter table public.grains_transactions
  drop constraint if exists grains_transactions_reason_check;
alter table public.grains_transactions
  add constraint grains_transactions_reason_check
  check (reason = any (array['welcome', 'check_in', 'flash_drop', 'endorsement',
                             'adjustment', 'spec_vote']));

-- ---------------------------------------------------------------------------
-- 4. vote_place_spec(): on site only, Grains through the ledger
-- ---------------------------------------------------------------------------
create or replace function public.vote_place_spec(
  p_place uuid,
  p_spec text,
  p_vote boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  -- A vote needs a check-in at this café within this window.
  c_presence_window constant interval := interval '3 hours';
  c_reward constant integer := 5;
  -- Max rewarded votes per user per rolling 24 h.
  c_daily_rewards constant integer := 6;
  -- The same vote is rewarded again only after this delay (re-confirmation).
  c_revote_after constant interval := interval '30 days';

  v_uid uuid := auth.uid();
  v_previous timestamptz;
  v_reward integer := 0;
  v_reason text := 'ok';
  v_today integer;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_spec is null or not (p_spec = any (public.place_spec_ids())) or p_vote is null then
    return json_build_object('ok', false, 'error', 'invalid_input');
  end if;
  if not exists (
    select 1 from public.check_ins c
    where c.user_id = v_uid
      and c.place_id = p_place
      and c.created_at > now() - c_presence_window
  ) then
    return json_build_object('ok', false, 'error', 'not_here');
  end if;

  perform pg_advisory_xact_lock(hashtext('spec_vote:' || v_uid::text));

  select updated_at into v_previous
  from public.place_spec_votes
  where place_id = p_place and user_id = v_uid and spec = p_spec;

  if v_previous is not null and v_previous > now() - c_revote_after then
    v_reason := 'already_voted';
  else
    select count(*)::integer into v_today
    from public.grains_transactions gt
    where gt.user_id = v_uid
      and gt.reason = 'spec_vote'
      and gt.created_at > now() - interval '24 hours';
    if v_today >= c_daily_rewards then
      v_reason := 'daily_cap';
    else
      v_reward := c_reward;
    end if;
  end if;

  insert into public.place_spec_votes (place_id, user_id, spec, vote)
  values (p_place, v_uid, p_spec, p_vote)
  on conflict (place_id, user_id, spec)
  do update set vote = excluded.vote, updated_at = now();

  if v_reward > 0 then
    insert into public.grains_transactions (user_id, amount, reason, ref_id)
    values (v_uid, v_reward, 'spec_vote', p_place);

    update public.profiles
    set grains_balance = coalesce(grains_balance, 0) + v_reward
    where id = v_uid;
  end if;

  return json_build_object('ok', true, 'grains_awarded', v_reward, 'reason', v_reason);
end;
$$;

comment on function public.vote_place_spec(uuid, text, boolean) is
  'Yes / No on a specificity, after a check-in at the café (3 h). +5 Grains, max 6 rewarded per 24 h, once per spec per 30 days.';

revoke all on function public.vote_place_spec(uuid, text, boolean) from public, anon;
grant execute on function public.vote_place_spec(uuid, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. declare_place_spec(): owner / manager only, null removes
-- ---------------------------------------------------------------------------
create or replace function public.declare_place_spec(
  p_place uuid,
  p_spec text,
  p_value boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if not public.has_place_role(p_place, array['owner', 'manager']) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_spec is null or not (p_spec = any (public.place_spec_ids())) then
    return json_build_object('ok', false, 'error', 'invalid_input');
  end if;

  if p_value is null then
    delete from public.place_spec_declarations
    where place_id = p_place and spec = p_spec;
  else
    insert into public.place_spec_declarations (place_id, spec, value, declared_by)
    values (p_place, p_spec, p_value, auth.uid())
    on conflict (place_id, spec)
    do update set value = excluded.value, declared_by = excluded.declared_by,
                  updated_at = now();
  end if;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.declare_place_spec(uuid, text, boolean) from public, anon;
grant execute on function public.declare_place_spec(uuid, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. get_place_specs(): consolidated state, public, no user ids
-- ---------------------------------------------------------------------------
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
  -- Votes older than 180 days are ignored; votes older than 30 days count half.
  -- confirmed: >= 3 Yes and Yes weight >= 2 x No weight
  -- disputed:  >= 2 No and No weight >= Yes weight
  -- declared:  the café says yes, not (yet) confirmed nor disputed
  -- absent:    the café says no, not confirmed by the community
  -- pending:   some votes, not enough to conclude (« À vérifier »)
  with v as (
    select sv.place_id, sv.spec,
      count(*) filter (where sv.vote)::integer as yes_votes,
      count(*) filter (where not sv.vote)::integer as no_votes,
      coalesce(sum(case when sv.updated_at > now() - interval '30 days' then 1.0 else 0.5 end)
        filter (where sv.vote), 0) as yes_w,
      coalesce(sum(case when sv.updated_at > now() - interval '30 days' then 1.0 else 0.5 end)
        filter (where not sv.vote), 0) as no_w,
      max(sv.updated_at) as last_vote_at
    from public.place_spec_votes sv
    where sv.updated_at > now() - interval '180 days'
      and (p_place is null or sv.place_id = p_place)
    group by sv.place_id, sv.spec
  ),
  d as (
    select pd.place_id, pd.spec, pd.value
    from public.place_spec_declarations pd
    where p_place is null or pd.place_id = p_place
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

comment on function public.get_place_specs(uuid) is
  'Consolidated specificities per café (declarations + votes). Public, no user ids.';

revoke all on function public.get_place_specs(uuid) from public;
grant execute on function public.get_place_specs(uuid) to anon, authenticated;
