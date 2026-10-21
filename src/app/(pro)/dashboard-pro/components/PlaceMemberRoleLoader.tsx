"use client";

import { useEffect, useState } from "react";
import { getPlaceMemberRole } from "@/app/(pro)/dashboard-pro/lib/api/dropCodeValidate";

export interface PlaceMemberRoleLoaderProps {
  placeId: string;
  children: (role: string | null, loading: boolean) => React.ReactNode;
}

export default function PlaceMemberRoleLoader({
  placeId,
  children,
}: PlaceMemberRoleLoaderProps) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getPlaceMemberRole(placeId).then((next) => {
      if (!cancelled) {
        setRole(next);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  return <>{children(role, loading)}</>;
}
