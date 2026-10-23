export const PRO_INTENT_KEY = 'dropspot_pro_intent';

/** Where a café owner goes once signed in. */
export const PRO_CLAIM_PATH = '/dashboard-pro/onboarding';

/** An intent older than this is forgotten (the user changed their mind). */
const PRO_INTENT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Remembers on this device that the user started "Revendiquer mon café".
 *
 * The `?redirect=` / `?next=` chain gets lost on the way back from Google or
 * from a confirmation e-mail: link opened in another browser (PKCE fails and
 * `/auth/callback` sends back to `/login?error=`), Supabase falling back to
 * the Site URL, installed PWA… The intent survives all of these, so the
 * user still lands on the claim wizard instead of the client app.
 *
 * Navigation only: nothing here grants any access.
 */
export function writeProIntent(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PRO_INTENT_KEY, String(Date.now()));
  } catch {
    // Private mode / quota — ignore.
  }
}

export function hasProIntent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(PRO_INTENT_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || Date.now() - at > PRO_INTENT_TTL_MS) {
      localStorage.removeItem(PRO_INTENT_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function clearProIntent(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PRO_INTENT_KEY);
  } catch {
    // Private mode — ignore.
  }
}

/**
 * Login page: a vague destination (`/`, `/map`…) becomes the claim wizard
 * when the user started a claim on this device.
 */
export function withProIntent(preferred: string, intent: boolean): string {
  if (!intent) return preferred;
  if (preferred === '/' || preferred === '/map' || preferred === '/login') {
    return PRO_CLAIM_PATH;
  }
  if (preferred === '/onboarding' || preferred.startsWith('/onboarding?')) {
    return PRO_CLAIM_PATH;
  }
  return preferred;
}
