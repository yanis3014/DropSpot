'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getAggregatedVibes, type AggregatedVibe } from '@/lib/api/checkins';
import { getPlacesOpenStatus, type PlaceOpenStatusMap } from '@/lib/api/openingHours';
import { getPlacesSpecs } from '@/lib/api/specs';
import type { PlacePulse } from '@/lib/filters';
import type { SpecsByPlace } from '@/lib/specs';

/**
 * Pulse of the cafés in `placeIds` for the map and the list: specificities,
 * live vibe and opening status. Only cafés not fetched yet are asked for,
 * so moving the map loads the pulse of the new cafés only.
 */
export function usePlacePulse(placeIds: string[]): PlacePulse {
  const [specs, setSpecs] = useState<SpecsByPlace>({});
  const [vibes, setVibes] = useState<Record<string, AggregatedVibe>>({});
  const [open, setOpen] = useState<PlaceOpenStatusMap>({});
  const requested = useRef(new Set<string>());
  const idsKey = useMemo(
    () => [...new Set(placeIds.filter(Boolean))].sort().join(','),
    [placeIds]
  );

  // Live vibes only exist for cafés checked in within 3 h: one small call.
  useEffect(() => {
    let cancelled = false;
    getAggregatedVibes()
      .then((next) => {
        if (!cancelled) setVibes(next);
      })
      .catch((err) => console.error('Error loading café vibes:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!idsKey) return;
    const missing = idsKey.split(',').filter((id) => !requested.current.has(id));
    if (missing.length === 0) return;
    for (const id of missing) requested.current.add(id);
    const retryLater = () => {
      for (const id of missing) requested.current.delete(id);
    };

    // No cancel flag: results are merged by café, so a late answer is
    // still right and the next ids only ask for what is missing.
    getPlacesSpecs(missing)
      .then((next) => setSpecs((prev) => ({ ...prev, ...next })))
      .catch((err) => {
        console.error('Error loading café specs:', err);
        retryLater();
      });
    getPlacesOpenStatus(missing)
      .then((next) => setOpen((prev) => ({ ...prev, ...next })))
      .catch((err) => {
        console.error(err);
        retryLater();
      });
  }, [idsKey]);

  return useMemo(() => ({ specs, vibes, open }), [specs, vibes, open]);
}
