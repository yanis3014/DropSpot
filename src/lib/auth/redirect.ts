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

  if (isProEntryPath(preferred)) {
    return opts.isPro ? '/dashboard-pro' : '/dashboard-pro/onboarding';
  }

  if (opts.isPro && preferred.startsWith('/dashboard-pro')) {
    return preferred;
  }

  if (!opts.onboardingCompleted) {
    return '/onboarding';
  }

  if (preferred.startsWith('/dashboard-pro')) {
    return opts.isPro ? preferred : '/dashboard-pro/onboarding';
  }

  return preferred;
}

/** @deprecated use destinationAfterAuth with isPro */
export function isVendorRole(role: string | null | undefined): boolean {
  return role === 'vendor' || role === 'owner';
}

/** @deprecated use destinationAfterAuth */
export function destinationForProfile(
  profile: {
    role?: string | null;
    onboarding_completed_at?: string | null;
  } | null,
  preferredNext?: string | null
): string {
  const isPro = isVendorRole(profile?.role);
  return destinationAfterAuth(
    {
      isPro,
      onboardingCompleted: Boolean(profile?.onboarding_completed_at),
    },
    preferredNext
  );
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
