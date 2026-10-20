import type { LatLng } from '@/lib/geo';

/** Centre de Nice — fallback si le géocodage échoue. */
export const NICE_CENTER: LatLng = { lat: 43.7034, lng: 7.2663 };

type MapboxFeature = {
  center?: [number, number];
  geometry?: { type?: string; coordinates?: [number, number] };
};

/**
 * Géocode une adresse texte via Mapbox Geocoding API.
 * Retourne Nice centre en secours si token absent / erreur / aucun résultat.
 */
export async function geocodeAddress(
  address: string,
  city?: string | null
): Promise<LatLng> {
  const query = [address.trim(), city?.trim()].filter(Boolean).join(', ');
  if (!query) return { ...NICE_CENTER };

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    console.warn('geocodeAddress: MAPBOX token manquant → fallback Nice');
    return { ...NICE_CENTER };
  }

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
    );
    url.searchParams.set('access_token', token);
    url.searchParams.set('limit', '1');
    url.searchParams.set('language', 'fr');
    // Bias Côte d'Azur
    url.searchParams.set('proximity', `${NICE_CENTER.lng},${NICE_CENTER.lat}`);
    url.searchParams.set('country', 'fr');

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn('geocodeAddress: HTTP', res.status);
      return { ...NICE_CENTER };
    }

    const json = (await res.json()) as { features?: MapboxFeature[] };
    const feature = json.features?.[0];
    const coords =
      feature?.center ??
      (feature?.geometry?.type === 'Point'
        ? feature.geometry.coordinates
        : undefined);

    if (
      coords &&
      Number.isFinite(coords[0]) &&
      Number.isFinite(coords[1])
    ) {
      return { lng: coords[0], lat: coords[1] };
    }
  } catch (err) {
    console.warn('geocodeAddress failed:', err);
  }

  return { ...NICE_CENTER };
}

/**
 * Payload coords compatible avec les variantes du schéma `places`
 * (lat/lng, latitude/longitude, PostGIS `location` geography/geometry).
 */
export function placeLocationPayload(coords: LatLng): Record<string, unknown> {
  const { lat, lng } = coords;
  return {
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    // GeoJSON Point — format natif PostgREST / PostGIS (ordre [lng, lat])
    location: {
      type: 'Point',
      coordinates: [lng, lat],
    },
  };
}

/** Variante WKT si le cast GeoJSON est refusé par le schéma. */
export function placeLocationWkt(coords: LatLng): string {
  return `POINT(${coords.lng} ${coords.lat})`;
}
