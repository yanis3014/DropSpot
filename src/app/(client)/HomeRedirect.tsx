"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { fetchIsPro } from "@/app/(pro)/dashboard-pro/lib/api/vendor";
import { readDropspotMode } from "@/lib/auth/dropspotMode";
import { hasProIntent, PRO_CLAIM_PATH } from "@/lib/auth/proIntent";

/**
 * Root `/` : pro → dashboard, unless they chose the client app.
 * A guest always gets the welcome screen first (envies or map from there).
 * A signed-in user who started a café claim on this device resumes it.
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
      router.replace("/bienvenue");
      return;
    }

    let cancelled = false;
    void fetchIsPro().then((isPro) => {
      if (cancelled) return;
      if (!isPro && hasProIntent()) {
        // Back from Google / an e-mail link without `?next=`: resume the
        // claim. Full load, the router may hold a stale signed-out redirect.
        window.location.replace(PRO_CLAIM_PATH);
        return;
      }
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
