"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ClaimOnboardingWizard from "@/app/(pro)/dashboard-pro/components/ClaimOnboardingWizard";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  countProPlaceMemberships,
  getPendingPlaceClaim,
  type PendingPlaceClaim,
} from "@/app/(pro)/dashboard-pro/lib/api/vendor";
import { clearProIntent } from "@/lib/auth/proIntent";
import {
  fetchProAccessStatus,
  PRO_WELCOME_PATH,
} from "@/lib/pro/accessStatus";
import { supabase } from "@/lib/supabase/client";

export default function DashboardProOnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [boot, setBoot] = useState<{
    membershipCount: number;
    pending: PendingPlaceClaim | null;
  } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?redirect=/dashboard-pro/onboarding&espace=pro");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Arrived: the "Revendiquer mon café" intent has done its job.
    clearProIntent();
    let cancelled = false;
    void Promise.all([
      countProPlaceMemberships(),
      getPendingPlaceClaim(),
      fetchProAccessStatus(supabase),
    ]).then(([membershipCount, pending, status]) => {
      if (cancelled) return;
      if (status?.state === "welcome") {
        // Approved while away: welcome screen and first steps first.
        window.location.replace(PRO_WELCOME_PATH);
        return;
      }
      setBoot({ membershipCount, pending });
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated || boot === null) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  return (
    <ClaimOnboardingWizard
      key={boot.pending?.id ?? "fresh"}
      hasMemberships={boot.membershipCount > 0}
      initialPending={boot.pending}
    />
  );
}
