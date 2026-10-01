import type { Place } from '@/lib/api/places';
import type { Drop } from '@/lib/api/drops';

/** Canonical place categories used by the feed, map and preferences. */
export type PlaceCategoryId =
  | 'remote'
  | 'brunch'
  | 'specialty'
  | 'sport'
  | 'chill'
  | 'event';

/** Canonical drop types used by DropCard / filters. */
export type DropTypeId = 'promo' | 'sport' | 'event';

const placeCategoryAliases: Record<string, PlaceCategoryId> = {
  remote: 'remote',
  'remote friendly': 'remote',
  teletravail: 'remote',
  'télétravail': 'remote',
  wifi: 'remote',
  work: 'remote',
  brunch: 'brunch',
  bakery: 'brunch',
  viennoiserie: 'brunch',
  boulangerie: 'brunch',
  patisserie: 'brunch',
  'pâtisserie': 'brunch',
  pastry: 'brunch',
  specialty: 'specialty',
  speciality: 'specialty',
  'spécialité': 'specialty',
  specialite: 'specialty',
  coffee: 'specialty',
  café: 'specialty',
  cafe: 'specialty',
  sport: 'sport',
  run: 'sport',
  chill: 'chill',
  terrace: 'chill',
  terrasse: 'chill',
  ambiance: 'chill',
  event: 'event',
  events: 'event',
  'événement': 'event',
  evenement: 'event',
};

const dropTypeAliases: Record<string, DropTypeId> = {
  promo: 'promo',
  flash: 'promo',
  'flash promo': 'promo',
  promotion: 'promo',
  discount: 'promo',
  reduction: 'promo',
  'réduction': 'promo',
  offre: 'promo',
  deal: 'promo',
  offer: 'promo',
  coupon: 'promo',
  sport: 'sport',
  run: 'sport',
  running: 'sport',
  fitness: 'sport',
  yoga: 'sport',
  workout: 'sport',
  training: 'sport',
  footing: 'sport',
  velo: 'sport',
  'vélo': 'sport',
  bike: 'sport',
  event: 'event',
  events: 'event',
  'événement': 'event',
  evenement: 'event',
  meetup: 'event',
  workshop: 'event',
  atelier: 'event',
  party: 'event',
  concert: 'event',
  expo: 'event',
  soiree: 'event',
  'soirée': 'event',
  live: 'event',
  dj: 'event',
};

/** Loose title/description keywords per drop category pill. */
const dropTypeKeywords: Record<DropTypeId, string[]> = {
  promo: [
    'promo',
    'flash',
    'promotion',
    'discount',
    'offre',
    'deal',
    'réduction',
    'reduction',
    'gratuit',
    'free',
    'happy hour',
    'coupon',
  ],
  sport: [
    'sport',
    'run',
    'running',
    'footing',
    'fitness',
    'yoga',
    'workout',
    'training',
    'velo',
    'vélo',
    'bike',
    'course',
    'jog',
    'crossfit',
    'hiit',
    'padel',
    'tennis',
  ],
  event: [
    'event',
    'événement',
    'evenement',
    'meetup',
    'workshop',
    'atelier',
    'concert',
    'expo',
    'soirée',
    'soiree',
    'party',
    'live',
    'dj',
    'set',
    'opening',
    'vernissage',
    'talk',
    'conférence',
    'conference',
  ],
};

export function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function normalizePlaceCategory(
  value: unknown
): PlaceCategoryId | null {
  const key = normalizeKey(value);
  if (!key) return null;
  return placeCategoryAliases[key] ?? null;
}

export function normalizeDropType(value: unknown): DropTypeId | null {
  const key = normalizeKey(value);
  if (!key) return null;
  if (dropTypeAliases[key]) return dropTypeAliases[key];
  // Partial matches: "Flash Promo Nice", "Sport Run #3"
  for (const [alias, id] of Object.entries(dropTypeAliases)) {
    if (key.includes(alias)) return id;
  }
  return null;
}

export function hasValidCoordinates(
  place: Pick<Place, 'lat' | 'lng'>
): boolean {
  return (
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng) &&
    Math.abs(place.lat) <= 90 &&
    Math.abs(place.lng) <= 180 &&
    !(place.lat === 0 && place.lng === 0)
  );
}

const bakeryKeywords = [
  'brunch',
  'viennoiserie',
  'boulangerie',
  'bakery',
  'croissant',
  'patisserie',
  'pâtisserie',
  'pastry',
];

