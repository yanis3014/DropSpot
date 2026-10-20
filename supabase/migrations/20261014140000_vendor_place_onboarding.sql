-- Onboarding vendor : lire les spots libres, les revendiquer, en créer de nouveaux.

alter table public.places enable row level security;

-- Lecture publique (carte / feed) — requise dès que RLS est actif
drop policy if exists "Anyone can read places" on public.places;
create policy "Anyone can read places"
  on public.places for select
  using (true);

-- Création d'un établissement par le vendor connecté
drop policy if exists "Vendors insert own places" on public.places;
create policy "Vendors insert own places"
  on public.places for insert
  with check (
    auth.uid() = vendor_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('vendor', 'owner')
    )
  );

-- Mise à jour de ses propres spots (déjà présente — recrée pour idempotence)
drop policy if exists "Vendors update own places" on public.places;
create policy "Vendors update own places"
  on public.places for update
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

-- Revendication : passer vendor_id de NULL → auth.uid()
drop policy if exists "Vendors claim unclaimed places" on public.places;
create policy "Vendors claim unclaimed places"
  on public.places for update
  using (
    vendor_id is null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('vendor', 'owner')
    )
  )
  with check (auth.uid() = vendor_id);

create index if not exists places_unclaimed_name_idx
  on public.places (name)
  where vendor_id is null;
