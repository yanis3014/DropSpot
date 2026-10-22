import type { Place } from '@/lib/api/places';
import type { AggregatedVibe } from '@/lib/api/checkins';
import type { PlaceOpenStatusMap } from '@/lib/api/openingHours';
import { isSpecPositive, type SpecId, type SpecsByPlace } from '@/lib/specs';

/**
 * « Le pouls du café » for filtering: consolidated specificities, live vibe
 * (last 3 h) and opening status. When given, filters read it instead of
 * guessing from the café columns and text.
 */
export interface PlacePulse {
  specs: SpecsByPlace;
  vibes?: Record<string, AggregatedVibe>;
  open?: PlaceOpenStatusMap;
}

const FILTER_SPEC: Record<string, SpecId> = {
  wifi: 'wifi',
  'wi-fi': 'wifi',
  remote: 'wifi',
  plugs: 'plugs',
  matcha: 'matcha',
  terrace: 'terrace',
  brunch: 'brunch',
  bakery: 'brunch',
  specialty: 'specialty',
  coffee: 'specialty',
  laptop: 'laptop',
  event: 'events',
  events: 'events',
};

function pulseMatchesFilter(place: Place, key: string, pulse: PlacePulse): boolean | null {
  const specs = pulse.specs[place.id] ?? {};
  const vibe = pulse.vibes?.[place.id];
  if (key === 'calme' || key === 'quiet' || key === 'calm') {
    // A café packed right now is not calm, whatever its reputation.
    if (vibe?.crowd_level === 'full') return false;
    return isSpecPositive(specs.calm) || vibe?.crowd_level === 'quiet';
  }
  if (key === 'open' || key === 'open_now' || key === 'ouvert') {
    const row = pulse.open?.[place.id];
    if (row?.ok && row.has_hours) return row.status !== 'closed';
    // Unknown hours: not shown as open.
    return place.opening_hours?.trim() ? isPlaceOpenNow(place) : false;
  }
  const spec = FILTER_SPEC[key];
  if (!spec) return null;
  if (spec === 'wifi' && vibe?.wifi_speed === 'good') return true;
  return isSpecPositive(specs[spec]);
}

/** Canonical place categories used by the feed, map and preferences. */
export type PlaceCategoryId =
  | 'remote'
  | 'brunch'
  | 'specialty'
  | 'sport'
  | 'chill'
  | 'event';

/** Canonical drop types used by drops filters. */
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

/** True when free-text opening hours look open at `now` (optimistic if unknown). */
export function isPlaceOpenNow(
  place: Pick<Place, 'opening_hours'>,
  now: Date = new Date()
): boolean {
  const raw = place.opening_hours?.trim();
  if (!raw) return true;

  const key = normalizeKey(raw);
  if (
    (key === 'ferme' || key.startsWith('ferme ')) &&
    !/\d/.test(key)
  ) {
    return false;
  }

  const range = raw.match(
    /(\d{1,2})\s*[h:]\s*(\d{0,2}).*?[-–—].*?(\d{1,2})\s*[h:]\s*(\d{0,2})/i
  );
  if (!range) return true;

  const openMin =
    Number(range[1]) * 60 + Number(range[2] === '' ? 0 : range[2]);
  const closeMin =
    Number(range[3]) * 60 + Number(range[4] === '' ? 0 : range[4]);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (closeMin <= openMin) {
    return nowMin >= openMin || nowMin < closeMin;
  }
  return nowMin >= openMin && nowMin < closeMin;
}

function placeHaystack(place: Place): string {
  return normalizeKey(
    `${place.name} ${place.description ?? ''} ${place.category ?? ''}`
  );
}

/** Home feed / map filter for places (category pills + map chips). */
export function placeMatchesFilter(
  place: Place,
  filter: string | null | undefined,
  pulse?: PlacePulse
): boolean {
  if (!filter || filter === 'all') return true;
  const key = normalizeKey(filter);
  if (pulse) {
    const fromPulse = pulseMatchesFilter(place, key, pulse);
    if (fromPulse !== null) return fromPulse;
  }
  const categories = place.categories ?? [];

  if (key === 'wifi' || key === 'wi-fi' || key === 'remote' || key === 'plugs') {
    return (
      !!place.has_plugs ||
      !!place.wifi_speed ||
      !!place.laptop_policy ||
      categories.includes('remote')
    );
  }
  if (key === 'matcha') {
    const haystack = placeHaystack(place);
    return (
      haystack.includes('matcha') ||
      haystack.includes('chai') ||
      !!place.is_vegan
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
  if (key === 'calme' || key === 'quiet') {
    const noise = normalizeKey(place.noise_level);
    return (
      noise === 'quiet' ||
      noise.includes('calme') ||
      noise.includes('quiet')
    );
  }
  if (key === 'chill' || key === 'ambiance') {
    const noise = normalizeKey(place.noise_level);
    return (
      categories.includes('chill') ||
      !!place.has_terrace ||
      noise.includes('calme') ||
      noise.includes('quiet') ||
      noise.includes('ambient') ||
      noise.includes('chill')
    );
  }
  if (key === 'open' || key === 'open_now' || key === 'ouvert') {
    return isPlaceOpenNow(place);
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

/** Place must match every active filter (AND). */
export function placeMatchesFilters(
  place: Place,
  filters: readonly string[],
  pulse?: PlacePulse
): boolean {
  if (filters.length === 0) return true;
  return filters.every((f) => placeMatchesFilter(place, f, pulse));
}
