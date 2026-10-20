-- vendor_id sur places (canonique dashboard-pro ; migre depuis owner_id si présent)
alter table public.places
  add column if not exists vendor_id uuid references auth.users (id) on delete set null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'places' and column_name = 'owner_id'
  ) then
    update public.places
    set vendor_id = owner_id
    where vendor_id is null and owner_id is not null;
  end if;
end $$;

create index if not exists places_vendor_id_idx on public.places (vendor_id);

-- Flash Drops publiés par les restaurateurs
create table if not exists public.flash_drops (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flash_drops_vendor_id_idx on public.flash_drops (vendor_id);
create index if not exists flash_drops_place_id_idx on public.flash_drops (place_id);
create index if not exists flash_drops_active_ends_at_idx
  on public.flash_drops (is_active, ends_at desc);

comment on table public.flash_drops is
  'Promos flash créées depuis /dashboard-pro ; visibles côté app si is_active et ends_at > now()';

alter table public.flash_drops enable row level security;

-- Lecture publique des flash drops actifs (feed client)
drop policy if exists "Anyone can read active flash drops" on public.flash_drops;
create policy "Anyone can read active flash drops"
  on public.flash_drops for select
  using (true);

-- Le vendor gère ses propres flash drops
drop policy if exists "Vendors insert own flash drops" on public.flash_drops;
create policy "Vendors insert own flash drops"
  on public.flash_drops for insert
  with check (auth.uid() = vendor_id);

drop policy if exists "Vendors update own flash drops" on public.flash_drops;
create policy "Vendors update own flash drops"
  on public.flash_drops for update
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

drop policy if exists "Vendors delete own flash drops" on public.flash_drops;
create policy "Vendors delete own flash drops"
  on public.flash_drops for delete
  using (auth.uid() = vendor_id);

-- Vendors peuvent mettre à jour leurs places
drop policy if exists "Vendors update own places" on public.places;
create policy "Vendors update own places"
  on public.places for update
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

drop trigger if exists flash_drops_set_updated_at on public.flash_drops;
create trigger flash_drops_set_updated_at
  before update on public.flash_drops
  for each row execute function public.set_updated_at();
