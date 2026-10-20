import type { PreferenceId } from '@/lib/preferences';

export const WELCOME_GRAINS = 50;

export type MoodId = 'work' | 'chill' | 'social' | 'explore';
export type WifiPriority = 'essential' | 'optional';
export type AmbianceId = 'calm' | 'terrace' | 'lively';
export type DrinkId = 'specialty' | 'matcha' | 'brunch' | 'fresh';
export type ZoneId = 'centre' | 'vieux' | 'gare' | 'sophia';
export type AvatarPreset = 'coffee' | 'leaf' | 'sun' | 'wave' | 'book' | 'bike';

export interface OnboardingAnswers {
  mood: MoodId | null;
  wifi: WifiPriority | null;
  ambiances: AmbianceId[];
  drinks: DrinkId[];
  zones: ZoneId[];
  geoEnabled: boolean;
  avatarPreset: AvatarPreset | null;
  welcomeBonus: boolean;
}

export const emptyOnboardingAnswers = (): OnboardingAnswers => ({
  mood: null,
  wifi: null,
  ambiances: [],
  drinks: [],
  zones: [],
  geoEnabled: false,
  avatarPreset: null,
  welcomeBonus: false,
});

export const MOOD_OPTIONS: {
  id: MoodId;
  emoji: string;
  label: string;
  hint: string;
}[] = [
  {
    id: 'work',
    emoji: '💻',
    label: 'Travailler / Coder',
    hint: 'Session focus, Wi-Fi & prises',
  },
  {
    id: 'chill',
    emoji: '☕',
    label: 'Pause café & Chill',
    hint: 'Lire un livre, décompresser',
  },
  {
    id: 'social',
    emoji: '👥',
    label: 'Rendez-vous / Papoter',
    hint: 'Entre amis ou en tête-à-tête',
  },
  {
    id: 'explore',
    emoji: '🗺️',
    label: 'Découvrir un lieu sympa',
    hint: 'Tourisme local & pépites',
  },
];

export const WIFI_OPTIONS: {
  id: WifiPriority;
  label: string;
  hint: string;
}[] = [
  {
    id: 'essential',
    label: 'Incontournables pour taffer',
    hint: 'Wi-Fi solide + prises',
  },
  {
    id: 'optional',
    label: 'Pas une priorité',
    hint: 'Je viens surtout pour l’ambiance',
  },
];

export const AMBIANCE_OPTIONS: {
  id: AmbianceId;
  emoji: string;
  label: string;
}[] = [
  { id: 'calm', emoji: '🌤️', label: 'Calme & Lumineux' },
  { id: 'terrace', emoji: '☀️', label: 'Terrasse & Soleil' },
  { id: 'lively', emoji: '🎵', label: 'Ambiance vivante & Musique' },
];

export const DRINK_OPTIONS: {
  id: DrinkId;
  emoji: string;
  label: string;
}[] = [
  { id: 'specialty', emoji: '☕', label: 'Specialty / Espresso' },
  { id: 'matcha', emoji: '🍵', label: 'Matcha / Chai' },
  { id: 'brunch', emoji: '🥐', label: 'Pâtisseries & Brunch' },
  { id: 'fresh', emoji: '🧃', label: 'Boissons fraîches' },
];

export const ZONE_OPTIONS: {
  id: ZoneId;
  label: string;
  hint: string;
}[] = [
  { id: 'centre', label: 'Nice Centre', hint: 'Jean Médecin' },
  { id: 'vieux', label: 'Vieux-Nice / Port', hint: 'Vieille ville' },
  { id: 'gare', label: 'Gare Thiers', hint: 'Quartier gare' },
  { id: 'sophia', label: 'Sophia / Biot', hint: 'Tech & campus' },
];

export const AVATAR_PRESETS: {
  id: AvatarPreset;
  emoji: string;
  label: string;
}[] = [
  { id: 'coffee', emoji: '☕', label: 'Café' },
  { id: 'leaf', emoji: '🌿', label: 'Vert' },
  { id: 'sun', emoji: '☀️', label: 'Soleil' },
  { id: 'wave', emoji: '🌊', label: 'Mer' },
  { id: 'book', emoji: '📚', label: 'Lecture' },
  { id: 'bike', emoji: '🚲', label: 'Mobile' },
];

/** Mappe les réponses wizard → PreferenceId[] (feed / matching existant). */
export function answersToPreferenceIds(
  answers: OnboardingAnswers
): PreferenceId[] {
  const set = new Set<PreferenceId>();

  if (answers.mood === 'work' || answers.wifi === 'essential') set.add('remote');
  if (answers.mood === 'chill') set.add('chill');
  if (answers.mood === 'social') set.add('events');
  if (answers.mood === 'explore') {
    set.add('specialty');
    set.add('chill');
  }

  if (answers.ambiances.includes('calm')) set.add('remote');
  if (answers.ambiances.includes('terrace')) set.add('chill');
  if (answers.ambiances.includes('lively')) set.add('events');

  if (answers.drinks.includes('specialty') || answers.drinks.includes('matcha')) {
    set.add('specialty');
  }
  if (answers.drinks.includes('brunch')) set.add('brunch');
  if (answers.drinks.includes('fresh')) set.add('chill');

  if (set.size === 0) set.add('specialty');
  return Array.from(set);
}

/** Filtre carte Mapbox aligné sur le mood / confort. */
export function mapFilterFromAnswers(
  answers: OnboardingAnswers
): 'plugs' | 'terrace' | 'coffee' | 'chill' | null {
  if (answers.wifi === 'essential' || answers.mood === 'work') return 'plugs';
  if (
    answers.ambiances.includes('terrace') ||
    answers.mood === 'chill'
  ) {
    return 'terrace';
  }
  if (answers.drinks.includes('specialty') || answers.mood === 'explore') {
    return 'coffee';
  }
  if (answers.mood === 'social' || answers.ambiances.includes('lively')) {
    return 'chill';
  }
  return null;
}

export function parseOnboardingAnswers(
  raw: unknown
): OnboardingAnswers {
  const base = emptyOnboardingAnswers();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;

  const mood = o.mood;
  if (mood === 'work' || mood === 'chill' || mood === 'social' || mood === 'explore') {
    base.mood = mood;
  }
  if (o.wifi === 'essential' || o.wifi === 'optional') base.wifi = o.wifi;
  if (Array.isArray(o.ambiances)) {
    base.ambiances = o.ambiances.filter(
      (a): a is AmbianceId =>
        a === 'calm' || a === 'terrace' || a === 'lively'
    );
  }
  if (Array.isArray(o.drinks)) {
    base.drinks = o.drinks.filter(
      (d): d is DrinkId =>
        d === 'specialty' || d === 'matcha' || d === 'brunch' || d === 'fresh'
    );
  }
  if (Array.isArray(o.zones)) {
    base.zones = o.zones.filter(
      (z): z is ZoneId =>
        z === 'centre' || z === 'vieux' || z === 'gare' || z === 'sophia'
    );
  }
  base.geoEnabled = Boolean(o.geoEnabled);
  const avatar = o.avatarPreset;
  if (
    avatar === 'coffee' ||
    avatar === 'leaf' ||
    avatar === 'sun' ||
    avatar === 'wave' ||
    avatar === 'book' ||
    avatar === 'bike'
  ) {
    base.avatarPreset = avatar;
  }
  base.welcomeBonus = Boolean(o.welcomeBonus);
  return base;
}

export function toggleInList<T>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
