-- Rôle restaurateur pour l'espace /dashboard-pro
alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'vendor', 'owner'));

comment on column public.profiles.role is
  'user = consommateur, vendor/owner = accès dashboard-pro';

-- Lien optionnel place ↔ propriétaire (pour filtrer les spots du vendeur)
alter table public.places
  add column if not exists owner_id uuid references auth.users (id) on delete set null;

create index if not exists places_owner_id_idx on public.places (owner_id);
