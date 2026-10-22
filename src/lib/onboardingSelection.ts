import type { Place } from '@/lib/api/places';
import type { Drop } from '@/lib/api/drops';
import { getDropTiming } from '@/lib/api/drops';
import {
  normalizeKey,
  normalizePlaceCategory,
  placeMatchesFilter,
  placeMatchesFilters,
} from '@/lib/filters';
import { distanceMeters, type LatLng } from '@/lib/geo';
import type { PlaceFilterId } from '@/lib/mapFilters';
import { dropMatches, placeMatches } from '@/lib/preferences';
import {
  answersToPreferenceIds,
  NICE_CENTER,
  ZONE_OPTIONS,
  type EnvieId,
  type NeedId,
  type OnboardingAnswers,
} from '@/lib/onboarding';

/** Cafés shown on the "Ta sélection" screen. */
export const SELECTION_SIZE = 3;

/** Map filters from the onboarding are relaxed until at least this many cafés remain. */
export const MIN_MAP_RESULTS = 3;

/** A matching envie counts double compared to a matching must-have. */
const ENVIE_WEIGHT = 2;
const NEED_WEIGHT = 1;

/**
 * The café's own category, not `place.categories`: the latter adds `remote`
 * to any café with a `laptop_policy`, which almost all of them have.
 */
function hasRemoteCategory(place: Place): boolean {
  return normalizePlaceCategory(place.category) === 'remote';
}

function hasTerrace(place: Place): boolean {
  if (place.has_terrace) return true;
  return normalizeKey(`${place.description ?? ''} ${place.name}`).includes('terrass');
}

function hasWifi(place: Place): boolean {
  return Boolean(place.wifi_speed?.trim());
}

export function placeMatchesEnvie(place: Place, envie: EnvieId): boolean {
  switch (envie) {
    case 'work':
      return hasRemoteCategory(place) || Boolean(place.has_plugs) || hasWifi(place);
    case 'chill':
      // Not the `chill` map filter: it also accepts any `ambient` noise level.
      return placeMatches(place, ['chill']).length > 0;
    case 'friends':
      return placeMatches(place, ['chill', 'brunch', 'events']).length > 0;
    case 'brunch':
      return placeMatchesFilter(place, 'brunch');
    case 'specialty':
      return placeMatches(place, ['specialty']).length > 0;
    case 'matcha':
      return placeMatchesFilter(place, 'matcha');
    case 'terrace':
      return hasTerrace(place);
    case 'sport':
      return placeMatchesFilter(place, 'sport');
    case 'events':
      return placeMatches(place, ['events']).length > 0;
  }
}

export function placeMatchesNeed(place: Place, need: NeedId): boolean {
  switch (need) {
    case 'wifi':
      return hasWifi(place) || hasRemoteCategory(place);
    case 'plugs':
      return Boolean(place.has_plugs) || Boolean(place.plugs_level?.trim());
    case 'calm':
      return placeMatchesFilter(place, 'calme');
    case 'laptop': {
      const policy = normalizeKey(place.laptop_policy);
      return policy !== '' && policy !== 'never' && policy !== 'prohibited';
    }
    case 'terrace':
      return hasTerrace(place);
    case 'matcha':
      return placeMatchesFilter(place, 'matcha');
  }
}

/** Where to measure distances from: the position, else the first zone, else Nice centre. */
export function referencePoint(
  answers: Pick<OnboardingAnswers, 'zones'>,
  position: LatLng | null
): LatLng {
  if (position) return position;
  const zone = ZONE_OPTIONS.find((z) => answers.zones.includes(z.id));
  return zone?.center ?? NICE_CENTER;
}

export interface SelectionItem {
  place: Place;
  envies: EnvieId[];
  needs: NeedId[];
  score: number;
  /** Meters from the reference point, null without coordinates. */
  distance: number | null;
}

export interface Selection {
  items: SelectionItem[];
  /** Number of cafés matching at least one envie. */
  matchCount: number;
  /** True when nothing matched and `items` are just the nearest cafés. */
  fallback: boolean;
}

function byScoreThenDistance(a: SelectionItem, b: SelectionItem): number {
  if (b.score !== a.score) return b.score - a.score;
  return (a.distance ?? Infinity) - (b.distance ?? Infinity);
}

export function rankPlaces(
  places: readonly Place[],
  answers: Pick<OnboardingAnswers, 'envies' | 'needs'>,
  origin: LatLng
): Selection {
  const scored: SelectionItem[] = places.map((place) => {
    const envies = answers.envies.filter((e) => placeMatchesEnvie(place, e));
    const needs = answers.needs.filter((n) => placeMatchesNeed(place, n));
    const hasCoords = Number.isFinite(place.lat) && Number.isFinite(place.lng);
    return {
      place,
      envies,
      needs,
      score: envies.length * ENVIE_WEIGHT + needs.length * NEED_WEIGHT,
      distance: hasCoords ? distanceMeters(origin, place) : null,
    };
  });

  const matches = scored.filter((s) => s.envies.length > 0).sort(byScoreThenDistance);
  if (matches.length > 0) {
    return {
      items: diverseTop(matches, answers.envies),
      matchCount: matches.length,
      fallback: false,
    };
  }
  return {
    items: [...scored].sort(byScoreThenDistance).slice(0, SELECTION_SIZE),
    matchCount: 0,
    fallback: true,
  };
}

/** Best cafés, but at least one per envie when possible (work + brunch → not 3 coworkings). */
function diverseTop(sorted: SelectionItem[], envies: readonly EnvieId[]): SelectionItem[] {
  const picked: SelectionItem[] = [];
  for (const envie of envies) {
    if (picked.length === SELECTION_SIZE) break;
    if (picked.some((p) => p.envies.includes(envie))) continue;
    const best = sorted.find((s) => !picked.includes(s) && s.envies.includes(envie));
    if (best) picked.push(best);
  }
  for (const item of sorted) {
    if (picked.length === SELECTION_SIZE) break;
    if (!picked.includes(item)) picked.push(item);
  }
  return picked.sort(byScoreThenDistance);
}

/** One live or upcoming drop for the selection screen, matching envies first. */
export function pickDropForAnswers(
  drops: readonly Drop[],
  answers: Pick<OnboardingAnswers, 'envies'>,
  now: number = Date.now()
): Drop | null {
  const open = drops.filter((d) => getDropTiming(d, now) !== 'ended');
  if (open.length === 0) return null;
  const prefs = answersToPreferenceIds(answers);
  return open.find((d) => dropMatches(d, prefs).length > 0) ?? open[0];
}

const FILTER_BY_NEED: Partial<Record<NeedId, PlaceFilterId>> = {
  wifi: 'wifi',
  plugs: 'wifi',
  laptop: 'wifi',
  calm: 'calme',
  matcha: 'matcha',
};

/**
 * Map chips to switch on when the onboarding ends. Filters are AND-ed on the
 * map, so the least important ones are dropped until enough cafés remain.
 */
export function mapFiltersForAnswers(
  answers: Pick<OnboardingAnswers, 'needs'>,
  places: readonly Place[]
): PlaceFilterId[] {
  const filters: PlaceFilterId[] = [];
  for (const need of answers.needs) {
    const filter = FILTER_BY_NEED[need];
    if (filter && !filters.includes(filter)) filters.push(filter);
  }
  if (places.length === 0) return [];
  while (
    filters.length > 0 &&
    places.filter((p) => placeMatchesFilters(p, filters)).length < MIN_MAP_RESULTS
  ) {
    filters.pop();
  }
  return filters;
}
