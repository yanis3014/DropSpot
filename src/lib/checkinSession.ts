/** Single active check-in session (one place at a time). */

export const CHECKIN_SESSION_MS = 3 * 60 * 60 * 1000;
const SESSION_KEY = 'dropspot_checkin_session';

export type CheckInSession = {
  placeId: string;
  placeName: string;
  startedAt: number;
};

function readRaw(): CheckInSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckInSession;
    if (
      !parsed ||
      typeof parsed.placeId !== 'string' ||
      typeof parsed.startedAt !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Active session or null if expired / absent. */
export function getActiveSession(now = Date.now()): CheckInSession | null {
  const session = readRaw();
  if (!session) return null;
  if (now - session.startedAt >= CHECKIN_SESSION_MS) {
    clearCheckInSession();
    return null;
  }
  return session;
}

export function startCheckInSession(
  placeId: string,
  placeName: string,
  now = Date.now()
): CheckInSession {
  const session: CheckInSession = { placeId, placeName, startedAt: now };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
  return session;
}

export function clearCheckInSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function sessionRemainingMs(
  session: CheckInSession,
  now = Date.now()
): number {
  return Math.max(0, CHECKIN_SESSION_MS - (now - session.startedAt));
}

export function formatSessionRemaining(ms: number): string {
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}
