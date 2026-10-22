export const DROPSPOT_MODE_KEY = 'dropspot_mode';

export type DropspotMode = 'client' | 'pro';

export function readDropspotMode(): DropspotMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DROPSPOT_MODE_KEY);
    if (raw === 'client' || raw === 'pro') return raw;
    return null;
  } catch {
    return null;
  }
}

export function writeDropspotMode(mode: DropspotMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DROPSPOT_MODE_KEY, mode);
  } catch {
    // Private mode / quota — ignore.
  }
}
