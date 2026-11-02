export const PRO_INTENT_KEY = 'dropspot_pro_intent';

/** Café name typed on the landing, carried over to the claim wizard. */
export const PRO_CLAIM_QUERY_KEY = 'dropspot_pro_claim_query';

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
  clearProClaimQuery();
}

/**
 * Navigation seulement : ne donne aucun droit.
 * Remembers the café name typed in the landing search so the claim wizard
 * opens with the search already filled in — same 24 h lifetime as the
 * intent, same survival through sign-in detours.
 */
export function writeProClaimQuery(name: string): void {
  writeProIntent();
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      PRO_CLAIM_QUERY_KEY,
      JSON.stringify({ name: name.slice(0, 80), at: Date.now() })
    );
  } catch {
    // Private mode / quota — ignore.
  }
}

export function readProClaimQuery(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PRO_CLAIM_QUERY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const name = (parsed as { name?: unknown }).name;
    const at = (parsed as { at?: unknown }).at;
    if (
      typeof name !== 'string' ||
      typeof at !== 'number' ||
      Date.now() - at > PRO_INTENT_TTL_MS
    ) {
      localStorage.removeItem(PRO_CLAIM_QUERY_KEY);
      return null;
    }
    return name;
  } catch {
    // Invalid JSON — forget it.
    try {
      localStorage.removeItem(PRO_CLAIM_QUERY_KEY);
    } catch {
      // Private mode — ignore.
    }
    return null;
  }
}

export function clearProClaimQuery(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PRO_CLAIM_QUERY_KEY);
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
