'use client';

import { useCallback, useEffect, useState } from 'react';
import { getVendorProfile, updateVendorProfile, VendorProfile, VendorProfilePatch } from '@/app/dashboard-pro/lib/api/vendor';

/**
 * Hook pour charger le profil du vendeur/propriétaire connecté.
 * Vérifie que l'utilisateur authentifié possède bien le rôle vendor/owner.
 */
export function useVendorProfile(isAuthenticated: boolean, authLoading: boolean) {
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const load = isAuthenticated ? getVendorProfile() : Promise.resolve(null);
    load.then((row) => {
      if (cancelled) return;
      // Vérification du rôle : seul un vendor ou owner peut accéder au dashboard
      if (row && (row.role === 'vendor' || row.role === 'owner')) {
        setProfile(row);
      } else {
        // Utilisateur authentifié mais sans les droits nécessaires
        setProfile(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      return;
    }
    const row = await getVendorProfile();
    if (row && (row.role === 'vendor' || row.role === 'owner')) {
      setProfile(row);
    } else {
      setProfile(null);
    }
  }, [isAuthenticated]);

  const save = useCallback(async (patch: VendorProfilePatch) => {
    const updated = await updateVendorProfile(patch);
    setProfile(updated);
    return updated;
  }, []);

  return { profile, loading, refresh, save };
}