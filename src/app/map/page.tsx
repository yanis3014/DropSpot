'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import MapSkeleton from '@/components/map/MapSkeleton';

const PremiumMap = dynamic(() => import('@/components/map/PremiumMap'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapWithFilter() {
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter');
  return <PremiumMap initialFilter={filter} />;
}

export default function MapPage() {
  return (
    <div className="flex-1 relative h-[100dvh]">
      <Suspense fallback={<MapSkeleton />}>
        <MapWithFilter />
      </Suspense>
    </div>
  );
}
