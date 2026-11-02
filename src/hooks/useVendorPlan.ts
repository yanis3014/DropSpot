'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_PLAN,
  getPlanFeatureGrid,
  getVendorPlan,
  type VendorPlanState,
} from '@/lib/api/vendorPlan';
import {
  cheapestPlanWith,
  DEFAULT_FEATURE_GRID,
  type PlanFeatureGrid,
  type PlanFeatureKey,
  type PlanId,
} from '@/lib/pro/planFeatures';

export type UseVendorPlan = VendorPlanState & {
  loading: boolean;
  grid: PlanFeatureGrid;
  /** La fonction est-elle incluse dans l'offre en vigueur ? */
  hasFeature: (feature: PlanFeatureKey) => boolean;
  /** Offre la moins chère qui débloque la fonction (pour les cadenas). */
  planFor: (feature: PlanFeatureKey) => PlanId;
};

/**
 * Offre du café actif (placeId) ou, à défaut, du compte connecté, plus la
 * grille des fonctions. Le serveur applique les mêmes règles : ceci ne sert
 * qu'à afficher les cadenas au bon endroit.
 */
export function useVendorPlan(enabled = true, placeId?: string | null): UseVendorPlan {
  const [state, setState] = useState<VendorPlanState>(DEFAULT_PLAN);
  const [grid, setGrid] = useState<PlanFeatureGrid>(DEFAULT_FEATURE_GRID);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void Promise.all([getVendorPlan(placeId), getPlanFeatureGrid()]).then(
      ([next, nextGrid]) => {
        if (cancelled) return;
        setState(next);
        setGrid(nextGrid);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [enabled, placeId]);

  const hasFeature = useCallback(
    (feature: PlanFeatureKey) => state.features.includes(feature),
    [state.features]
  );
  const planFor = useCallback(
    (feature: PlanFeatureKey) => cheapestPlanWith(feature, grid) ?? 'premium',
    [grid]
  );

  return { ...state, loading, grid, hasFeature, planFor };
}
