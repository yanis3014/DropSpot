-- Onboarding B2C enrichi : réponses JSON + bonus de bienvenue (50 Grains)

alter table public.profiles
  add column if not exists grains_balance integer not null default 0;

alter table public.profiles
  add column if not exists onboarding_answers jsonb not null default '{}'::jsonb;

alter table public.profiles
  add column if not exists welcome_grains_claimed_at timestamptz;

comment on column public.profiles.onboarding_answers is
  'Réponses du tunnel /onboarding : mood, wifi, ambiances, drinks, zones, geoEnabled, avatarPreset';

comment on column public.profiles.welcome_grains_claimed_at is
  'Horodatage du bonus +50 Grains de première connexion (une seule fois)';

comment on column public.profiles.preferences is
  'PreferenceId[] dérivés du wizard (remote, brunch, sport, specialty, events, chill) pour le matching feed/carte';