/** Home feed / map filter for places (category pills). */
export function placeMatchesFilter(
  place: Place,
  filter: string | null | undefined
): boolean {
  if (!filter || filter === 'all') return true;
  const key = normalizeKey(filter);
  const categories = place.categories ?? [];

  if (key === 'remote' || key === 'plugs') {
    return (
      !!place.has_plugs ||
      !!place.wifi_speed ||
      !!place.laptop_policy ||
      categories.includes('remote')
    );
  }
  if (key === 'bakery' || key === 'brunch') {
    if (categories.includes('brunch')) return true;
    const haystack = `${place.name} ${place.description ?? ''} ${place.category ?? ''}`.toLowerCase();
    return bakeryKeywords.some((k) => haystack.includes(k));
  }
  if (key === 'terrace') {
    return !!place.has_terrace || categories.includes('chill');
  }
  if (key === 'chill' || key === 'ambiance') {
    return (
      categories.includes('chill') ||
      !!place.has_terrace ||
      normalizeKey(place.noise_level).includes('calme') ||
      normalizeKey(place.noise_level).includes('chill')
    );
  }
  if (key === 'coffee' || key === 'specialty') {
    if (categories.includes('specialty')) return true;
    const haystack = `${place.name} ${place.description ?? ''} ${place.category ?? ''}`.toLowerCase();
    return ['specialty', 'spécialité', 'specialite', 'torréfact', 'barista', 'café', 'cafe'].some(
      (k) => haystack.includes(k)
    );
  }
  if (key === 'sport') return categories.includes('sport');
  if (key === 'event' || key === 'events') return categories.includes('event');

  // Unknown filter: try as a place category id
  const asCategory = normalizePlaceCategory(filter);
  return asCategory ? categories.includes(asCategory) : true;
}

/**
 * Infer a drop type from free text / place when the DB type is missing or unknown.
 * Prefer promo > sport > event so a "Flash Run" still reads as promo if both match.
 */
export function inferDropTypeFromContent(
  drop: Pick<Drop, 'title' | 'description' | 'raw_drop_type' | 'places'>
): DropTypeId | null {
  const text = normalizeKey(
    [drop.title, drop.description, drop.raw_drop_type].filter(Boolean).join(' ')
  );
  const placeText = normalizeKey(
    [drop.places?.name, drop.places?.category, drop.places?.city]
      .filter(Boolean)
      .join(' ')
  );
  const haystack = `${text} ${placeText}`;
  const placeCat = normalizePlaceCategory(drop.places?.category);

  for (const id of ['promo', 'sport', 'event'] as DropTypeId[]) {
    if (dropTypeKeywords[id].some((k) => haystack.includes(normalizeKey(k)))) {
      return id;
    }
    if (id === 'sport' && placeCat === 'sport') return 'sport';
    if (id === 'event' && placeCat === 'event') return 'event';
  }
  return null;
}

/**
 * Category / type matching for drops.
 * Matches canonical drop_type, raw DB type, title/description keywords,
 * and associated place category/name — never applies date constraints.
 */
export function dropMatchesFilter(
  drop: Pick<Drop, 'drop_type' | 'title' | 'description' | 'raw_drop_type' | 'places'>,
  filter: string | null | undefined
): boolean {
  if (!filter || filter === 'all') return true;
  const wanted = normalizeDropType(filter);
  if (!wanted) return true;

  // 1) Canonical / raw type fields
  if (normalizeDropType(drop.drop_type) === wanted) return true;
  if (normalizeDropType(drop.raw_drop_type) === wanted) return true;

  // 2) Loose text match on title + description
  const text = normalizeKey(
    [drop.title, drop.description, drop.raw_drop_type].filter(Boolean).join(' ')
  );
  const keywords = dropTypeKeywords[wanted];
  if (keywords.some((k) => text.includes(normalizeKey(k)))) return true;

  // 3) Associated place hints (sport venue, event hall, etc.)
  const place = drop.places;
  if (place) {
    const placeCat = normalizePlaceCategory(place.category);
    if (wanted === 'sport' && placeCat === 'sport') return true;
    if (wanted === 'event' && placeCat === 'event') return true;
    // Promo at specialty/coffee spots is common but not place-category driven.
    const placeText = normalizeKey(
      [place.name, place.category, place.city].filter(Boolean).join(' ')
    );
    if (keywords.some((k) => placeText.includes(normalizeKey(k)))) return true;
  }

  return false;
}
