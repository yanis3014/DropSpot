/**
 * « Le pouls du café » : specificities, same vocabulary as the onboarding
 * (must stay in sync with place_spec_ids() in the database).
 */

export type SpecId =
  | 'wifi'
  | 'plugs'
  | 'calm'
  | 'laptop'
  | 'terrace'
  | 'matcha'
  | 'specialty'
  | 'brunch'
  | 'events';

export type SpecStatus = 'confirmed' | 'declared' | 'pending' | 'disputed' | 'absent';

export interface PlaceSpec {
  place_id: string;
  spec: SpecId;
  declared: boolean;
  yes_votes: number;
  no_votes: number;
  /** Recent Yes minus No (older votes count half), +1 when declared. */
  score: number;
  status: SpecStatus;
  last_vote_at: string | null;
}

export const SPECS: { id: SpecId; label: string; question: string }[] = [
  { id: 'wifi', label: 'Wi-Fi solide', question: 'Le Wi-Fi est solide ?' },
  { id: 'plugs', label: 'Prises', question: 'Il y a des prises ?' },
  { id: 'calm', label: 'Calme', question: 'C’est calme pour bosser ?' },
  { id: 'laptop', label: 'Ordi bienvenu', question: 'On peut sortir l’ordi ?' },
  { id: 'terrace', label: 'Terrasse', question: 'Il y a une terrasse ?' },
  { id: 'matcha', label: 'Matcha', question: 'Il y a du matcha ?' },
  { id: 'specialty', label: 'Café de spécialité', question: 'C’est du café de spécialité ?' },
  { id: 'brunch', label: 'Brunch', question: 'On peut bruncher ?' },
  { id: 'events', label: 'Événements', question: 'Le café organise des événements ?' },
];

export const SPEC_IDS = SPECS.map((s) => s.id);

export function isSpecId(value: unknown): value is SpecId {
  return typeof value === 'string' && (SPEC_IDS as string[]).includes(value);
}

export function specLabel(id: SpecId): string {
  return SPECS.find((s) => s.id === id)?.label ?? id;
}

export function specQuestion(id: SpecId): string {
  return SPECS.find((s) => s.id === id)?.question ?? specLabel(id);
}

export const SPEC_STATUS_LABELS: Record<SpecStatus, string> = {
  confirmed: 'Confirmé',
  declared: 'Annoncé par le café',
  pending: 'À vérifier',
  disputed: 'Contesté',
  absent: 'Pas proposé',
};

/** Specs of one café, keyed by id. */
export type PlaceSpecMap = Partial<Record<SpecId, PlaceSpec>>;

/** Specs of many cafés, keyed by place id then spec id. */
export type SpecsByPlace = Record<string, PlaceSpecMap>;

export function groupSpecsByPlace(rows: PlaceSpec[]): SpecsByPlace {
  const out: SpecsByPlace = {};
  for (const row of rows) {
    (out[row.place_id] ??= {})[row.spec] = row;
  }
  return out;
}

/**
 * True when the café can be shown for this spec: confirmed, announced by
 * the café and not disputed, or more Yes than No while waiting for 3 votes.
 */
export function isSpecPositive(spec: PlaceSpec | undefined): boolean {
  if (!spec) return false;
  if (spec.status === 'confirmed' || spec.status === 'declared') return true;
  return spec.status === 'pending' && spec.yes_votes > spec.no_votes;
}

/** « 12 personnes · il y a 2 j », « Annoncé par le café », … */
export function specDetail(spec: PlaceSpec, now: number = Date.now()): string {
  const people = spec.yes_votes + spec.no_votes;
  if (people === 0) return SPEC_STATUS_LABELS[spec.status];
  const parts = [
    spec.status === 'disputed'
      ? `${spec.no_votes} non · ${spec.yes_votes} oui`
      : `${people} personne${people > 1 ? 's' : ''}`,
  ];
  if (spec.last_vote_at) {
    const days = Math.floor((now - new Date(spec.last_vote_at).getTime()) / 86_400_000);
    parts.push(days <= 0 ? 'aujourd’hui' : days === 1 ? 'hier' : `il y a ${days} j`);
  }
  return parts.join(' · ');
}

/** Order on the café page: confirmed first, then announced, pending, disputed. */
const STATUS_ORDER: Record<SpecStatus, number> = {
  confirmed: 0,
  declared: 1,
  pending: 2,
  disputed: 3,
  absent: 4,
};

export function sortSpecs(specs: PlaceSpec[]): PlaceSpec[] {
  return [...specs].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.score - a.score
  );
}

/**
 * The two questions asked after « Je suis ici »: the least settled specs
 * first (announced but unconfirmed, pending, disputed), then never-asked ones,
 * then confirmed ones, skipping what the user already answered here.
 */
export function pickSpecQuestions(
  specs: PlaceSpecMap,
  alreadyVoted: readonly SpecId[],
  count = 2
): SpecId[] {
  const rank = (id: SpecId): number => {
    const s = specs[id];
    if (!s) return 3;
    switch (s.status) {
      case 'declared':
        return 0;
      case 'pending':
        return 1;
      case 'disputed':
        return 2;
      case 'absent':
        return 5;
      default:
        return 4;
    }
  };
  return SPEC_IDS.filter((id) => !alreadyVoted.includes(id))
    .map((id, index) => ({ id, rank: rank(id), index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, count)
    .map((x) => x.id);
}
