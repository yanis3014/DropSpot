"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { fetchIsPro } from "@/app/(pro)/dashboard-pro/lib/api/vendor";
import { readDropspotMode } from "@/lib/auth/dropspotMode";

/** Root `/` : pro → dashboard, unless they chose the client app. */
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
      router.replace("/map");
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
