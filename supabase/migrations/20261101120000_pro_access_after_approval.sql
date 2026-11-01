-- Pro access only after an admin approved the café.
--
-- Before: a place_members row was enough (is_pro, has_place_role), even on a
-- café still waiting for review ('pending') or never verified.
-- After: pro rights need a membership on a 'verified' café. A café becomes
-- 'verified' only through approve_claim (admin).
--
-- Also adds:
--   * place_claims.welcomed_at: the gérant has seen the "welcome" screen
--     after approval (shown once, on any device).
--   * pro_access_status(): one call telling the app where the user stands
--     (none / pending / welcome / active).
--   * mark_pro_welcome_seen(): sets welcomed_at for the caller's approved claims.
--   * place_claims in the realtime publication so the waiting screen hears
--     the approval live (RLS still applies: claimants see their own claims).

-- ---------------------------------------------------------------------------
-- 1) has_place_role: membership on a verified café only
-- ---------------------------------------------------------------------------
create or replace function public.has_place_role(
  p_place uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_place is not null
    and p_roles is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.place_members m
      join public.places p on p.id = m.place_id
      where m.place_id = p_place
        and m.user_id = auth.uid()
        and m.role = any (p_roles)
        and p.verification_status = 'verified'
    );
$$;

comment on function public.has_place_role(uuid, text[]) is
  'True when auth.uid() is a place_members row for p_place with role in p_roles, '
  'and the café was verified by an admin.';

-- ---------------------------------------------------------------------------
-- 2) is_pro: at least one membership on a verified café
-- ---------------------------------------------------------------------------
create or replace function public.is_pro(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user is not null
    and exists (
      select 1
      from public.place_members m
      join public.places p on p.id = m.place_id
      where m.user_id = p_user
        and p.verification_status = 'verified'
    );
$$;

comment on function public.is_pro(uuid) is
  'True when the user is a member of at least one verified café (B2B access).';

-- ---------------------------------------------------------------------------
-- 3) place_claims.welcomed_at
-- ---------------------------------------------------------------------------
alter table public.place_claims
  add column if not exists welcomed_at timestamptz;

comment on column public.place_claims.welcomed_at is
  'When the claimant saw the welcome screen after approval (null = not yet).';

-- Claims approved before this migration: their owners already use the pro
-- space, no welcome screen for them.
update public.place_claims
set welcomed_at = coalesce(reviewed_at, now())
where status = 'approved'
  and welcomed_at is null;

create index if not exists place_claims_user_welcome_idx
  on public.place_claims (user_id)
  where status = 'approved' and welcomed_at is null;

-- ---------------------------------------------------------------------------
-- 4) pro_access_status()
-- ---------------------------------------------------------------------------
create or replace function public.pro_access_status()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_active boolean;
  v_welcome json;
  v_pending json;
begin
  if v_uid is null then
    return json_build_object('state', 'none');
  end if;

  v_active := public.is_pro(v_uid);

  -- Approved claim not welcomed yet, on a café still verified and still theirs.
  select json_build_object(
    'claim_id', c.id,
    'place_id', p.id,
    'place_name', p.name
  )
  into v_welcome
  from public.place_claims c
  join public.places p on p.id = c.place_id
  join public.place_members m
    on m.place_id = c.place_id and m.user_id = v_uid
  where c.user_id = v_uid
    and c.status = 'approved'
    and c.welcomed_at is null
    and p.verification_status = 'verified'
  order by c.reviewed_at desc nulls last
  limit 1;

  select json_build_object(
    'claim_id', c.id,
    'place_id', p.id,
    'place_name', p.name,
    'created_at', c.created_at
  )
  into v_pending
  from public.place_claims c
  join public.places p on p.id = c.place_id
  where c.user_id = v_uid
    and c.status = 'pending'
  order by c.created_at desc
  limit 1;

  return json_build_object(
    'state',
    case
      when v_welcome is not null then 'welcome'
      when v_active then 'active'
      when v_pending is not null then 'pending'
      else 'none'
    end,
    'welcome', v_welcome,
    'pending', v_pending
  );
end;
$$;

comment on function public.pro_access_status() is
  'Where the caller stands in the pro space: none, pending (claim under '
  'review), welcome (approved, welcome screen not seen) or active.';

revoke all on function public.pro_access_status() from public, anon;
grant execute on function public.pro_access_status() to authenticated;

-- ---------------------------------------------------------------------------
-- 5) mark_pro_welcome_seen()
-- ---------------------------------------------------------------------------
create or replace function public.mark_pro_welcome_seen()
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

  update public.place_claims
  set welcomed_at = now()
  where user_id = v_uid
    and status = 'approved'
    and welcomed_at is null;

  get diagnostics v_count = row_count;
  return json_build_object('ok', true, 'updated', v_count);
end;
$$;

revoke all on function public.mark_pro_welcome_seen() from public, anon;
grant execute on function public.mark_pro_welcome_seen() to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Realtime: the waiting screen listens to its own claim
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'place_claims'
     ) then
    execute 'alter publication supabase_realtime add table public.place_claims';
  end if;
end;
$$;
