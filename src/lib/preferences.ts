import type { Place } from '@/lib/api/places';
import type { Drop } from '@/lib/api/drops';
import { normalizeDropType } from '@/lib/filters';

export type PreferenceId = 'remote' | 'brunch' | 'sport' | 'specialty' | 'events' | 'chill';

export interface PreferenceOption {
  id: PreferenceId;
  emoji: string;
  label: string;
  /** Short form used in the feed greeting ("Tes spots pour …"). */
  short: string;
  description: string;
}

export const preferenceCatalog: PreferenceOption[] = [
  {
    id: 'remote',
    emoji: '💻',
    label: 'Télétravail & Wi-Fi',
    short: 'bosser',
    description: 'Prises, Wi-Fi solide et calme pour avancer.',
  },
  {
    id: 'brunch',
    emoji: '🥐',
    label: 'Brunch & Pâtisseries',
    short: 'bruncher',
    description: 'Viennoiseries maison et longues tablées du dimanche.',
  },
  {
    id: 'sport',
    emoji: '🏃‍♂️',
    label: 'Run & Sport',
    short: 'bouger',
    description: 'Runs collectifs et cafés post-séance.',
  },
  {
    id: 'specialty',
    emoji: '☕',
    label: 'Café de spécialité',
    short: 'déguster',
    description: 'Torréfacteurs, filtres et baristas passionnés.',
  },
  {
    id: 'events',
    emoji: '🎧',
    label: 'Événements & DJ sets',
    short: 'sortir',
    description: 'Soirées, expos et sets en fin de journée.',
  },
  {
    id: 'chill',
    emoji: '🌿',
    label: 'Chill & Terrasse',
    short: 'chiller',
    description: 'Terrasses au soleil et coins tranquilles.',
  },
];

export const preferenceById = Object.fromEntries(
  preferenceCatalog.map((p) => [p.id, p])
) as Record<PreferenceId, PreferenceOption>;

export function isPreferenceId(value: unknown): value is PreferenceId {
  return typeof value === 'string' && value in preferenceById;
}

const keywordMatchers: Partial<Record<PreferenceId, string[]>> = {
  brunch: ['brunch', 'viennoiserie', 'boulangerie', 'bakery', 'croissant', 'patisserie', 'pâtisserie'],
  specialty: ['spécialité', 'specialty', 'torréfact', 'roast', 'barista', 'filtre', 'v60', 'espresso bar'],
  chill: ['chill', 'terrasse', 'jardin', 'cosy', 'lounge', 'dj'],
  sport: ['run', 'sport', 'yoga', 'vélo', 'velo'],
  events: ['dj', 'concert', 'expo', 'soirée', 'événement', 'evenement', 'live'],
};

function haystackFor(text: (string | undefined | null)[]): string {
  return text.filter(Boolean).join(' ').toLowerCase();
}

/** Which of the user's preferences this place satisfies. Empty when none. */
export function placeMatches(place: Place, prefs: PreferenceId[]): PreferenceId[] {
  if (prefs.length === 0) return [];
  const text = haystackFor([place.name, place.description, place.category]);
  const categories = place.categories ?? [];

  return prefs.filter((pref) => {
    const categoryKey = pref === 'events' ? 'event' : pref;
    if (categories.includes(categoryKey as (typeof categories)[number])) return true;
    if (pref === 'remote') {
      return !!(place.has_plugs || place.wifi_speed || place.laptop_policy);
    }
    if (pref === 'chill' && place.has_terrace) return true;
    const keywords = keywordMatchers[pref];
    return !!keywords && keywords.some((k) => text.includes(k));
  });
}

/** Which of the user's preferences this drop satisfies. Empty when none. */
export function dropMatches(drop: Drop, prefs: PreferenceId[]): PreferenceId[] {
  if (prefs.length === 0) return [];
  const text = haystackFor([drop.title, drop.description]);
  const type = normalizeDropType(drop.drop_type) ?? drop.drop_type;

  return prefs.filter((pref) => {
    if (pref === 'sport') return type === 'sport';
    if (pref === 'events') return type === 'event';
    const keywords = keywordMatchers[pref];
    return !!keywords && keywords.some((k) => text.includes(k));
  });
}

/** "bosser, bruncher et chiller" — for the feed greeting. */
export function formatPreferenceList(prefs: PreferenceId[]): string {
  const shorts = prefs.map((p) => preferenceById[p]?.short).filter(Boolean);
  if (shorts.length === 0) return '';
  if (shorts.length === 1) return shorts[0];
  return `${shorts.slice(0, -1).join(', ')} et ${shorts[shorts.length - 1]}`;
}
