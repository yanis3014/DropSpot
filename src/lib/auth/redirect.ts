import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseProAccessStatus,
  PRO_WAITING_PATH,
  type ProAccessState,
} from '@/lib/pro/accessStatus';

export type ProfileRole = 'user' | 'vendor' | 'owner';

/** Only allow same-origin relative paths (open-redirect safe). */
export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
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
