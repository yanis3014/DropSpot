/**
 * Valeurs canoniques stockées dans `places` (anglais).
 * Les libellés FR ne sont que pour l’UI — les envoyer tels quels
 * viole les CHECK constraints Supabase (ex. code 23514).
 *
 * Valeurs observées en base : noise_level=`ambient`, laptop_policy=`always`.
 * plugs_level : limited | regular | everywhere (migration places_plugs_level_check).
 */

export const WIFI_OPTIONS = [
  { value: '', label: '—' },
  { value: 'slow', label: 'Lent' },
  { value: 'average', label: 'Correct' },
  { value: 'fast', label: 'Rapide' },
  { value: 'fiber', label: 'Fibre' },
] as const;

export const NOISE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'quiet', label: 'Calme' },
  { value: 'ambient', label: 'Modéré' },
  { value: 'loud', label: 'Animé' },
] as const;

export const PLUGS_OPTIONS = [
  { value: '', label: 'Non renseigné' },
  { value: 'limited', label: 'Limitées' },
  { value: 'regular', label: 'Nombreuses' },
  { value: 'everywhere', label: 'À chaque table' },
] as const;

export type WifiSpeed = 'slow' | 'average' | 'fast' | 'fiber';
export type NoiseLevel = 'quiet' | 'ambient' | 'loud';
export type PlugsLevel = 'limited' | 'regular' | 'everywhere';

const WIFI_CANON = new Set<string>(['slow', 'average', 'fast', 'fiber']);
const NOISE_CANON = new Set<string>(['quiet', 'ambient', 'loud']);
const PLUGS_CANON = new Set<string>(['limited', 'regular', 'everywhere']);

/** Alias FR / legacy → valeur DB. */
const WIFI_ALIASES: Record<string, WifiSpeed> = {
  lent: 'slow',
  slow: 'slow',
  correct: 'average',
  average: 'average',
  medium: 'average',
  ok: 'average',
  good: 'average',
  rapide: 'fast',
  fast: 'fast',
  fibre: 'fiber',
  fiber: 'fiber',
};

const NOISE_ALIASES: Record<string, NoiseLevel> = {
  calme: 'quiet',
  quiet: 'quiet',
  silent: 'quiet',
  'modéré': 'ambient',
  modere: 'ambient',
  moderate: 'ambient',
  ambient: 'ambient',
  'animé': 'loud',
  anime: 'loud',
  loud: 'loud',
  noisy: 'loud',
  busy: 'loud',
};

const PLUGS_ALIASES: Record<string, PlugsLevel> = {
  limited: 'limited',
  limitées: 'limited',
  limitees: 'limited',
  regular: 'regular',
  nombreuses: 'regular',
  régulières: 'regular',
  regulieres: 'regular',
  everywhere: 'everywhere',
  partout: 'everywhere',
  'à chaque table': 'everywhere',
  'a chaque table': 'everywhere',
};

function keyOf(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeWifiSpeed(
  value: string | null | undefined
): WifiSpeed | null {
  if (value == null) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (WIFI_CANON.has(raw)) return raw as WifiSpeed;
  return WIFI_ALIASES[keyOf(raw)] ?? null;
}

export function normalizeNoiseLevel(
  value: string | null | undefined
): NoiseLevel | null {
  if (value == null) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (NOISE_CANON.has(raw)) return raw as NoiseLevel;
  return NOISE_ALIASES[keyOf(raw)] ?? null;
}

export function normalizePlugsLevel(
  value: string | null | undefined
): PlugsLevel | null {
  if (value == null) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (PLUGS_CANON.has(raw)) return raw as PlugsLevel;
  return PLUGS_ALIASES[keyOf(raw)] ?? null;
}

export function wifiLabel(value: string | null | undefined): string {
  const canon = normalizeWifiSpeed(value);
  if (!canon) return value?.trim() || '';
  return WIFI_OPTIONS.find((o) => o.value === canon)?.label ?? canon;
}

export function noiseLabel(value: string | null | undefined): string {
  const canon = normalizeNoiseLevel(value);
  if (!canon) return value?.trim() || '';
  return NOISE_OPTIONS.find((o) => o.value === canon)?.label ?? canon;
}

export function plugsLabel(value: string | null | undefined): string {
  const canon = normalizePlugsLevel(value);
  if (!canon) return value?.trim() || '';
  return PLUGS_OPTIONS.find((o) => o.value === canon)?.label ?? canon;
}

/** Affichage FR pour laptop_policy (`always` en seed). */
export function laptopLabel(value: string | null | undefined): string {
  if (value == null || !value.trim()) return '';
  switch (keyOf(value)) {
    case 'always':
    case 'allowed':
    case 'autorisé':
    case 'autorise':
      return 'Autorisé';
    case 'sometimes':
    case 'restricted':
      return 'Sur demande';
    case 'never':
    case 'prohibited':
      return 'Interdit';
    default:
      return value.trim();
  }
}
