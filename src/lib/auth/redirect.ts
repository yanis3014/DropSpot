import type { SupabaseClient } from '@supabase/supabase-js';

export type ProfileRole = 'user' | 'vendor' | 'owner';

export function isVendorRole(role: string | null | undefined): boolean {
  return role === 'vendor' || role === 'owner';
}

/** Only allow same-origin relative paths (open-redirect safe). */
export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

/**
 * Destination post-auth selon le rôle.
 * - vendor/owner → /dashboard-pro
 * - user sans onboarding → /onboarding
 * - user → preferredNext (ex. page précédente) ou /
 */
export function destinationForProfile(
  profile: {
    role?: string | null;
    onboarding_completed_at?: string | null;
  } | null,
  preferredNext?: string | null
): string {
  const preferred = safeRedirectPath(preferredNext ?? null);

  if (isVendorRole(profile?.role)) {
    return preferred.startsWith('/dashboard-pro') ? preferred : '/dashboard-pro';
  }

  if (!profile?.onboarding_completed_at) {
    return '/onboarding';
  }

  // Un client ne doit pas atterrir sur le dashboard pro
  if (preferred.startsWith('/dashboard-pro')) return '/';
  return preferred;
}

/** Charge le profil et calcule la destination. */
export async function resolvePostAuthDestination(
  supabase: SupabaseClient,
  userId: string,
  preferredNext?: string | null
): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, onboarding_completed_at')
    .eq('id', userId)
    .maybeSingle();

  return destinationForProfile(profile, preferredNext);
}
