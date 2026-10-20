import { supabase } from '@/lib/supabase/client';

export type PlaceMediaCategory = 'venue' | 'food' | 'menu';

export interface PlaceMedia {
  id: string;
  place_id: string;
  category: PlaceMediaCategory;
  url: string;
  storage_path: string | null;
  sort_order: number;
  created_at: string;
}

export const PLACE_MEDIA_TABS: {
  category: PlaceMediaCategory;
  label: string;
}[] = [
  { category: 'venue', label: 'Le Lieu' },
  { category: 'food', label: 'À la carte' },
  { category: 'menu', label: 'Le Menu' },
];

function normalizeMedia(row: Record<string, unknown>): PlaceMedia {
  return {
    id: String(row.id),
    place_id: String(row.place_id),
    category: row.category as PlaceMediaCategory,
    url: String(row.url),
    storage_path:
      typeof row.storage_path === 'string' ? row.storage_path : null,
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ''),
  };
}

/** Lecture publique des photos d’un spot (RLS select true). */
export async function getPlaceMedia(placeId: string): Promise<PlaceMedia[]> {
  if (!supabase) {
    console.warn('Supabase client not initialized');
    return [];
  }

  const { data, error } = await supabase
    .from('place_media')
    .select('id, place_id, category, url, storage_path, sort_order, created_at')
    .eq('place_id', placeId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    // Table absente / pas encore migrée → galerie vide, cover image_url en secours
    console.warn('getPlaceMedia:', error.message);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeMedia);
}

export function groupPlaceMedia(
  media: PlaceMedia[]
): Record<PlaceMediaCategory, PlaceMedia[]> {
  const groups: Record<PlaceMediaCategory, PlaceMedia[]> = {
    venue: [],
    food: [],
    menu: [],
  };
  for (const item of media) {
    if (item.category in groups) groups[item.category].push(item);
  }
  return groups;
}
