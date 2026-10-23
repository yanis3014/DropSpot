'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import WelcomeStep from '@/components/onboarding/WelcomeStep';
import { useAuth } from '@/lib/hooks/useAuth';
import { hasSeenOnboarding } from '@/lib/onboardingStorage';

/**
 * Entry screen of the app for anyone signed out: each opening (via `/`) and
 * after signing out. Envies come next for a first visit, the map otherwise.
 */
export default function WelcomePage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[80] bg-[#14100d]" />}>
      <WelcomeContent />
    </Suspense>
  );
}

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading } = useAuth();
  const signedOut = searchParams.get('deconnexion') === '1';

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace('/');
  }, [isAuthenticated, loading, router]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-y-auto">
      <WelcomeStep
        notice={signedOut ? 'Déconnexion faite. À bientôt !' : null}
        onStart={() =>
          router.push(hasSeenOnboarding() ? '/map' : '/onboarding?start=envies')
        }
        onLogin={() => router.push('/login')}
        onPro={() => router.push('/pro')}
      />
    </div>
  );
}
