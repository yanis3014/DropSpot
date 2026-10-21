'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getPlacesOpenStatus,
  type PlaceOpenStatusMap,
} from '@/lib/api/openingHours';

export function usePlacesOpenStatus(placeIds: string[]): PlaceOpenStatusMap {
  const key = useMemo(
    () => [...new Set(placeIds.filter(Boolean))].sort().join(','),
    [placeIds]
  );

  const [map, setMap] = useState<PlaceOpenStatusMap>({});

  useEffect(() => {
    if (!key) {
      setMap({});
      return;
    }

    let cancelled = false;
    void getPlacesOpenStatus(key.split(',')).then((next) => {
      if (!cancelled) setMap(next);
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return map;
}
