import type { PreferenceId } from '@/lib/preferences';

/** Must stay in sync with `claim_welcome_grains()` (welcome_grains constant). */
export const WELCOME_GRAINS = 50;

/** Version of the `profiles.onboarding_answers` JSON shape. */
export const ONBOARDING_ANSWERS_VERSION = 2;

export type EnvieId =
  | 'work'
  | 'chill'
  | 'friends'
  | 'brunch'
  | 'specialty'
  | 'matcha'
  | 'terrace'
  | 'sport'
  | 'events';

export type NeedId = 'wifi' | 'plugs' | 'calm' | 'laptop' | 'terrace' | 'matcha';

export type ZoneId = 'centre' | 'vieux' | 'gare' | 'sophia';

export type AvatarColorId =
  | 'clay'
  | 'sage'
  | 'sea'
  | 'amber'
  | 'plum'
  | 'espresso';

export interface OnboardingAnswers {
  version: typeof ONBOARDING_ANSWERS_VERSION;
  /** Multi-select "envies" (step 2). */
  envies: EnvieId[];
  /** Must-haves, pre-filled from the envies (step 3, optional). */
  needs: NeedId[];
  zones: ZoneId[];
  geoEnabled: boolean;
  avatarColor: AvatarColorId | null;
  welcomeBonus: boolean;
}

export const emptyOnboardingAnswers = (): OnboardingAnswers => ({
  version: ONBOARDING_ANSWERS_VERSION,
  envies: [],
  needs: [],
  zones: [],
  geoEnabled: false,
  avatarColor: null,
  welcomeBonus: false,
});

export const ENVIE_OPTIONS: { id: EnvieId; label: string }[] = [
  { id: 'work', label: 'Bosser au calme' },
  { id: 'chill', label: 'Pause tranquille' },
  { id: 'friends', label: 'Voir des amis' },
  { id: 'brunch', label: 'Bruncher' },
  { id: 'specialty', label: 'Café de spécialité' },
  { id: 'matcha', label: 'Matcha & thés' },
  { id: 'terrace', label: 'Terrasse au soleil' },
  { id: 'sport', label: 'Runs & sport' },
  { id: 'events', label: 'Ateliers & sorties' },
];

export const NEED_OPTIONS: { id: NeedId; label: string }[] = [
  { id: 'wifi', label: 'Wi-Fi solide' },
  { id: 'plugs', label: 'Prises' },
  { id: 'calm', label: 'Calme' },
  { id: 'laptop', label: 'Ordi bienvenu' },
  { id: 'terrace', label: 'Terrasse' },
  { id: 'matcha', label: 'Matcha' },
];

/** Must-haves pre-checked on step 3 for each envie. */
const NEEDS_BY_ENVIE: Partial<Record<EnvieId, NeedId[]>> = {
  work: ['wifi', 'plugs', 'calm', 'laptop'],
  chill: ['calm'],
  terrace: ['terrace'],
  matcha: ['matcha'],
};

/** Feed / matching categories (`profiles.preferences`) for each envie. */
const PREFERENCES_BY_ENVIE: Record<EnvieId, PreferenceId[]> = {
  work: ['remote'],
  chill: ['chill'],
  friends: ['chill', 'brunch'],
  brunch: ['brunch'],
  specialty: ['specialty'],
  matcha: ['specialty'],
  terrace: ['chill'],
  sport: ['sport'],
  events: ['events'],
};

export const ZONE_OPTIONS: {
  id: ZoneId;
  label: string;
  /** Rough centre, used to rank cafés when the position is off. */
  center: { lat: number; lng: number };
}[] = [
  { id: 'centre', label: 'Nice Centre', center: { lat: 43.7009, lng: 7.2683 } },
  { id: 'vieux', label: 'Vieux-Nice / Port', center: { lat: 43.6967, lng: 7.2786 } },
  { id: 'gare', label: 'Gare Thiers', center: { lat: 43.7046, lng: 7.2619 } },
  { id: 'sophia', label: 'Sophia / Biot', center: { lat: 43.6163, lng: 7.0553 } },
];

/** Fallback reference point when neither the position nor a zone is known. */
export const NICE_CENTER = ZONE_OPTIONS[0].center;

