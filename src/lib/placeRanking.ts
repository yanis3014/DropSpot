import type { EnvieId, NeedId } from '@/lib/onboarding';
import { isSpecPositive, type PlaceSpecMap, type SpecId } from '@/lib/specs';

/** List order: matches the onboarding answers, nearest, or best confirmed. */
export type PlaceSortId = 'for_you' | 'distance' | 'confirmed';

export const PLACE_SORTS: { id: PlaceSortId; label: string }[] = [
  { id: 'for_you', label: 'Pour toi' },
  { id: 'distance', label: 'Distance' },
  { id: 'confirmed', label: 'Les mieux confirmés' },
];

const SPECS_BY_ENVIE: Partial<Record<EnvieId, SpecId[]>> = {
  work: ['wifi', 'plugs', 'calm', 'laptop'],
  chill: ['calm'],
  brunch: ['brunch'],
  specialty: ['specialty'],
  matcha: ['matcha'],
  terrace: ['terrace'],
  sport: ['events'],
  events: ['events'],
};

/** Specs a user cares about, from the onboarding envies and must-haves. */
export function specsForAnswers(answers: {
  envies?: readonly EnvieId[];
  needs?: readonly NeedId[];
}): SpecId[] {
  const out = new Set<SpecId>();
  for (const envie of answers.envies ?? []) {
    for (const spec of SPECS_BY_ENVIE[envie] ?? []) out.add(spec);
  }
  // Must-haves use the same ids as the specificities.
  for (const need of answers.needs ?? []) out.add(need);
  return [...out];
}

/** Map / list chips that point to one specificity. */
export const FILTER_SPECS: Record<string, SpecId> = {
  wifi: 'wifi',
  matcha: 'matcha',
  calme: 'calm',
};

/** Sum of the scores of the wanted specs the café has (all of them when none). */
export function specScore(specs: PlaceSpecMap, wanted: readonly SpecId[]): number {
  const keys = wanted.length > 0 ? wanted : (Object.keys(specs) as SpecId[]);
  let total = 0;
  for (const id of keys) {
    const spec = specs[id];
    if (isSpecPositive(spec)) total += Math.max(1, spec!.score);
  }
  return total;
}

export interface RankablePlace {
  id: string;
  name: string;
  distanceM: number | null;
}

function byDistance(a: RankablePlace, b: RankablePlace): number {
  if (a.distanceM == null && b.distanceM == null) return a.name.localeCompare(b.name, 'fr');
  if (a.distanceM == null) return 1;
  if (b.distanceM == null) return -1;
  return a.distanceM - b.distanceM;
}

/** « Pour toi » trades 1 point of score for each km of walk. */
export const SCORE_PER_KM = 1;

/**
 * Sort cafés. « Les mieux confirmés » ranks by score, then distance.
 * « Pour toi » subtracts the distance (1 point per km), so a café 1 km further
 * only wins with a clearly better score.
 */
export function sortPlaces<T extends RankablePlace>(
  places: T[],
  sort: PlaceSortId,
  ctx: { specsByPlace: Record<string, PlaceSpecMap>; wanted: readonly SpecId[] }
): T[] {
  if (sort === 'distance') return [...places].sort(byDistance);
  const scored = places.map((p) => {
    const score = specScore(ctx.specsByPlace[p.id] ?? {}, ctx.wanted);
    const penalty =
      sort === 'for_you' && p.distanceM != null
        ? (p.distanceM / 1000) * SCORE_PER_KM
        : 0;
    return { place: p, value: score - penalty };
  });
  return scored
    .sort((a, b) => b.value - a.value || byDistance(a.place, b.place))
    .map((x) => x.place);
}

/** Tabs of the « Top de Nice » page. */
export const RANKING_SPECS: { id: SpecId; label: string; phrase: string }[] = [
  { id: 'wifi', label: 'Wi-Fi', phrase: 'pour le Wi-Fi' },
  { id: 'matcha', label: 'Matcha', phrase: 'pour le matcha' },
  { id: 'calm', label: 'Calme', phrase: 'pour le calme' },
  { id: 'events', label: 'Événements', phrase: 'pour les événements' },
  { id: 'specialty', label: 'Café de spécialité', phrase: 'pour le café de spécialité' },
  { id: 'brunch', label: 'Brunch', phrase: 'pour le brunch' },
  { id: 'terrace', label: 'Terrasse', phrase: 'pour la terrasse' },
];

/** « 1er », « 2e ». */
export function ordinal(rank: number): string {
  return rank === 1 ? '1er' : `${rank}e`;
}

/** « 2e pour le Wi-Fi à Nice », or null for a spec without a ranking. */
export function rankChipLabel(spec: SpecId, rank: number): string | null {
  const entry = RANKING_SPECS.find((s) => s.id === spec);
  return entry ? `${ordinal(rank)} ${entry.phrase} à Nice` : null;
}

/** Change versus last week: « Nouveau », « +2 », « −1 » or null when unchanged. */
export function rankChange(
  rank: number,
  previous: number | null
): { label: string; trend: 'new' | 'up' | 'down' } | null {
  if (previous == null) return { label: 'Nouveau', trend: 'new' };
  if (previous === rank) return null;
  return previous > rank
    ? { label: `+${previous - rank}`, trend: 'up' }
    : { label: `−${rank - previous}`, trend: 'down' };
}
