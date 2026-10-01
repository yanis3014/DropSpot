const GRAINS_KEY = 'dropspot_grains';
const GRAINS_COOLDOWN_KEY = 'dropspot_grains_cooldown';
export const CHECKIN_GRAINS_REWARD = 10;
export const JAR_CAPACITY = 100;
/** Same window as live vibe aggregation. */
export const GRAINS_COOLDOWN_MS = 3 * 60 * 60 * 1000;
/** Physical presence required to earn grains. */
export const GRAINS_PROXIMITY_M = 100;

export function getGrainsBalance(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(GRAINS_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function addGrains(amount: number): number {
  if (amount <= 0) return getGrainsBalance();
  const next = Math.max(0, getGrainsBalance() + Math.floor(amount));
  try {
    localStorage.setItem(GRAINS_KEY, String(next));
  } catch {
    // ignore quota / private mode
  }
  return next;
}

function readCooldownMap(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(GRAINS_COOLDOWN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** True if client cooldown allows earning grains at this place. */
export function isGrainsCooldownClear(placeId: string, now = Date.now()): boolean {
  const map = readCooldownMap();
  const last = map[placeId];
  if (!last || !Number.isFinite(last)) return true;
  return now - last >= GRAINS_COOLDOWN_MS;
}

export function markGrainsEarned(placeId: string, now = Date.now()): void {
  try {
    const map = readCooldownMap();
    map[placeId] = now;
    localStorage.setItem(GRAINS_COOLDOWN_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export type GrainsAwardReason = 'ok' | 'cooldown' | 'too_far' | 'no_gps';

export function evaluateGrainsEligibility(input: {
  placeId: string;
  distanceM: number | null;
  /** Server said user checked in within cooldown window. */
  serverCooldownActive?: boolean;
}): { eligible: boolean; reason: GrainsAwardReason; amount: number } {
  if (input.distanceM == null) {
    return { eligible: false, reason: 'no_gps', amount: 0 };
  }
  const nearby =
    Number.isFinite(input.distanceM) &&
    input.distanceM <= GRAINS_PROXIMITY_M;
  if (!nearby) {
    return { eligible: false, reason: 'too_far', amount: 0 };
  }
  if (input.serverCooldownActive || !isGrainsCooldownClear(input.placeId)) {
    return { eligible: false, reason: 'cooldown', amount: 0 };
  }
  return { eligible: true, reason: 'ok', amount: CHECKIN_GRAINS_REWARD };
}

/** Grains currently filling the 100-capacity jar (resets each level). */
export function jarGrainsFromTotal(totalGrains: number): number {
  return Math.max(0, Math.floor(totalGrains)) % JAR_CAPACITY;
}

/** Completed jars / level index from lifetime grains. */
export function levelFromTotal(totalGrains: number): number {
  return Math.floor(Math.max(0, totalGrains) / JAR_CAPACITY);
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
