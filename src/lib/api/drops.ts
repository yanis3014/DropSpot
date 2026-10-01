import { supabase } from '@/lib/supabase/client';
import {
  inferDropTypeFromContent,
  normalizeDropType,
  type DropTypeId,
} from '@/lib/filters';
import { cachedQuery } from '@/lib/cache/clientCache';
export type { DropTypeId };

export interface Drop {
  id: string;
  title: string;
  description?: string;
  /** Canonical type after normalization (promo | sport | event). */
  drop_type: DropTypeId;
  /** Original DB value, kept for debugging. */
  raw_drop_type?: string | null;
  start_time: string;
  end_time: string;
  place_id: string;
  places?: {
    name: string;
    image_url?: string;
    address?: string;
    city?: string;
    category?: string | null;
  };
  capacity?: number;
  current_participants?: number;
  created_at?: string;
  updated_at?: string;
}

type RawDrop = Record<string, unknown>;

export function normalizeDrop(row: RawDrop): Drop {
  const rawType =
    (row.drop_type as string | null | undefined) ??
    (row.type as string | null | undefined) ??
    (row.category as string | null | undefined) ??
    null;

  const placesRaw = row.places;
  let places: Drop['places'];
  if (placesRaw && typeof placesRaw === 'object' && !Array.isArray(placesRaw)) {
    const p = placesRaw as Record<string, unknown>;
    places = {
      name: String(p.name ?? 'Lieu à déterminer'),
      image_url: (p.image_url as string | undefined) ?? undefined,
      address: (p.address as string | undefined) ?? undefined,
      city: (p.city as string | undefined) ?? undefined,
      category:
        typeof p.category === 'string'
          ? p.category
          : typeof p.type === 'string'
            ? p.type
            : null,
    };
  }

  const title = String(row.title ?? 'Drop');
  const description = (row.description as string | undefined) ?? undefined;

  // Prefer explicit DB type; otherwise infer from title/description/place for badges + filters.
  const drop_type =
    normalizeDropType(rawType) ??
    inferDropTypeFromContent({
      title,
      description,
      raw_drop_type: rawType,
      places,
    }) ??
    'event';

  return {
    id: String(row.id),
    title,
    description,
    drop_type,
    raw_drop_type: rawType,
    start_time: String(row.start_time ?? ''),
    end_time: String(row.end_time ?? ''),
    place_id: String(row.place_id ?? ''),
    places,
    capacity: typeof row.capacity === 'number' ? row.capacity : undefined,
    current_participants:
      typeof row.current_participants === 'number'
        ? row.current_participants
        : undefined,
    created_at: (row.created_at as string | undefined) ?? undefined,
    updated_at: (row.updated_at as string | undefined) ?? undefined,
  };
}

export async function getActiveDrops(): Promise<Drop[]> {
  try {
    return await cachedQuery('drops:active', async () => {
      if (!supabase) {
        console.warn('Supabase client not initialized');
        return [];
      }

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('drops')
        .select('*, places(name, image_url, address, city, category)')
        .gte('end_time', now)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching drops:', error);
        throw error;
      }

      return ((data ?? []) as RawDrop[]).map(normalizeDrop);
    });
  } catch (error) {
    console.error('Error in getActiveDrops:', error);
    throw error;
  }
}

/**
 * Broader catalogue for the /drops exploration page:
 * live + upcoming + recently ended (last 7 days).
 */
export async function getExploreDrops(): Promise<Drop[]> {
  try {
    return await cachedQuery('drops:explore', async () => {
      if (!supabase) {
        console.warn('Supabase client not initialized');
        return [];
      }

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('drops')
        .select('*, places(name, image_url, address, city, category)')
        .gte('end_time', since)
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error fetching explore drops:', error);
        throw error;
      }

      return ((data ?? []) as RawDrop[]).map(normalizeDrop);
    });
  } catch (error) {
    console.error('Error in getExploreDrops:', error);
    throw error;
  }
}

export type DropTiming = 'live' | 'upcoming' | 'ended';

export function getDropTiming(drop: Drop, now: number = Date.now()): DropTiming {
  const start = new Date(drop.start_time).getTime();
  const end = new Date(drop.end_time).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'ended';
  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'ended';
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isDropLive(drop: Drop): boolean {
  const now = Date.now();
  const start = new Date(drop.start_time).getTime();
  const end = new Date(drop.end_time).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return start <= now && now <= end;
}

export function formatCountdown(endTime: string, now: number = Date.now()): string {
  const end = new Date(endTime).getTime();
  const diff = end - now;

  if (!Number.isFinite(end) || diff <= 0) return '00:00:00';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
