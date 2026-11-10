import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseProAccessStatus,
  PRO_WAITING_PATH,
  type ProAccessState,
} from '@/lib/pro/accessStatus';

export type ProfileRole = 'user' | 'vendor' | 'owner';

/** Base used only to check that a path stays on the same origin. */
const SAME_ORIGIN_PROBE = 'https://dropspot.invalid';

/** Char code of the backslash, which browsers treat as a forward slash. */
const BACKSLASH = 92;

/**
 * Only allow same-origin relative paths (open-redirect safe).
 *
 * Browsers read `\` as `/` and drop tabs / new lines inside a URL, so
 * `/\evil.example` or `/<tab>/evil.example` would leave the site even though
 * they start with a single `/`. Those are refused, then the URL parser has the
 * last word: the path must resolve on the same origin.
 */
export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  // Backslashes and control characters (tab, CR, LF…) have no place in a path.
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code === BACKSLASH || code < 32 || code === 127) return '/';
  }
  try {
    if (new URL(raw, SAME_ORIGIN_PROBE).origin !== SAME_ORIGIN_PROBE) return '/';
  } catch {
    return '/';
  }
  return raw;
}

function isAdminPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/');
}

function isProEntryPath(path: string): boolean {
  return (
    path === '/pro' ||
    path.startsWith('/pro/') ||
    path.startsWith('/dashboard-pro')
  );
}

/** Vague landing paths — a pro should land on the dashboard instead. */
function isVaguePreferredPath(path: string): boolean {
  return path === '/' || path === '/map' || path === '/login';
}

function isOnboardingPath(path: string): boolean {
  return (
    path === '/onboarding' ||
    path.startsWith('/onboarding?') ||
    path.startsWith('/onboarding/')
  );
}

/** Client onboarding, keeping the page the user was heading to (`?next=`). */
export function clientOnboardingPath(preferred: string): string {
  if (isVaguePreferredPath(preferred) || isOnboardingPath(preferred)) {
    return '/onboarding';
  }
  return `/onboarding?next=${encodeURIComponent(preferred)}`;
}

/**
 * Destination post-auth selon is_pro et onboarding client.
 */
export function destinationAfterAuth(
  opts: {
    isPro: boolean;
    onboardingCompleted: boolean;
    isAdmin?: boolean;
    /** From pro_access_status; `pending` = café request under review. */
    proState?: ProAccessState | null;
  },
  preferredNext?: string | null
): string {
  const preferred = safeRedirectPath(preferredNext ?? null);

  // Invitation link: a client account must reach it to become pro.
  if (preferred.startsWith('/dashboard-pro/invitation/')) {
    return preferred;
  }

  // An admin signing in lands on the admin console, unless a precise page
  // (a café, an invitation, the pro space…) was asked for.
  if (opts.isAdmin) {
    if (isVaguePreferredPath(preferred) || isOnboardingPath(preferred)) {
      return '/admin';
    }
    if (isAdminPath(preferred)) return preferred;
  }

  if (opts.isPro) {
    // Never send a pro to the client onboarding, or to a vague landing page.
    if (
      isVaguePreferredPath(preferred) ||
      isOnboardingPath(preferred)
    ) {
      return '/dashboard-pro';
    }
    if (isProEntryPath(preferred)) {
      return preferred.startsWith('/dashboard-pro')
        ? preferred
        : '/dashboard-pro';
    }
    return preferred;
  }

  if (isProEntryPath(preferred)) {
    return PRO_WAITING_PATH;
  }

  // Café request still under review: back to the waiting screen, not the
  // client app, unless a precise page was asked for.
  if (
    opts.proState === 'pending' &&
    (isVaguePreferredPath(preferred) || isOnboardingPath(preferred))
  ) {
    return PRO_WAITING_PATH;
  }

  if (!opts.onboardingCompleted) {
    return clientOnboardingPath(preferred);
  }

  return preferred;
}

/** Charge is_pro + profil et calcule la destination. */
export async function resolvePostAuthDestination(
  supabase: SupabaseClient,
  userId: string,
  preferredNext?: string | null
): Promise<string> {
  const [
    { data: profile },
    { data: isProRaw, error: proError },
    { data: isAdminRaw },
    { data: proStatusRaw, error: proStatusError },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', userId)
      .maybeSingle(),
    supabase.rpc('is_pro', { p_user: userId }),
    // Membership only: the 6-digit code is asked on /admin itself.
    supabase.rpc('is_admin_member'),
    supabase.rpc('pro_access_status'),
  ]);

  if (proError) {
    console.error('resolvePostAuthDestination is_pro:', proError.message);
  }

  return destinationAfterAuth(
    {
      isPro: Boolean(isProRaw),
      onboardingCompleted: Boolean(profile?.onboarding_completed_at),
      isAdmin: Boolean(isAdminRaw),
      proState: proStatusError ? null : parseProAccessStatus(proStatusRaw).state,
    },
    preferredNext
  );
}
