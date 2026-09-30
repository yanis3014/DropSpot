'use client';

import { useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

/**
 * Client-side auth state, kept in sync with the Supabase session cookie.
 * `getUser()` validates the cookie on mount; `onAuthStateChange` keeps the
 * state fresh afterwards (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED...).
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth
      .getUser()
      .then(({ data }) => setUser(data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    loading,
    signOut,
    // Convenience fields for the profile UI
    email: user?.email ?? null,
    avatarUrl: (user?.user_metadata?.avatar_url as string | undefined) ?? null,
    displayName:
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      user?.email?.split('@')[0] ??
      null,
  };
}
