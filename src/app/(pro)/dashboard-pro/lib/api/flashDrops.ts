import { supabase } from '@/lib/supabase/client';
import { invalidateCache } from '@/lib/cache/clientCache';
import type { DropContentWritePayload } from '@/app/(pro)/dashboard-pro/lib/proDrops/dropForm';

export type FlashDropKind =
  | 'discount'
  | 'offer'
  | 'special_price'
  | 'activity';

export interface FlashDrop {
  id: string;
  vendor_id: string;
  place_id: string;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  pin_code?: string | null;
  current_uses?: number;
  max_uses?: number | null;
  grains_reward?: number;
  created_at?: string;
  stopped_at?: string | null;
  kind?: FlashDropKind;
  conditions?: string | null;
  discount_value?: number | null;
  discount_unit?: 'percent' | 'eur' | null;
  is_recurring?: boolean;
  places?: {
    name: string;
    image_url?: string;
    address?: string;
    city?: string;
  } | null;
}

type RawFlashDrop = Record<string, unknown>;

export function normalizeFlashDrop(row: RawFlashDrop): FlashDrop {
  const placesRaw = row.places;
  let places: FlashDrop['places'] = null;
  if (placesRaw && typeof placesRaw === 'object' && !Array.isArray(placesRaw)) {
    const p = placesRaw as Record<string, unknown>;
    places = {
      name: String(p.name ?? 'Spot'),
      image_url: (p.image_url as string | undefined) ?? undefined,
      address: (p.address as string | undefined) ?? undefined,
      city: (p.city as string | undefined) ?? undefined,
    };
  }

  return {
    id: String(row.id),
    vendor_id: String(row.vendor_id),
    place_id: String(row.place_id),
    title: String(row.title ?? 'Flash Drop'),
    description: (row.description as string | null | undefined) ?? null,
    starts_at: String(row.starts_at ?? ''),
    ends_at: String(row.ends_at ?? ''),
    is_active: Boolean(row.is_active ?? true),
    pin_code: (row.pin_code as string | null | undefined) ?? null,
    current_uses:
      typeof row.current_uses === 'number' ? row.current_uses : 0,
    max_uses: typeof row.max_uses === 'number' ? row.max_uses : null,
    grains_reward:
      typeof row.grains_reward === 'number' ? row.grains_reward : 10,
    created_at: (row.created_at as string | undefined) ?? undefined,
    stopped_at: (row.stopped_at as string | null | undefined) ?? null,
    kind: (row.kind as FlashDropKind | undefined) ?? 'offer',
    conditions: (row.conditions as string | null | undefined) ?? null,
    discount_value:
      typeof row.discount_value === 'number' ? row.discount_value : null,
    discount_unit:
      row.discount_unit === 'percent' || row.discount_unit === 'eur'
        ? row.discount_unit
        : null,
    is_recurring: Boolean(row.is_recurring ?? false),
    places,
  };
}

const VENDOR_DROP_SELECT =
  'id, vendor_id, place_id, title, description, starts_at, ends_at, is_active, pin_code, current_uses, max_uses, grains_reward, created_at, stopped_at, kind, conditions, discount_value, discount_unit, is_recurring, places(name, image_url, address, city)';

/** Drop vendor par id (duplication / édition). */
export async function getFlashDropById(
  dropId: string
): Promise<FlashDrop | null> {
  if (!supabase || !dropId) return null;

  const { data, error } = await supabase
    .from('flash_drops')
    .select(VENDOR_DROP_SELECT)
    .eq('id', dropId)
    .maybeSingle();

  if (error) {
    console.error('getFlashDropById:', error);
    throw error;
  }
  if (!data) return null;
  return normalizeFlashDrop(data as RawFlashDrop);
}

/** Les N derniers drops d'un café (pour « Reprendre un drop »). */
export async function getRecentPlaceFlashDrops(
  placeId: string,
  limit = 3
): Promise<FlashDrop[]> {
  if (!supabase || !placeId) return [];

  const { data, error } = await supabase
    .from('flash_drops')
    .select(VENDOR_DROP_SELECT)
    .eq('place_id', placeId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('getRecentPlaceFlashDrops:', error);
    return [];
  }
  return ((data ?? []) as RawFlashDrop[]).map(normalizeFlashDrop);
}

/**
 * Insert dans `flash_drops` (colonnes de contenu + vendor_id du café actif).
 * N'envoie jamais grains_reward, current_uses, pin_code, is_active ni stopped_at.
 */
export async function insertFlashDrop(
  payload: DropContentWritePayload
): Promise<FlashDrop> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const row = {
    place_id: payload.place_id,
    vendor_id: payload.vendor_id,
    title: payload.title,
    description: payload.description,
    kind: payload.kind,
    discount_value: payload.discount_value,
    discount_unit: payload.discount_unit,
    conditions: payload.conditions,
    starts_at: payload.starts_at,
    ends_at: payload.ends_at,
    max_uses: payload.max_uses,
  };

  const { data, error } = await supabase
    .from('flash_drops')
    .insert(row)
    .select(VENDOR_DROP_SELECT)
    .single();

  if (error) {
    throw error;
  }

  invalidateCache('drops:');
  return normalizeFlashDrop(data as RawFlashDrop);
}

/**
 * Update dans `flash_drops` (colonnes de contenu + vendor_id du café actif).
 * N'envoie jamais grains_reward, current_uses, pin_code, is_active ni stopped_at.
 */
export async function updateFlashDrop(
  dropId: string,
  payload: DropContentWritePayload
): Promise<FlashDrop> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const row = {
    place_id: payload.place_id,
    vendor_id: payload.vendor_id,
    title: payload.title,
    description: payload.description,
    kind: payload.kind,
    discount_value: payload.discount_value,
    discount_unit: payload.discount_unit,
    conditions: payload.conditions,
    starts_at: payload.starts_at,
    ends_at: payload.ends_at,
    max_uses: payload.max_uses,
  };

  const { data, error } = await supabase
    .from('flash_drops')
    .update(row)
    .eq('id', dropId)
    .select(VENDOR_DROP_SELECT)
    .single();

  if (error) {
    throw error;
  }

  invalidateCache('drops:');
  return normalizeFlashDrop(data as RawFlashDrop);
}

/**
 * Flash drops actifs pour le feed client (étape 3).
 * is_active = true AND ends_at > now()
 */
export async function getActiveFlashDrops(): Promise<FlashDrop[]> {
  if (!supabase) return [];
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('flash_drops')
    .select(
      'id, vendor_id, place_id, title, description, starts_at, ends_at, is_active, created_at, places(name, image_url, address, city)'
    )
    .eq('is_active', true)
    .gt('ends_at', now)
    .order('starts_at', { ascending: false });

  if (error) {
    console.error('Error fetching active flash drops:', error);
    throw error;
  }

  return ((data ?? []) as RawFlashDrop[]).map(normalizeFlashDrop);
}
