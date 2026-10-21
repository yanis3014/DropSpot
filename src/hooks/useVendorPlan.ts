'use client';

import { useEffect, useState } from 'react';
import {
  getMyVendorPlan,
  type VendorPlanState,
} from '@/lib/api/vendorPlan';

const DEFAULT: VendorPlanState = {
  plan: 'free',
  proUntil: null,
  hasPro: false,
};

export function useVendorPlan(enabled = true): VendorPlanState & { loading: boolean } {
  const [state, setState] = useState<VendorPlanState>(DEFAULT);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    void getMyVendorPlan().then((next) => {
      if (!cancelled) {
        setState(next);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { ...state, loading };
}
