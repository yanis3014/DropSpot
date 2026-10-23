'use client';

import { useEffect, useState } from 'react';
import { getCurrentPosition, type LatLng } from '@/lib/geo';

/**
 * The user's position, only when location is already allowed: never triggers
 * the permission prompt (distances are a bonus, not a reason to ask).
 */
export function useKnownPosition(): LatLng | null {
  const [position, setPosition] = useState<LatLng | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof navigator === 'undefined' || !navigator.permissions) return;
        const status = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });
        if (status.state !== 'granted') return;
        const result = await getCurrentPosition({
          enableHighAccuracy: false,
          maximumAge: 5 * 60_000,
          timeout: 10_000,
        });
        if (!cancelled && result.ok) setPosition(result.coords);
      } catch {
        // Permissions API not available for geolocation on some browsers.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return position;
}
