'use client';

import dynamic from 'next/dynamic';
import MapSkeleton from '@/components/map/MapSkeleton';

const PremiumMap = dynamic(() => import('@/components/map/PremiumMap'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export default function MapPage() {
  return (
    <div className="flex-1 relative h-[100dvh]">
      <PremiumMap />
    </div>
  );
}
