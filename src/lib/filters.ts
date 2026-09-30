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
  deal: 'promo',
  offer: 'promo',
  sport: 'sport',
  run: 'sport',
  fitness: 'sport',
  event: 'event',
  events: 'event',
  'événement': 'event',
  evenement: 'event',
  party: 'event',
  concert: 'event',
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

export function dropMatchesFilter(
  drop: Pick<Drop, 'drop_type'>,
  filter: string | null | undefined
): boolean {
  if (!filter || filter === 'all') return true;
  const wanted = normalizeDropType(filter);
  if (!wanted) return true;
  return normalizeDropType(drop.drop_type) === wanted;
}
