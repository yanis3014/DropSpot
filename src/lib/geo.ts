/** Earth radius in meters (WGS84 mean). */
const EARTH_RADIUS_M = 6_371_000;

export type LatLng = { lat: number; lng: number };

/** Great-circle distance in meters (Haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export type GeoPositionResult =
  | { ok: true; coords: LatLng }
  | { ok: false; reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout' };

/** Promise wrapper around navigator.geolocation.getCurrentPosition. */
export function getCurrentPosition(options?: PositionOptions): Promise<GeoPositionResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: 'unsupported' });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          },
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({ ok: false, reason: 'denied' });
        } else if (err.code === err.TIMEOUT) {
          resolve({ ok: false, reason: 'timeout' });
        } else {
          resolve({ ok: false, reason: 'unavailable' });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 30_000,
        ...options,
      }
    );
  });
}
