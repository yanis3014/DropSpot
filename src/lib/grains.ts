const GRAINS_KEY = 'dropspot_grains';
export const CHECKIN_GRAINS_REWARD = 10;

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
  const next = Math.max(0, getGrainsBalance() + Math.floor(amount));
  try {
    localStorage.setItem(GRAINS_KEY, String(next));
  } catch {
    // ignore quota / private mode
  }
  return next;
}
