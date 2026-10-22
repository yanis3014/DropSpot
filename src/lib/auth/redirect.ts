import type { SupabaseClient } from '@supabase/supabase-js';

export type ProfileRole = 'user' | 'vendor' | 'owner';

/** Only allow same-origin relative paths (open-redirect safe). */
export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function isProEntryPath(path: string): boolean {
  return (
    path === '/pro' ||
    path.startsWith('/pro/') ||
    path.startsWith('/dashboard-pro')
  );
}

/**
 * Destination post-auth selon is_pro et onboarding client.
 */
export function destinationAfterAuth(
  opts: {
    isPro: boolean;
    onboardingCompleted: boolean;
  },
  preferredNext?: string | null
): string {
  const preferred = safeRedirectPath(preferredNext ?? null);

  // Invitation link: a client account must reach it to become pro.
  if (preferred.startsWith('/dashboard-pro/invitation/')) {
    return preferred;
  }

  if (isProEntryPath(preferred)) {
    if (!opts.isPro) return '/dashboard-pro/onboarding';
    return preferred.startsWith('/dashboard-pro') ? preferred : '/dashboard-pro';
  }

  if (!opts.onboardingCompleted) {
    return '/onboarding';
  }

  return preferred;
}

/** Charge is_pro + profil et calcule la destination. */
export async function resolvePostAuthDestination(
  supabase: SupabaseClient,
  userId: string,
  preferredNext?: string | null
): Promise<string> {
  const [{ data: profile }, { data: isProRaw, error: proError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('onboarding_completed_at')
        .eq('id', userId)
        .maybeSingle(),
      supabase.rpc('is_pro', { p_user: userId }),
    ]);

  if (proError) {
    console.error('resolvePostAuthDestination is_pro:', proError.message);
  }

  return destinationAfterAuth(
    {
      isPro: Boolean(isProRaw),
      onboardingCompleted: Boolean(profile?.onboarding_completed_at),
    },
    preferredNext
  );
}
