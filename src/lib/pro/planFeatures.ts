/*
 * Offres pro et fonctions réglables depuis /admin/offres.
 *
 * La vérité est en base (table plan_features, lue par chaque verrou serveur).
 * Ce fichier ne fait que nommer les offres et les fonctions pour l'interface,
 * et donne la grille de départ utilisée tant que la base n'a pas répondu.
 */

export type PlanId = 'presence' | 'analytics' | 'premium';

export const PLAN_IDS: PlanId[] = ['presence', 'analytics', 'premium'];

export const PLAN_LABELS: Record<PlanId, string> = {
  presence: 'Présence',
  analytics: 'Analytics',
  premium: 'Premium',
};

export type PlanFeatureKey =
  | 'drops'
  | 'recurring_drops'
  | 'team_staff'
  | 'team_manager'
  | 'gallery_full'
  | 'stats_history'
  | 'stats_insights';

export type PlanFeature = {
  key: PlanFeatureKey;
  label: string;
  description: string;
  /** Pas encore livrée dans l'app : réglable, mais rien à débloquer pour l'instant. */
  soon?: boolean;
};

/** Ordre d'affichage (admin et page Abonnement). */
export const PLAN_FEATURES: PlanFeature[] = [
  {
    key: 'drops',
    label: 'Drops et événements',
    description: 'Créer et modifier des drops ponctuels, validés au comptoir par QR ou code.',
  },
  {
    key: 'recurring_drops',
    label: 'Drops récurrents',
    description: 'Un drop qui revient chaque semaine, publié tout seul.',
    soon: true,
  },
  {
    key: 'team_staff',
    label: 'Équipiers',
    description: 'Inviter des équipiers qui valident les codes au comptoir.',
  },
  {
    key: 'team_manager',
    label: 'Rôle Responsable',
    description: 'Un membre de l’équipe peut créer et arrêter des drops.',
  },
  {
    key: 'gallery_full',
    label: 'Galerie complète',
    description: 'Plus de 3 photos du lieu, photos des plats et de la carte.',
  },
  {
    key: 'stats_history',
    label: 'Statistiques 30 et 90 jours',
    description: 'Les chiffres de la fiche sur un mois ou un trimestre, avec la comparaison.',
  },
  {
    key: 'stats_insights',
    label: 'Heures de pointe et visiteurs',
    description: 'Heures de pointe, nouveaux clients et habitués, détail par drop.',
  },
];

export type PlanFeatureGrid = Record<PlanFeatureKey, PlanId[]>;

/** Grille de départ (même valeurs que la migration 20261102120000_plan_features). */
export const DEFAULT_FEATURE_GRID: PlanFeatureGrid = {
  drops: ['presence', 'analytics', 'premium'],
  team_staff: ['presence', 'analytics', 'premium'],
  stats_history: ['analytics', 'premium'],
  stats_insights: ['analytics', 'premium'],
  team_manager: ['premium'],
  gallery_full: ['premium'],
  recurring_drops: ['premium'],
};

const FEATURE_KEYS = new Set<string>(PLAN_FEATURES.map((f) => f.key));

export function isPlanFeatureKey(value: unknown): value is PlanFeatureKey {
  return typeof value === 'string' && FEATURE_KEYS.has(value);
}

/** Accepte aussi les anciennes valeurs (free → presence, pro → premium). */
export function normalizePlanId(value: unknown): PlanId {
  if (value === 'analytics' || value === 'premium' || value === 'presence') return value;
  if (value === 'pro') return 'premium';
  return 'presence';
}

/** Offres valides, sans doublon, dans l'ordre Présence → Premium. */
export function normalizePlanList(values: unknown): PlanId[] {
  if (!Array.isArray(values)) return [];
  const set = new Set(values.filter((v): v is PlanId => PLAN_IDS.includes(v as PlanId)));
  return PLAN_IDS.filter((p) => set.has(p));
}

/** Grille complète à partir des lignes de plan_features (fonction absente = verrouillée). */
export function gridFromRows(
  rows: { feature: string; plans: unknown }[] | null | undefined
): PlanFeatureGrid {
  const grid = Object.fromEntries(
    PLAN_FEATURES.map((f) => [f.key, [] as PlanId[]])
  ) as PlanFeatureGrid;
  for (const row of rows ?? []) {
    if (isPlanFeatureKey(row.feature)) grid[row.feature] = normalizePlanList(row.plans);
  }
  return grid;
}

/** Fonctions incluses dans une offre selon la grille. */
export function featuresForPlan(plan: PlanId, grid: PlanFeatureGrid): PlanFeatureKey[] {
  return PLAN_FEATURES.map((f) => f.key).filter((k) => grid[k].includes(plan));
}

/** La moins chère des offres qui donnent accès à la fonction, ou null si aucune. */
export function cheapestPlanWith(
  feature: PlanFeatureKey,
  grid: PlanFeatureGrid
): PlanId | null {
  return PLAN_IDS.find((p) => grid[feature].includes(p)) ?? null;
}

/** Offres qui perdent la fonction entre deux réglages. */
export function removedPlans(before: PlanId[], after: PlanId[]): PlanId[] {
  return before.filter((p) => !after.includes(p));
}
