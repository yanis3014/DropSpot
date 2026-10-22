// Grains are credited by the server only (check_in, claim_welcome_grains,
// redeem_drop_code RPCs) and recorded in grains_transactions. This file only
// holds the display rules for levels and badges.

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
