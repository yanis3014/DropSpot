'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMyProfile, upsertMyProfile, Profile, ProfilePatch } from '@/lib/api/profiles';

/**
 * Loads the signed-in user's profile row. `loading` stays true until the
 * first fetch resolves so callers can avoid flashing the wrong UI.
 */
export function useProfile(isAuthenticated: boolean, authLoading: boolean) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const load = isAuthenticated ? getMyProfile() : Promise.resolve(null);
    load.then((row) => {
      if (cancelled) return;
      setProfile(row);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  const refresh = useCallback(async () => {
    setProfile(isAuthenticated ? await getMyProfile() : null);
  }, [isAuthenticated]);

  const save = useCallback(async (patch: ProfilePatch) => {
    const updated = await upsertMyProfile(patch);
    setProfile(updated);
    return updated;
  }, []);

  return { profile, loading, refresh, save };
}
