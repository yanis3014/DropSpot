-- Performance: cache the café specificity scores and the « Top de Nice » ranks.
--
-- Load test (local copy of the schema, 1 000 cafés, 400 000 votes, 1,5 M
-- check-ins) showed that every map opening, café sheet and Top page
-- recomputed the scores of ALL cafés from ALL votes of the last 180 days:
--   get_place_specs()      ~125 ms  (map, list: once per opening)
--   get_place_ranks(id)    ~145 ms  (café sheet)
--   get_spec_rankings(..)  ~280 ms  (Top de Nice: computes twice, now and -7 d)
--   get_place_vibes()      ~60 ms   (map: full scan of check_ins, no index on created_at)
-- On 2 cores the database saturated at ~6 screens per second.
--
-- Fix:
--   1. spec_scores_cache and spec_ranks_cache, refreshed by
--      refresh_spec_caches() every SPEC_CACHE_REFRESH_MINUTES (pg_cron).
--   2. get_place_specs() without a café, get_place_ranks() and
--      get_spec_rankings() read the cache. get_place_specs(<café>) stays live,
--      so a voter sees their vote on the café sheet immediately.
--   3. Index on check_ins(created_at) for the 3 h vibe window.
--
-- Same function signatures and result columns: nothing changes for the app or
-- the ERP, except that the map pins and the ranks can lag up to 5 minutes
-- behind a vote.

-- ---------------------------------------------------------------------------
-- 1. Index for the live vibe window (get_place_vibes without a café)
-- ---------------------------------------------------------------------------
create index if not exists check_ins_created_at_idx
  on public.check_ins (created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Cache tables (server-only: RLS on, no policy, no grant)
-- ---------------------------------------------------------------------------
create table if not exists public.spec_scores_cache (
  place_id uuid not null references public.places (id) on delete cascade,
  spec text not null,
  declared boolean not null,
  yes_votes integer not null,
  no_votes integer not null,
  score numeric not null,
  status text not null,
  last_vote_at timestamptz,
  primary key (place_id, spec)
);

create table if not exists public.spec_ranks_cache (
  -- 'now' = current ranks, 'week_ago' = ranks 7 days ago (Top de Nice arrows).
  period text not null check (period in ('now', 'week_ago')),
  place_id uuid not null references public.places (id) on delete cascade,
  spec text not null,
  score numeric not null,
  yes_votes integer not null,
  rank integer not null,
  primary key (period, spec, place_id)
);

create index if not exists spec_ranks_cache_place_idx
  on public.spec_ranks_cache (period, place_id);

create table if not exists public.spec_cache_state (
  id boolean primary key default true check (id),
  refreshed_at timestamptz not null
);

alter table public.spec_scores_cache enable row level security;
alter table public.spec_ranks_cache enable row level security;
alter table public.spec_cache_state enable row level security;

revoke all on public.spec_scores_cache from public, anon, authenticated;
revoke all on public.spec_ranks_cache from public, anon, authenticated;
revoke all on public.spec_cache_state from public, anon, authenticated;

comment on table public.spec_scores_cache is
  'Copy of spec_scores_at(now()) for every café, rebuilt by refresh_spec_caches(). Read through get_place_specs().';
comment on table public.spec_ranks_cache is
  'Copy of spec_ranks_at(now()) and spec_ranks_at(now() - 7 days), rebuilt by refresh_spec_caches(). Read through get_spec_rankings() and get_place_ranks().';

-- ---------------------------------------------------------------------------
-- 3. Refresh (one transaction: readers see the old or the new cache, never half)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_spec_caches()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  -- Two refreshes at once would only redo the same work.
  if not pg_try_advisory_xact_lock(hashtext('refresh_spec_caches')) then
    return;
  end if;

  delete from public.spec_scores_cache;
  insert into public.spec_scores_cache
    (place_id, spec, declared, yes_votes, no_votes, score, status, last_vote_at)
  select s.place_id, s.spec, s.declared, s.yes_votes, s.no_votes, s.score, s.status, s.last_vote_at
  from public.spec_scores_at(v_now, null) s
  where s.place_id is not null and s.spec is not null;

  delete from public.spec_ranks_cache;
  insert into public.spec_ranks_cache (period, place_id, spec, score, yes_votes, rank)
  select 'now', r.place_id, r.spec, r.score, r.yes_votes, r.rank
  from public.spec_ranks_at(v_now) r
  union all
  select 'week_ago', r.place_id, r.spec, r.score, r.yes_votes, r.rank
  from public.spec_ranks_at(v_now - interval '7 days') r;

  insert into public.spec_cache_state (id, refreshed_at)
  values (true, v_now)
  on conflict (id) do update set refreshed_at = excluded.refreshed_at;
end;
$$;

revoke all on function public.refresh_spec_caches() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Readers (same signatures and columns as before)
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
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_place is not null then
    -- One café: live, so a vote shows at once on the café sheet.
    return query select * from public.spec_scores_at(now(), p_place);
  else
    -- Every café (map, list): cached.
    return query
    select c.place_id, c.spec, c.declared, c.yes_votes, c.no_votes, c.score, c.status, c.last_vote_at
    from public.spec_scores_cache c;
  end if;
end;
$$;

revoke all on function public.get_place_specs(uuid) from public;
grant execute on function public.get_place_specs(uuid) to anon, authenticated;

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
  select n.place_id, p.name, p.image_url, p.city, n.score, n.yes_votes, n.rank, w.rank
  from public.spec_ranks_cache n
  join public.places p on p.id = n.place_id
  left join public.spec_ranks_cache w
    on w.period = 'week_ago' and w.spec = n.spec and w.place_id = n.place_id
  where n.period = 'now' and n.spec = p_spec
  order by n.rank, p.name
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

comment on function public.get_spec_rankings(text, integer) is
  '« Top de Nice » for one specificity, with last week''s rank. Public, no user ids. Read from spec_ranks_cache (refreshed every few minutes).';

revoke all on function public.get_spec_rankings(text, integer) from public;
grant execute on function public.get_spec_rankings(text, integer) to anon, authenticated;

create or replace function public.get_place_ranks(p_place uuid)
returns table (spec text, rank integer, total integer)
language sql
stable
security definer
set search_path = public
as $$
  select r.spec, r.rank,
    (select count(*)::integer from public.spec_ranks_cache r2
     where r2.period = 'now' and r2.spec = r.spec) as total
  from public.spec_ranks_cache r
  where r.period = 'now' and r.place_id = p_place;
$$;

revoke all on function public.get_place_ranks(uuid) from public;
grant execute on function public.get_place_ranks(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Schedule (pg_cron) and first fill
-- ---------------------------------------------------------------------------
-- SPEC_CACHE_REFRESH_MINUTES = 5. pg_cron must be enabled in Supabase
-- (Database > Extensions). Where it is missing (local test database), the
-- cache is only filled here and by calling refresh_spec_caches() by hand.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'refresh_spec_caches';
    perform cron.schedule('refresh_spec_caches', '*/5 * * * *', 'select public.refresh_spec_caches()');
  else
    raise notice 'pg_cron not available: refresh_spec_caches() is not scheduled';
  end if;
end;
$$;

select public.refresh_spec_caches();
