-- Harden profiles Grains + role, ledger, and place-photos storage ownership.
-- Does NOT alter validate_flash_drop_code / vendor_today_stats (security definer
-- updates to grains_balance continue to work: this trigger only blocks
-- authenticated/anon direct writes).

-- ---------------------------------------------------------------------------
-- 1. Immutable Grains ledger
-- ---------------------------------------------------------------------------
create table if not exists public.grains_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null check (
    reason in ('welcome', 'check_in', 'flash_drop', 'endorsement', 'adjustment')
  ),
  ref_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists grains_transactions_user_created_idx
  on public.grains_transactions (user_id, created_at desc);

comment on table public.grains_transactions is
  'Ledger immuable des mouvements de Grains. Écrit uniquement via RPC security definer.';

alter table public.grains_transactions enable row level security;

drop policy if exists "Users read own grains transactions" on public.grains_transactions;
create policy "Users read own grains transactions"
  on public.grains_transactions for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies for clients (writes via security definer only).

-- ---------------------------------------------------------------------------
-- 2. Protect sensitive profile columns from direct client writes
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  -- Skip for security definer / service_role / table owner (postgres, etc.)
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.grains_balance := 0;
    new.welcome_grains_claimed_at := null;
    if new.role is null or new.role not in ('user', 'vendor') then
      raise exception
        'profiles.role must be user or vendor on insert (got %)',
        coalesce(new.role, 'null');
    end if;
    return new;
  end if;

  -- UPDATE
  if new.grains_balance is distinct from old.grains_balance then
    raise exception 'profiles.grains_balance is not client-writable';
  end if;

  if new.welcome_grains_claimed_at is distinct from old.welcome_grains_claimed_at then
    raise exception 'profiles.welcome_grains_claimed_at is not client-writable';
  end if;

  if new.role is distinct from old.role then
    -- Allowed only: user → vendor before onboarding is completed
    -- (pro signup flow in auth/callback + login).
    if not (
      old.role = 'user'
      and new.role = 'vendor'
      and old.onboarding_completed_at is null
    ) then
      raise exception
        'profiles.role change rejected (%/%, onboarding_completed_at=%)',
        old.role,
        new.role,
        old.onboarding_completed_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
  before insert or update on public.profiles
  for each row
  execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- 3. Server-side welcome Grains claim (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.claim_welcome_grains()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Must stay in sync with src/lib/onboarding.ts WELCOME_GRAINS
  welcome_grains constant integer := 50;
  v_uid uuid := auth.uid();
  v_claimed_at timestamptz;
  v_onboarding_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select welcome_grains_claimed_at, onboarding_completed_at
    into v_claimed_at, v_onboarding_at
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    return 0;
  end if;

  -- Onboarding must be completed first; already claimed → no-op
  if v_claimed_at is not null or v_onboarding_at is null then
    return 0;
  end if;

  insert into public.grains_transactions (user_id, amount, reason, ref_id)
  values (v_uid, welcome_grains, 'welcome', null);

  update public.profiles
  set
    grains_balance = coalesce(grains_balance, 0) + welcome_grains,
    welcome_grains_claimed_at = now()
  where id = v_uid;

  return welcome_grains;
end;
$$;

comment on function public.claim_welcome_grains() is
  'Crédite +50 Grains de bienvenue une seule fois après onboarding (WELCOME_GRAINS).';

revoke all on function public.claim_welcome_grains() from public;
grant execute on function public.claim_welcome_grains() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Storage place-photos: path must be {auth.uid}/{own place id}/...
-- ---------------------------------------------------------------------------
drop policy if exists "Vendors upload place photos" on storage.objects;
create policy "Vendors upload place photos"
  on storage.objects for insert
  with check (
    bucket_id = 'place-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.places p
      where p.id::text = (storage.foldername(name))[2]
        and p.vendor_id = auth.uid()
    )
  );

drop policy if exists "Vendors update place photos" on storage.objects;
create policy "Vendors update place photos"
  on storage.objects for update
  using (
    bucket_id = 'place-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.places p
      where p.id::text = (storage.foldername(name))[2]
        and p.vendor_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'place-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.places p
      where p.id::text = (storage.foldername(name))[2]
        and p.vendor_id = auth.uid()
    )
  );

drop policy if exists "Vendors delete place photos" on storage.objects;
create policy "Vendors delete place photos"
  on storage.objects for delete
  using (
    bucket_id = 'place-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.places p
      where p.id::text = (storage.foldername(name))[2]
        and p.vendor_id = auth.uid()
    )
  );

-- Public read policy ("Public read place photos") left unchanged.
