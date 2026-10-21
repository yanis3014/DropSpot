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

export async function getPlacesOpenStatus(
  placeIds: string[]
): Promise<PlaceOpenStatusMap> {
  if (!supabase || placeIds.length === 0) return {};

  const unique = [...new Set(placeIds.filter(Boolean))].slice(0, 500);
  const { data, error } = await supabase.rpc('places_open_status', {
    p_place_ids: unique,
  });

  if (error) {
    console.error('places_open_status error:', error);
    return {};
  }

  if (!data || typeof data !== 'object') return {};
  const out: PlaceOpenStatusMap = {};
  for (const [id, row] of Object.entries(data as Record<string, unknown>)) {
    out[id] = parseRow(row);
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
