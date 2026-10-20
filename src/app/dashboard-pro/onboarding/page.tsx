'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardProShell from '@/app/dashboard-pro/components/DashboardProShell';
import VendorOnboardingWizard from '@/app/dashboard-pro/components/VendorOnboardingWizard';
import { useRequireVendor } from '@/app/dashboard-pro/hooks/useRequireVendor';
import { countVendorPlaces } from '@/app/dashboard-pro/lib/api/vendor';

export default function DashboardProOnboardingPage() {
  const router = useRouter();
  const { profile, loading, denied, displayName, signOut } = useRequireVendor();
  const [checkingPlaces, setCheckingPlaces] = useState(true);

  // Déjà configuré → dashboard ; sinon reste sur le tunnel
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      setCheckingPlaces(true);
      try {
        const n = await countVendorPlaces(profile.id);
        if (!cancelled && n > 0) {
          router.replace('/dashboard-pro');
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setCheckingPlaces(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, router]);

  if (loading || (profile && checkingPlaces)) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="px-5 pt-8">
        <Link href="/" className="text-sm font-semibold text-brand-mocha">
          ← Retour
        </Link>
        <p className="mt-6 font-bold text-brand-espresso">
          Accès restaurateur requis
        </p>
        <p className="mt-2 text-sm text-brand-mocha">
          Seuls les comptes <strong>vendor</strong> ou <strong>owner</strong>{' '}
          peuvent configurer un établissement.
        </p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <DashboardProShell
      title="Configurer ton café"
      subtitle={
        displayName
          ? `${displayName} · première connexion`
          : 'Première connexion restaurateur'
      }
      hideNav
      actions={
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-xs font-semibold text-brand-mocha hover:text-brand-espresso shrink-0"
        >
          Déconnexion
        </button>
      }
    >
      <VendorOnboardingWizard />
    </DashboardProShell>
  );
}
