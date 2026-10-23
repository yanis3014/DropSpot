import { supabase } from '@/lib/supabase/client';
import {
  inferDropTypeFromContent,
  normalizeDropType,
  type DropTypeId,
} from '@/lib/filters';
import { cachedQuery } from '@/lib/cache/clientCache';
import {
  getActiveFlashDrops,
  normalizeFlashDrop,
  type FlashDrop,
} from '@/app/(pro)/dashboard-pro/lib/api/flashDrops';
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
  /** Provenance : table historique `drops` ou Flash Drop vendor. */
  source?: 'drops' | 'flash_drops';
}

/** Mappe un Flash Drop vendor vers le format Drop du feed client. */
export function flashDropToDrop(fd: FlashDrop): Drop {
  return {
    id: fd.id,
    title: fd.title,
    description: fd.description ?? undefined,
    // `activity` drops are events (run, DJ set, workshop…), the rest are offers.
    drop_type: fd.kind === 'activity' ? 'event' : 'promo',
    raw_drop_type: fd.kind ?? 'offer',
    start_time: fd.starts_at,
    end_time: fd.ends_at,
    place_id: fd.place_id,
    places: fd.places
      ? {
          name: fd.places.name,
          image_url: fd.places.image_url,
          address: fd.places.address,
          city: fd.places.city,
          category: null,
        }
      : undefined,
    created_at: fd.created_at,
    source: 'flash_drops',
  };
}

function mergeDropsByStart(a: Drop[], b: Drop[]): Drop[] {
  const byId = new Map<string, Drop>();
  for (const d of [...a, ...b]) byId.set(d.id, d);
  return [...byId.values()].sort(
    (x, y) =>
      new Date(x.start_time).getTime() - new Date(y.start_time).getTime()
  );
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

      const [legacyResult, flashResult] = await Promise.all([
        supabase
          .from('drops')
          .select('*, places(name, image_url, address, city, category)')
          .gte('end_time', now)
          .order('start_time', { ascending: true }),
        getActiveFlashDrops().catch((err) => {
          console.warn('flash_drops unavailable (migration?):', err);
          return [] as FlashDrop[];
        }),
      ]);

      if (legacyResult.error) {
        console.error('Error fetching drops:', legacyResult.error);
        // Si la table drops échoue mais flash_drops OK, on continue avec les flash
      }

      const legacy = legacyResult.error
        ? []
        : ((legacyResult.data ?? []) as RawDrop[]).map((row) => ({
            ...normalizeDrop(row),
            source: 'drops' as const,
          }));

      const flash = flashResult.map(flashDropToDrop);
      return mergeDropsByStart(legacy, flash);
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

      const [legacyResult, flashResult] = await Promise.all([
        supabase
          .from('drops')
          .select('*, places(name, image_url, address, city, category)')
          .gte('end_time', since)
          .order('start_time', { ascending: false }),
        // Explore : flash actifs + récemment expirés (7j)
        supabase
          .from('flash_drops')
          .select(
            'id, vendor_id, place_id, title, description, starts_at, ends_at, is_active, created_at, kind, stopped_at, places(name, image_url, address, city)'
          )
          .gte('ends_at', since)
          .eq('is_active', true)
          .is('stopped_at', null)
          .order('starts_at', { ascending: false }),
      ]);

      if (legacyResult.error) {
        console.error('Error fetching explore drops:', legacyResult.error);
      }

      const legacy = legacyResult.error
        ? []
        : ((legacyResult.data ?? []) as RawDrop[]).map((row) => ({
            ...normalizeDrop(row),
            source: 'drops' as const,
          }));

      let flash: Drop[] = [];
      if (flashResult.error) {
        console.warn('flash_drops explore unavailable:', flashResult.error);
      } else {
        flash = ((flashResult.data ?? []) as Record<string, unknown>[]).map(
          (row) => flashDropToDrop(normalizeFlashDrop(row))
        );
      }

      return mergeDropsByStart(legacy, flash).reverse();
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

function hourLabel(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/**
 * Start of an upcoming drop in the user's time zone:
 * « Aujourd'hui · 18 h 30 », « Demain · 9 h », « Sam. 26 oct. · 9 h ».
 */
export function formatStartLabel(isoString: string, now: number = Date.now()): string {
  const start = new Date(isoString);
  if (!Number.isFinite(start.getTime())) return '';
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const days = Math.round((startDay.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return `Aujourd'hui · ${hourLabel(start)}`;
  if (days === 1) return `Demain · ${hourLabel(start)}`;
  const day = start.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${hourLabel(start)}`;
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
