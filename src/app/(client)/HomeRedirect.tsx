"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { fetchIsPro } from "@/app/(pro)/dashboard-pro/lib/api/vendor";
import { readDropspotMode } from "@/lib/auth/dropspotMode";
import { hasSeenOnboarding } from "@/lib/onboardingStorage";

/**
 * Root `/` : pro → dashboard, unless they chose the client app.
 * A first-time guest gets the welcome + envies flow before the map.
 */
export default function HomeRedirect() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (readDropspotMode() === "client") {
      router.replace("/map");
      return;
    }

    if (!isAuthenticated) {
      router.replace(hasSeenOnboarding() ? "/map" : "/onboarding");
      return;
    }

    let cancelled = false;
    void fetchIsPro().then((isPro) => {
      if (cancelled) return;
      router.replace(isPro ? "/dashboard-pro" : "/map");
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loading, router]);

  return (
    <div className="flex min-h-[40vh] flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
    </div>
  );
}
