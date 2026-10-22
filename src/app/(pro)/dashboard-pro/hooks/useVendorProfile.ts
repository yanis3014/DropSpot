'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchIsPro,
  getVendorProfile,
  updateVendorProfile,
  VendorProfile,
  VendorProfilePatch,
} from '@/app/(pro)/dashboard-pro/lib/api/vendor';

/**
 * Profil connecté + accès pro (RPC is_pro / place_members).
 */
export function useVendorProfile(isAuthenticated: boolean, authLoading: boolean) {
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const load = isAuthenticated
      ? Promise.all([getVendorProfile(), fetchIsPro()])
      : Promise.resolve([null, false] as const);

    void load.then(([row, pro]) => {
      if (cancelled) return;
      setProfile(row);
      setIsPro(pro);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      setIsPro(false);
      return;
    }
    const [row, pro] = await Promise.all([getVendorProfile(), fetchIsPro()]);
    setProfile(row);
    setIsPro(pro);
  }, [isAuthenticated]);

  const save = useCallback(async (patch: VendorProfilePatch) => {
    const updated = await updateVendorProfile(patch);
    setProfile(updated);
    return updated;
  }, []);

  return { profile, isPro, loading, refresh, save };
}
