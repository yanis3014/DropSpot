import type { PlaceMemberRole } from '@/app/(pro)/dashboard-pro/lib/api/vendor';

const OWNER_ONLY_PREFIXES = ['/equipe', '/abonnement'];

/** Établissement, spécificités, réglages : tous les rôles. */
const ETABLISSEMENT_PREFIX = '/etablissement';
const SPECIFICITES_PREFIX = '/specificites';
const REGLAGES_PREFIX = '/reglages';

const READ_ALL_ROLES_PREFIXES = [
  ETABLISSEMENT_PREFIX,
  SPECIFICITES_PREFIX,
  REGLAGES_PREFIX,
];

const MANAGER_EXTRA_PREFIXES = [
  '/dashboard-pro/drops',
  ...READ_ALL_ROLES_PREFIXES,
];

function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** French role labels (équipe + matrice). */
export const TEAM_ROLE_LABELS: Record<PlaceMemberRole, string> = {
  owner: 'Gérant·e',
  manager: 'Responsable',
  staff: 'Équipier·e',
};

/** Capability rows shared by menu guards and « Qui peut faire quoi ». */
export type TeamCapabilityId =
  | 'validate_drop'
  | 'view_home'
  | 'manage_drops'
  | 'edit_place'
  | 'propose_info'
  | 'team_and_billing';

export type TeamCapabilityRow = {
  id: TeamCapabilityId;
  label: string;
  owner: boolean;
  manager: boolean;
  staff: boolean;
};

/** Source of truth for the équipe permission matrix (maquette 08). */
export const TEAM_CAPABILITY_MATRIX: TeamCapabilityRow[] = [
  {
    id: 'validate_drop',
    label: 'Valider un drop',
    owner: true,
    manager: true,
    staff: true,
  },
  {
    id: 'view_home',
    label: 'Voir l’accueil du jour',
    owner: true,
    manager: true,
    staff: true,
  },
  {
    id: 'manage_drops',
    label: 'Créer, arrêter un drop',
    owner: true,
    manager: true,
    staff: false,
  },
  {
    id: 'edit_place',
    label: 'Modifier la fiche',
    owner: true,
    manager: false,
    staff: false,
  },
  {
    id: 'propose_info',
    label: 'Proposer ou contester une info',
    owner: true,
    manager: false,
    staff: false,
  },
  {
    id: 'team_and_billing',
    label: 'Équipe et abonnement',
    owner: true,
    manager: false,
    staff: false,
  },
];

export function roleHasCapability(
  role: PlaceMemberRole | null,
  capability: TeamCapabilityId
): boolean {
  if (!role) return false;
  const row = TEAM_CAPABILITY_MATRIX.find((r) => r.id === capability);
  if (!row) return false;
  return row[role];
}

/** Owner-only team admin actions (invite, edit role, cancel invite). */
export function canManageTeam(role: PlaceMemberRole | null): boolean {
  return role === 'owner';
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
  if (pathname.startsWith('/dashboard-pro/invitation/')) return true;

  if (READ_ALL_ROLES_PREFIXES.some((prefix) => pathMatches(pathname, prefix))) {
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
  if (
    READ_ALL_ROLES_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    )
  ) {
    return role === 'owner' || role === 'manager' || role === 'staff';
  }
  if (role === 'staff') {
    return (
      path === '/dashboard-pro' ||
      path === '/valider' ||
      path === SPECIFICITES_PREFIX ||
      path === REGLAGES_PREFIX
    );
  }
  if (role === 'manager') {
    return (
      path === '/dashboard-pro' ||
      path === '/valider' ||
      path === '/dashboard-pro/drops' ||
      path.startsWith('/dashboard-pro/drops/') ||
      path === ETABLISSEMENT_PREFIX ||
      path === SPECIFICITES_PREFIX ||
      path === REGLAGES_PREFIX
    );
  }
  return true;
}

export function isOwnerOnlyPath(pathname: string): boolean {
  return OWNER_ONLY_PREFIXES.some((prefix) => pathMatches(pathname, prefix));
}