export const AVATAR_COLORS: { id: AvatarColorId; label: string; hex: string }[] = [
  { id: 'clay', label: 'Terre cuite', hex: '#a34b1a' },
  { id: 'sage', label: 'Sauge', hex: '#2b6a47' },
  { id: 'sea', label: 'Mer', hex: '#3d5a80' },
  { id: 'amber', label: 'Ambre', hex: '#8a4b00' },
  { id: 'plum', label: 'Prune', hex: '#6b4c9a' },
  { id: 'espresso', label: 'Espresso', hex: '#231915' },
];

export function avatarColorHex(id: AvatarColorId | null | undefined): string | null {
  return AVATAR_COLORS.find((c) => c.id === id)?.hex ?? null;
}

const ENVIE_IDS = new Set<string>(ENVIE_OPTIONS.map((o) => o.id));
const NEED_IDS = new Set<string>(NEED_OPTIONS.map((o) => o.id));
const ZONE_IDS = new Set<string>(ZONE_OPTIONS.map((o) => o.id));
const AVATAR_COLOR_IDS = new Set<string>(AVATAR_COLORS.map((o) => o.id));

export function envieLabel(id: EnvieId): string {
  return ENVIE_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function needLabel(id: NeedId): string {
  return NEED_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

/** Union of the must-haves suggested by the chosen envies, in NEED_OPTIONS order. */
export function needsForEnvies(envies: readonly EnvieId[]): NeedId[] {
  const set = new Set<NeedId>();
  for (const envie of envies) {
    for (const need of NEEDS_BY_ENVIE[envie] ?? []) set.add(need);
  }
  return NEED_OPTIONS.map((o) => o.id).filter((id) => set.has(id));
}

/** Envies → `profiles.preferences` (feed / matching). */
export function answersToPreferenceIds(
  answers: Pick<OnboardingAnswers, 'envies'>
): PreferenceId[] {
  const set = new Set<PreferenceId>();
  for (const envie of answers.envies) {
    for (const pref of PREFERENCES_BY_ENVIE[envie] ?? []) set.add(pref);
  }
  return Array.from(set);
}

export function toggleInList<T>(list: readonly T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function pushUnique<T>(list: T[], value: T) {
  if (!list.includes(value)) list.push(value);
}

function filterIds<T extends string>(raw: unknown, allowed: Set<string>): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const v of raw) {
    if (typeof v === 'string' && allowed.has(v)) pushUnique(out, v as T);
  }
  return out;
}

/**
 * Reads `profiles.onboarding_answers` (or the local copy). Accepts the
 * current shape and the first one (single `mood`, `wifi`, `ambiances`,
 * `drinks`, `avatarPreset`), which is converted to envies / needs.
 */
export function parseOnboardingAnswers(raw: unknown): OnboardingAnswers {
  const base = emptyOnboardingAnswers();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;

  base.envies = filterIds<EnvieId>(o.envies, ENVIE_IDS);
  base.needs = filterIds<NeedId>(o.needs, NEED_IDS);
  base.zones = filterIds<ZoneId>(o.zones, ZONE_IDS);
  base.geoEnabled = Boolean(o.geoEnabled);
  base.welcomeBonus = Boolean(o.welcomeBonus);
  if (typeof o.avatarColor === 'string' && AVATAR_COLOR_IDS.has(o.avatarColor)) {
    base.avatarColor = o.avatarColor as AvatarColorId;
  }

  // First version of the questionnaire.
  const legacyMood: Record<string, EnvieId> = {
    work: 'work',
    chill: 'chill',
    social: 'friends',
    explore: 'specialty',
  };
  if (typeof o.mood === 'string' && legacyMood[o.mood]) {
    pushUnique(base.envies, legacyMood[o.mood]);
  }
  if (o.wifi === 'essential') {
    pushUnique(base.needs, 'wifi');
    pushUnique(base.needs, 'plugs');
  }
  if (Array.isArray(o.ambiances)) {
    if (o.ambiances.includes('calm')) pushUnique(base.needs, 'calm');
    if (o.ambiances.includes('terrace')) pushUnique(base.envies, 'terrace');
    if (o.ambiances.includes('lively')) pushUnique(base.envies, 'events');
  }
  if (Array.isArray(o.drinks)) {
    if (o.drinks.includes('specialty')) pushUnique(base.envies, 'specialty');
    if (o.drinks.includes('matcha')) pushUnique(base.envies, 'matcha');
    if (o.drinks.includes('brunch')) pushUnique(base.envies, 'brunch');
  }

  return base;
}
