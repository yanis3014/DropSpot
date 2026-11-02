import { supabase } from '@/lib/supabase/client';
import {
  DEFAULT_FEATURE_GRID,
  featuresForPlan,
  gridFromRows,
  isPlanFeatureKey,
  normalizePlanId,
  type PlanFeatureGrid,
  type PlanFeatureKey,
  type PlanId,
} from '@/lib/pro/planFeatures';

export type VendorPlanId = PlanId;

export interface VendorPlanState {
  /** Offre enregistrée (peut être expirée, voir effectivePlan). */
  plan: PlanId;
  /** Offre en vigueur : repasse en Présence après proUntil. */
  effectivePlan: PlanId;
  proUntil: string | null;
  /** Offre payante en cours (Analytics ou Premium). */
  hasPro: boolean;
  features: PlanFeatureKey[];
}

export const DEFAULT_PLAN: VendorPlanState = {
  plan: 'presence',
  effectivePlan: 'presence',
  proUntil: null,
  hasPro: false,
  features: featuresForPlan('presence', DEFAULT_FEATURE_GRID),
};

type PlanRow = {
  ok?: boolean;
  plan?: string;
  pro_until?: string | null;
  has_pro?: boolean;
  effective_plan?: string;
  features?: unknown;
} | null;

/** Parse my_vendor_plan / place_plan (tolère l'ancien format free/pro). */
export function parsePlanRow(row: PlanRow): VendorPlanState {
  if (!row?.ok) return DEFAULT_PLAN;
  const plan = normalizePlanId(row.plan);
  const hasPro = Boolean(row.has_pro);
  const effectivePlan = row.effective_plan
    ? normalizePlanId(row.effective_plan)
    : hasPro
      ? plan
      : 'presence';
  const features = Array.isArray(row.features)
    ? row.features.filter(isPlanFeatureKey)
    : featuresForPlan(effectivePlan, DEFAULT_FEATURE_GRID);
  return { plan, effectivePlan, proUntil: row.pro_until ?? null, hasPro, features };
}

/**
 * Offre du café (celle de son gérant) quand placeId est connu, sinon celle
 * du compte connecté. Un responsable ou un équipier voit l'offre du café.
 */
export async function getVendorPlan(placeId?: string | null): Promise<VendorPlanState> {
  if (!supabase) return DEFAULT_PLAN;

  if (placeId) {
    const { data, error } = await supabase.rpc('place_plan', { p_place: placeId });
    if (!error) return parsePlanRow(data as PlanRow);
    // Base pas encore migrée : on retombe sur l'offre du compte.
    console.warn('place_plan error:', error.message);
  }

  const { data, error } = await supabase.rpc('my_vendor_plan');
  if (error) {
    console.error('my_vendor_plan error:', error);
    return DEFAULT_PLAN;
  }
  return parsePlanRow(data as PlanRow);
}

/** @deprecated Utiliser getVendorPlan(placeId). */
export function getMyVendorPlan(): Promise<VendorPlanState> {
  return getVendorPlan(null);
}

/** Grille des fonctions par offre (lisible par tout compte connecté). */
export async function getPlanFeatureGrid(): Promise<PlanFeatureGrid> {
  if (!supabase) return DEFAULT_FEATURE_GRID;
  const { data, error } = await supabase.from('plan_features').select('feature, plans');
  if (error || !data) return DEFAULT_FEATURE_GRID;
  return gridFromRows(data as { feature: string; plans: unknown }[]);
}

/** Maps Supabase/Postgres plan errors to a stable client code. */
export function isProRequiredError(message?: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes('pro_required') || m.includes('pro required') || m.includes('not in this plan');
}
