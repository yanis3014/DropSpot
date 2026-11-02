import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Where a signed-in user stands in the pro space (RPC `pro_access_status`).
 *
 * - `none`: no café, no request.
 * - `pending`: a café request is waiting for an admin. No pro access.
 * - `welcome`: an admin approved the request, the welcome screen was not
 *   seen yet. Pro access is open (the database already allows it).
 * - `active`: member of at least one verified café.
 *
 * The database decides the real rights (RLS + `has_place_role`, verified
 * cafés only); this is only used to send people to the right screen.
 */
export type ProAccessState = 'none' | 'pending' | 'welcome' | 'active';

export interface ProAccessStatus {
  state: ProAccessState;
  welcome: { claimId: string; placeId: string; placeName: string } | null;
  pending: {
    claimId: string;
    placeId: string;
    placeName: string;
    createdAt: string;
  } | null;
}

export const PRO_WAITING_PATH = '/dashboard-pro/onboarding';
export const PRO_WELCOME_PATH = '/dashboard-pro/bienvenue';
const PRO_INVITATION_PREFIX = '/dashboard-pro/invitation';

/** Pages of the pro space that need an approved café. */
const PRO_GATED_PREFIXES = [
  '/dashboard-pro',
  '/etablissement',
  '/specificites',
  '/equipe',
  '/abonnement',
  '/reglages',
  '/valider',
  '/statistiques',
] as const;

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Request / waiting screen, welcome and invitations stay open to everyone signed in. */
export function isProOpenPath(pathname: string): boolean {
  return (
    matches(pathname, PRO_WAITING_PATH) ||
    matches(pathname, PRO_WELCOME_PATH) ||
    matches(pathname, PRO_INVITATION_PREFIX)
  );
}

export function isProGatedPath(pathname: string): boolean {
  if (isProOpenPath(pathname)) return false;
  return PRO_GATED_PREFIXES.some((prefix) => matches(pathname, prefix));
}

/**
 * Screen to show instead of `pathname`, or null to let the user through.
 * Not approved yet → request / waiting screen. Just approved → welcome first.
 */
export function proGateRedirect(
  pathname: string,
  state: ProAccessState
): string | null {
  if (!isProGatedPath(pathname)) return null;
  if (state === 'active') return null;
  if (state === 'welcome') return PRO_WELCOME_PATH;
  return PRO_WAITING_PATH;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function parseProAccessStatus(raw: unknown): ProAccessStatus {
  const row = (raw ?? {}) as Record<string, unknown>;
  const stateRaw = row.state;
  const state: ProAccessState =
    stateRaw === 'pending' || stateRaw === 'welcome' || stateRaw === 'active'
      ? stateRaw
      : 'none';

  const w = row.welcome as Record<string, unknown> | null | undefined;
  const welcome =
    w && str(w.claim_id) && str(w.place_id)
      ? {
          claimId: String(w.claim_id),
          placeId: String(w.place_id),
          placeName: str(w.place_name) ?? 'ton café',
        }
      : null;

  const p = row.pending as Record<string, unknown> | null | undefined;
  const pending =
    p && str(p.claim_id) && str(p.place_id)
      ? {
          claimId: String(p.claim_id),
          placeId: String(p.place_id),
          placeName: str(p.place_name) ?? 'ton café',
          createdAt: str(p.created_at) ?? '',
        }
      : null;

  return { state, welcome, pending };
}

/**
 * Reads the status. Returns null when the call fails (e.g. the SQL is not in
 * the database yet): callers then keep their previous behaviour.
 */
export async function fetchProAccessStatus(
  client: SupabaseClient | null
): Promise<ProAccessStatus | null> {
  if (!client) return null;
  const { data, error } = await client.rpc('pro_access_status');
  if (error) {
    console.error('pro_access_status:', error.message);
    return null;
  }
  return parseProAccessStatus(data);
}

export async function markProWelcomeSeen(
  client: SupabaseClient | null
): Promise<boolean> {
  if (!client) return false;
  const { data, error } = await client.rpc('mark_pro_welcome_seen');
  if (error) {
    console.error('mark_pro_welcome_seen:', error.message);
    return false;
  }
  return Boolean((data as { ok?: boolean } | null)?.ok);
}
