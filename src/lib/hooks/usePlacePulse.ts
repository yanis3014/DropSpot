'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAggregatedVibes, type AggregatedVibe } from '@/lib/api/checkins';
import { getPlacesOpenStatus, type PlaceOpenStatusMap } from '@/lib/api/openingHours';
import { getAllPlaceSpecs } from '@/lib/api/specs';
import type { PlacePulse } from '@/lib/filters';
import type { SpecsByPlace } from '@/lib/specs';

/**
 * Pulse of every café for the map and the list: specificities, live vibe
 * and opening status of `placeIds`.
 */
export function usePlacePulse(placeIds: string[]): PlacePulse {
  const [specs, setSpecs] = useState<SpecsByPlace>({});
  const [vibes, setVibes] = useState<Record<string, AggregatedVibe>>({});
  const [open, setOpen] = useState<PlaceOpenStatusMap>({});
  const idsKey = useMemo(
    () => [...new Set(placeIds.filter(Boolean))].sort().join(','),
    [placeIds]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAllPlaceSpecs(), getAggregatedVibes()])
      .then(([nextSpecs, nextVibes]) => {
        if (cancelled) return;
        setSpecs(nextSpecs);
        setVibes(nextVibes);
      })
      .catch((err) => console.error('Error loading café pulse:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    getPlacesOpenStatus(idsKey.split(','))
      .then((next) => {
        if (!cancelled) setOpen(next);
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return useMemo(() => ({ specs, vibes, open }), [specs, vibes, open]);
}
