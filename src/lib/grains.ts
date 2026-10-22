// Grains are credited by the server only and recorded in grains_transactions.
// This file holds the display copy of the server constants and the level rules.
// Levels use the Grains earned over time (lifetime), never the balance.

/** Server constants (check_in, vote_place_spec, places_reward_suggestion…). */
export const GRAINS_EARNING: { amount: number; label: string }[] = [
  { amount: 10, label: 'Dire « Je suis ici » dans un café (une fois toutes les 3 h par café)' },
  { amount: 5, label: 'Répondre Oui / Non sur une spécificité, sur place' },
  { amount: 20, label: 'Être présent à un événement où tu t’es inscrit' },
  { amount: 50, label: 'Un café que tu as ajouté rejoint Dropspot' },
];

/**
 * Status that unlocks reserved places on limited drops (must stay in sync
 * with is_priority_member() and drop_reserved_places() in the database).
 */
export const PRIORITY_LIFETIME = 100;
export const PRIORITY_MIN_CAPACITY = 5;
export const PRIORITY_SHARE = 0.2;

/** Places kept for priority members on a limited drop. */
export function reservedPlaces(capacity: number | null | undefined): number {
  if (capacity == null || capacity < PRIORITY_MIN_CAPACITY) return 0;
  return Math.ceil(capacity * PRIORITY_SHARE);
}

export type BadgeDef = {
  name: string;
  threshold: number;
  icon: string;
};

export const GRAIN_BADGES: BadgeDef[] = [
  { name: 'Novice', threshold: 0, icon: '🌱' },
  { name: 'Explorateur', threshold: 100, icon: '🧭' },
  { name: "L'Habitué", threshold: 300, icon: '☕' },
  { name: 'Légende Locale', threshold: 1000, icon: '👑' },
];

/** Highest unlocked badge for the given lifetime score. */
export function currentBadge(totalGrains: number): BadgeDef {
  let unlocked = GRAIN_BADGES[0];
  for (const badge of GRAIN_BADGES) {
    if (totalGrains >= badge.threshold) unlocked = badge;
  }
  return unlocked;
}

/** Next badge to unlock, or null if already at the top. */
export function nextBadge(totalGrains: number): BadgeDef | null {
  return GRAIN_BADGES.find((b) => b.threshold > totalGrains) ?? null;
}

/** Progress toward the next level badge (0–100). */
export function badgeProgress(totalGrains: number): {
  current: BadgeDef;
  next: BadgeDef | null;
  remaining: number;
  percent: number;
} {
  const current = currentBadge(totalGrains);
  const next = nextBadge(totalGrains);
  if (!next) {
    return { current, next: null, remaining: 0, percent: 100 };
  }
  const span = Math.max(1, next.threshold - current.threshold);
  const done = Math.max(0, totalGrains - current.threshold);
  return {
    current,
    next,
    remaining: Math.max(0, next.threshold - totalGrains),
    percent: Math.min(100, Math.round((done / span) * 100)),
  };
}
