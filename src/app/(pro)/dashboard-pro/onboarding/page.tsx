"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VendorOnboardingWizard from "@/app/(pro)/dashboard-pro/components/VendorOnboardingWizard";
import { useAuth } from "@/lib/hooks/useAuth";
import { useVendorProfile } from "@/app/(pro)/dashboard-pro/hooks/useVendorProfile";
import { countProPlaceMemberships } from "@/app/(pro)/dashboard-pro/lib/api/vendor";

export default function DashboardProOnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, displayName, signOut } =
    useAuth();
  const { isPro, loading: profileLoading } = useVendorProfile(
    isAuthenticated,
    authLoading
  );
  const [checkingPlaces, setCheckingPlaces] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?redirect=/dashboard-pro/onboarding&espace=pro");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || profileLoading) return;
    if (!isPro) {
      setCheckingPlaces(false);
      return;
    }
    let cancelled = false;
    void countProPlaceMemberships().then((n) => {
      if (cancelled) return;
      if (n > 0) {
        router.replace("/dashboard-pro");
      } else {
        setCheckingPlaces(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isPro, profileLoading, router]);

  if (authLoading || profileLoading || checkingPlaces) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="mx-auto w-full max-w-lg px-5 pb-10 pt-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ds-accent">
            Espace pro
          </p>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ds-text">
            Configurer ton café
          </h1>
          <p className="mt-0.5 truncate text-sm text-ds-text2">
            {displayName
              ? `${displayName} · revendication ou première connexion`
              : "Revendique ton établissement"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="shrink-0 text-xs font-semibold text-ds-text2 hover:text-ds-text"
        >
          Déconnexion
        </button>
      </div>
      <VendorOnboardingWizard />
      <p className="mt-8 text-center text-sm text-ds-text2">
        <Link href="/map" className="font-semibold text-ds-accent">
          Retour à l&apos;app client
        </Link>
      </p>
    </div>
  );
}
