-- Rich place details, filled manually in Supabase until the vendor dashboard exists.
alter table public.places
  add column if not exists description text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists postal_code text;

comment on column public.places.description is
  'Histoire du café, ambiance, équipements. Texte libre, les retours à la ligne sont conservés.';
