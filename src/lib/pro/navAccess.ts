import type { PlaceMemberRole } from '@/app/(pro)/dashboard-pro/lib/api/vendor';

const OWNER_ONLY_PREFIXES = [
  '/etablissement',
  '/specificites',
  '/equipe',
  '/abonnement',
  '/reglages',
  '/dashboard-pro/settings',
];

const MANAGER_EXTRA_PREFIXES = ['/dashboard-pro/drops'];

function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Route guard when user deep-links into a pro screen. */
export function canAccessProPath(
  pathname: string,
  role: PlaceMemberRole | null
): boolean {
  if (!role) return false;
  if (
    pathname === '/dashboard-pro' ||
    pathname.startsWith('/dashboard-pro/onboarding')
  ) {
    return true;
  }
  if (pathname === '/valider' || pathname.startsWith('/valider/')) return true;
  if (pathname.startsWith('/dashboard-pro/validate')) return true;
  if (pathname.startsWith('/dashboard-pro/invitation/')) return true;

  if (role === 'staff') {
    return false;
  }

  if (role === 'manager') {
    return MANAGER_EXTRA_PREFIXES.some((prefix) =>
      pathMatches(pathname, prefix)
    );
  }

  return true;
}

/** Sidebar / bottom nav item visibility. */
export function filterProNavHref(
  href: string,
  role: PlaceMemberRole | null
): boolean {
  const path = href.split('?')[0] ?? href;
  if (!role) return false;
  if (path === '/dashboard-pro' || path === '/valider') return true;
  if (path === '/dashboard-pro/drops' || path.startsWith('/dashboard-pro/drops/')) {
    return role === 'owner' || role === 'manager';
  }
  if (role === 'staff') {
    return path === '/dashboard-pro' || path === '/valider';
  }
  if (role === 'manager') {
    return (
      path === '/dashboard-pro' ||
      path === '/valider' ||
      path === '/dashboard-pro/drops' ||
      path.startsWith('/dashboard-pro/drops/')
    );
  }
  return true;
}

export function isOwnerOnlyPath(pathname: string): boolean {
  return OWNER_ONLY_PREFIXES.some((prefix) => pathMatches(pathname, prefix));
}
