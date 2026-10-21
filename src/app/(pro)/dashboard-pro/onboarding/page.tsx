"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VendorOnboardingWizard from "@/app/(pro)/dashboard-pro/components/VendorOnboardingWizard";
import { useRequireVendor } from "@/app/(pro)/dashboard-pro/hooks/useRequireVendor";
import { countVendorPlaces } from "@/app/(pro)/dashboard-pro/lib/api/vendor";

export default function DashboardProOnboardingPage() {
  const router = useRouter();
  const { profile, loading, denied, displayName, signOut } = useRequireVendor();
  const [checkingPlaces, setCheckingPlaces] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      setCheckingPlaces(true);
      try {
        const n = await countVendorPlaces(profile.id);
        if (!cancelled && n > 0) {
          router.replace("/dashboard-pro");
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
      <div className="flex min-h-[50vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="px-5 pt-8">
        <Link href="/" className="text-sm font-semibold text-ds-text2">
          ← Retour
        </Link>
        <p className="mt-6 font-bold text-ds-text">Accès restaurateur requis</p>
        <p className="mt-2 text-sm text-ds-text2">
          Seuls les comptes <strong>vendor</strong> ou <strong>owner</strong>{" "}
          peuvent configurer un établissement.
        </p>
      </div>
    );
  }

  if (!profile) return null;

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
              ? `${displayName} · première connexion`
              : "Première connexion restaurateur"}
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
    </div>
  );
}
