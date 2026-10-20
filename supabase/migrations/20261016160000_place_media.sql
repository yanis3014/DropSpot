-- Galerie multi-photos par établissement (lieu / plats / menu)

create table if not exists public.place_media (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  category text not null check (category in ('venue', 'food', 'menu')),
  url text not null,
  storage_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists place_media_place_category_sort_idx
  on public.place_media (place_id, category, sort_order);

comment on table public.place_media is
  'Photos d’un spot : venue (lieu), food (plats/boissons), menu (carte).';

alter table public.place_media enable row level security;

drop policy if exists "Anyone can read place media" on public.place_media;
create policy "Anyone can read place media"
  on public.place_media for select
  using (true);

drop policy if exists "Vendors insert place media" on public.place_media;
create policy "Vendors insert place media"
  on public.place_media for insert
  with check (
    exists (
      select 1 from public.places p
      where p.id = place_id
        and p.vendor_id = auth.uid()
    )
  );

drop policy if exists "Vendors update place media" on public.place_media;
create policy "Vendors update place media"
  on public.place_media for update
  using (
    exists (
      select 1 from public.places p
      where p.id = place_id
        and p.vendor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.places p
      where p.id = place_id
        and p.vendor_id = auth.uid()
    )
  );

drop policy if exists "Vendors delete place media" on public.place_media;
create policy "Vendors delete place media"
  on public.place_media for delete
  using (
    exists (
      select 1 from public.places p
      where p.id = place_id
        and p.vendor_id = auth.uid()
    )
  );
