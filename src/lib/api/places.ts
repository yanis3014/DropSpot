import { supabase } from '@/lib/supabase/client';
import {
  hasValidCoordinates,
  normalizePlaceCategory,
  type PlaceCategoryId,
} from '@/lib/filters';
import { cachedQuery } from '@/lib/cache/clientCache';
export interface Place {
  id: string;
  name: string;
  image_url?: string;
  lat: number;
  lng: number;
  /** Raw category string from Supabase (any casing). */
  category?: string | null;
  /** Normalized preference/filter categories derived from category + tags. */
  categories: PlaceCategoryId[];
  has_plugs?: boolean;
  wifi_speed?: string;
  noise_level?: string;
  laptop_policy?: string;
  has_terrace?: boolean;
  is_vegan?: boolean;
  description?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  created_at?: string;
  updated_at?: string;
}

type RawPlace = Record<string, unknown>;

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

/**
 * Accepts common Supabase shapes:
 * - lat / lng
 * - latitude / longitude
 * - location: { coordinates: [lng, lat] } (GeoJSON) or "POINT(lng lat)"
 */
function extractCoords(row: RawPlace): { lat: number; lng: number } {
  let lat = toNumber(row.lat ?? row.latitude);
  let lng = toNumber(row.lng ?? row.longitude);

  const location = row.location;
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && location) {
    if (
      typeof location === 'object' &&
      location !== null &&
      'coordinates' in location &&
      Array.isArray((location as { coordinates: unknown }).coordinates)
    ) {
      const [x, y] = (location as { coordinates: number[] }).coordinates;
      lng = toNumber(x);
      lat = toNumber(y);
    } else if (typeof location === 'string') {
      const match = location.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
      if (match) {
        lng = toNumber(match[1]);
        lat = toNumber(match[2]);
      }
    }
  }

  return { lat, lng };
}

function deriveCategories(row: RawPlace, category: string | null): PlaceCategoryId[] {
  const found = new Set<PlaceCategoryId>();
  const fromCategory = normalizePlaceCategory(category);
  if (fromCategory) found.add(fromCategory);

  const tags = row.tags ?? row.categories ?? row.vibes;
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      const id = normalizePlaceCategory(tag);
      if (id) found.add(id);
    }
  } else if (typeof tags === 'string') {
    for (const part of tags.split(/[,|;]/)) {
      const id = normalizePlaceCategory(part);
      if (id) found.add(id);
    }
  }

  // Infer from amenities when the category column is empty.
  if (row.has_plugs || row.wifi_speed || row.laptop_policy) found.add('remote');
  if (row.has_terrace) found.add('chill');

  return [...found];
}

/** Normalize a raw Supabase places row into the app Place shape. */
export function normalizePlace(row: RawPlace): Place {
  const { lat, lng } = extractCoords(row);
  const category =
    typeof row.category === 'string'
      ? row.category
      : typeof row.type === 'string'
        ? row.type
        : null;

  return {
    id: String(row.id),
    name: String(row.name ?? 'Café'),
    image_url: (row.image_url as string | undefined) ?? undefined,
    lat,
    lng,
    category,
    categories: deriveCategories(row, category),
    has_plugs: Boolean(row.has_plugs),
    wifi_speed: (row.wifi_speed as string | undefined) ?? undefined,
    noise_level: (row.noise_level as string | undefined) ?? undefined,
    laptop_policy: (row.laptop_policy as string | undefined) ?? undefined,
    has_terrace: Boolean(row.has_terrace),
    is_vegan: Boolean(row.is_vegan ?? row.has_vegan),
    description: (row.description as string | undefined) ?? undefined,
    address: (row.address as string | undefined) ?? undefined,
    city: (row.city as string | undefined) ?? undefined,
    postal_code: (row.postal_code as string | undefined) ?? undefined,
    created_at: (row.created_at as string | undefined) ?? undefined,
    updated_at: (row.updated_at as string | undefined) ?? undefined,
  };
}

// Must match the live `places` schema: selecting a missing column fails the whole query.
// Coordinates live in either lat/lng or latitude/longitude depending on the row.
const PLACES_FULL_SELECT =
  'id, name, image_url, lat, lng, latitude, longitude, category, description, address, city, has_plugs, has_vegan, laptop_policy, noise_level, wifi_speed, created_at';

/** Marker payload: no description / image. Amenity flags are kept for the map filter pills. */
const PLACES_MAP_SELECT =
  'id, name, lat, lng, latitude, longitude, category, has_plugs, laptop_policy, noise_level, wifi_speed';

async function fetchPlacesRaw(select: string): Promise<Place[]> {
  if (!supabase) {
    console.warn('Supabase client not initialized');
    return [];
  }

  const { data, error } = await supabase
    .from('places')
    .select(select)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching places:', error);
    throw error;
  }

  return ((data ?? []) as unknown as RawPlace[]).map(normalizePlace);
}

export async function getPlaces(options?: {
  /** Only return rows with plottable lat/lng (map). Default: all normalized rows. */
  withCoordinatesOnly?: boolean;
}): Promise<Place[]> {
  try {
    const places = await cachedQuery('places:full', () =>
      fetchPlacesRaw(PLACES_FULL_SELECT)
    );
    if (options?.withCoordinatesOnly) {
      return places.filter(hasValidCoordinates);
    }
    return places;
  } catch (error) {
    console.error('Error in getPlaces:', error);
    throw error;
  }
}

/**
 * Lightweight places payload for map markers.
 * Skips description / image_url; keeps tiny amenity flags for filter pills.
 */
export async function getMapPlaces(): Promise<Place[]> {
  try {
    const places = await cachedQuery('places:map', () =>
      fetchPlacesRaw(PLACES_MAP_SELECT)
    );
    return places.filter(hasValidCoordinates);
  } catch (error) {
    console.error('Error in getMapPlaces:', error);
    throw error;
  }
}

export async function getPlaceById(id: string): Promise<Place | null> {
  try {
    const cached = await cachedQuery(
      `places:byId:${id}`,
      async () => {
        if (!supabase) {
          console.warn('Supabase client not initialized');
          return null;
        }

        const { data, error } = await supabase
          .from('places')
          .select(PLACES_FULL_SELECT)
          .eq('id', id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching place:', error);
          throw error;
        }

        return data ? normalizePlace(data as unknown as RawPlace) : null;
      },
      120_000
    );
    return cached;
  } catch (error) {
    console.error('Error in getPlaceById:', error);
    throw error;
  }
}

export { hasValidCoordinates };
