"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import MapSkeleton from "@/components/map/MapSkeleton";

const PremiumMap = dynamic(() => import("@/components/map/PremiumMap"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export default function MapPage() {
  return (
    <div className="relative h-[100dvh] flex-1">
      <Suspense fallback={<MapSkeleton />}>
        <PremiumMap />
      </Suspense>
    </div>
  );
}
