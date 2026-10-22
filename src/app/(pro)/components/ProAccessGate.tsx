"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useActivePlace } from "@/app/(pro)/hooks/useActivePlace";
import { canAccessProPath } from "@/lib/pro/navAccess";

export default function ProAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const {
    loading: placeLoading,
    activeMemberRole,
    cafeAccessDenied,
  } = useActivePlace();

  useEffect(() => {
    if (authLoading || placeLoading || !isAuthenticated) return;
    if (!activeMemberRole) return;
    if (canAccessProPath(pathname, activeMemberRole)) return;
    router.replace("/dashboard-pro");
  }, [
    activeMemberRole,
    authLoading,
    isAuthenticated,
    pathname,
    placeLoading,
    router,
  ]);

  if (!authLoading && !placeLoading && cafeAccessDenied) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <h1 className="font-display m-0 text-xl font-extrabold text-ds-text">
          Tu n&apos;as pas accès à ce café
        </h1>
        <p className="m-0 max-w-md text-sm text-ds-text2">
          Ce lien ne correspond à aucun établissement dont tu fais partie. Choisis
          un autre café dans le menu ou demande une invitation au gérant.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
