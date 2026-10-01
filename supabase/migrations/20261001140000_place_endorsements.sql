-- Trophy endorsements (one vote per user / place / category).
create table if not exists public.place_endorsements (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('wifi', 'coffee', 'comfort', 'food')),
  created_at timestamptz not null default now(),
  unique (place_id, user_id, category)
);

create index if not exists place_endorsements_place_created_idx
  on public.place_endorsements (place_id, created_at desc);

create index if not exists place_endorsements_place_category_idx
  on public.place_endorsements (place_id, category);

comment on table public.place_endorsements is
  'Community trophy votes per place (wifi, coffee, comfort, food). One vote per category per user.';

alter table public.place_endorsements enable row level security;

drop policy if exists "Anyone can read endorsements" on public.place_endorsements;
create policy "Anyone can read endorsements"
  on public.place_endorsements for select
  using (true);

drop policy if exists "Users can insert own endorsements" on public.place_endorsements;
create policy "Users can insert own endorsements"
  on public.place_endorsements for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own endorsements" on public.place_endorsements;
create policy "Users can delete own endorsements"
  on public.place_endorsements for delete
  using (auth.uid() = user_id);
