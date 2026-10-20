'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useVendorProfile } from '@/app/dashboard-pro/hooks/useVendorProfile';

/** Guard client : auth + rôle vendor/owner. */
export function useRequireVendor() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, displayName, email, signOut } =
    useAuth();
  const { profile, loading: profileLoading } = useVendorProfile(
    isAuthenticated,
    authLoading
  );

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!isAuthenticated) {
      router.replace('/login?redirect=/dashboard-pro');
    }
  }, [authLoading, profileLoading, isAuthenticated, router]);

  return {
    profile,
    loading: authLoading || profileLoading,
    isAuthenticated,
    displayName,
    email,
    signOut,
    denied: isAuthenticated && !profileLoading && !profile,
  };
}
