-- Horaires affichés / éditables depuis le dashboard restaurateur
alter table public.places
  add column if not exists opening_hours text;

comment on column public.places.opening_hours is
  'Horaires en texte libre, ex: Lun–Ven 8h–18h · Sam 9h–14h';
