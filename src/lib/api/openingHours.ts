import { supabase } from '@/lib/supabase/client';
import type { CafeOpenStatus } from '@/lib/cafePresentation';

export interface PlaceOpenStatusRow {
  ok?: boolean;
  has_hours?: boolean;
  is_open?: boolean | null;
  status?: 'open' | 'closed' | 'closing_soon' | 'unknown';
  detail?: string | null;
  closes_at?: string | null;
  opens_at?: string | null;
  timezone?: string;
  error?: string;
}

export type PlaceOpenStatusMap = Record<string, PlaceOpenStatusRow>;

function parseRow(data: unknown): PlaceOpenStatusRow {
  if (!data || typeof data !== 'object') return { ok: false };
  return data as PlaceOpenStatusRow;
}

export async function getPlaceOpenStatus(
  placeId: string
): Promise<PlaceOpenStatusRow | null> {
  if (!supabase || !placeId) return null;

  const { data, error } = await supabase.rpc('place_open_status', {
    p_place: placeId,
  });

  if (error) {
    console.error('place_open_status error:', error);
    return null;
  }

  return parseRow(data);
}

/** Server cap of places_open_status (limit 500 in the SQL function). */
export const OPEN_STATUS_BATCH = 500;

/** Splits `items` into arrays of at most `size` items. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function getPlacesOpenStatus(
  placeIds: string[]
): Promise<PlaceOpenStatusMap> {
  if (!supabase || placeIds.length === 0) return {};

  const unique = [...new Set(placeIds.filter(Boolean))];
  const client = supabase;
  // places_open_status answers for at most OPEN_STATUS_BATCH cafés per call.
  const results = await Promise.all(
    chunk(unique, OPEN_STATUS_BATCH).map(async (ids) => {
      const { data, error } = await client.rpc('places_open_status', {
        p_place_ids: ids,
      });
      if (error) {
        console.error('places_open_status error:', error);
        return null;
      }
      return data;
    })
  );

  const out: PlaceOpenStatusMap = {};
  for (const data of results) {
    if (!data || typeof data !== 'object') continue;
    for (const [id, row] of Object.entries(data as Record<string, unknown>)) {
      out[id] = parseRow(row);
    }
  }
  return out;
}

export function cafeStatusFromOpenRow(
  row: PlaceOpenStatusRow | null | undefined
): { status: CafeOpenStatus; statusDetail?: string } | null {
  if (!row?.ok || !row.has_hours) return null;

  const status: CafeOpenStatus =
    row.status === 'closing_soon'
      ? 'closing_soon'
      : row.is_open
        ? 'open'
        : 'closed';

  const detail = row.detail?.trim();
  return {
    status,
    statusDetail: detail || undefined,
  };
}
