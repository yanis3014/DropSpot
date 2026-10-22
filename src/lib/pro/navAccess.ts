import type { PlaceMemberRole } from '@/app/(pro)/dashboard-pro/lib/api/vendor';

const OWNER_ONLY_PREFIXES = [
  '/specificites',
  '/equipe',
  '/abonnement',
  '/reglages',
  '/dashboard-pro/settings',
];

/** Établissement : lecture pour tous les rôles ; écriture owner (RLS). */
const ETABLISSEMENT_PREFIX = '/etablissement';

const MANAGER_EXTRA_PREFIXES = ['/dashboard-pro/drops', ETABLISSEMENT_PREFIX];

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

  if (pathMatches(pathname, ETABLISSEMENT_PREFIX)) {
    return role === 'owner' || role === 'manager' || role === 'staff';
  }

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
  if (path === ETABLISSEMENT_PREFIX || path.startsWith(`${ETABLISSEMENT_PREFIX}/`)) {
    return role === 'owner' || role === 'manager' || role === 'staff';
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
