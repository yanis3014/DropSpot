'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { clearDropspotMode } from '@/lib/auth/dropspotMode';

/**
 * Client-side auth state, kept in sync with the Supabase session cookie.
 * `getUser()` validates the cookie on mount; `onAuthStateChange` keeps the
 * state fresh afterwards (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED...).
 */
/**
 * One `getUser()` request shared by every component mounted at the same time
 * (a list renders one FavoriteButton per café, each calling useAuth).
 */
let pendingUser: Promise<User | null> | null = null;

function fetchUserOnce(): Promise<User | null> {
  if (!supabase) return Promise.resolve(null);
  if (!pendingUser) {
    pendingUser = supabase.auth
      .getUser()
      .then(({ data }) => data.user ?? null)
      .catch(() => null)
      .finally(() => {
        pendingUser = null;
      });
  }
  return pendingUser;
}

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    void fetchUserOnce().then((u) => {
      setUser(u);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null)
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Déconnexion unifiée : clear session + état local + redirect `/login`.
   */
  const signOut = useCallback(async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('signOut error:', err);
    } finally {
      setUser(null);
      clearDropspotMode();
      router.push('/login');
      router.refresh();
    }
  }, [router]);

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
