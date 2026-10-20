import { supabase } from '@/lib/supabase/client';
import { invalidateCache } from '@/lib/cache/clientCache';

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
  places?: {
    name: string;
    image_url?: string;
    address?: string;
    city?: string;
  } | null;
}

/** Génère un PIN numérique à 4 chiffres. */
export function generateFlashPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export interface CreateFlashDropInput {
  title: string;
  description?: string;
  place_id: string;
  /** Durée en minutes à partir de maintenant (défaut 60). */
  durationMinutes?: number;
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
    places,
  };
}

export function isFlashDropLive(drop: FlashDrop, now = Date.now()): boolean {
  if (!drop.is_active) return false;
  const end = new Date(drop.ends_at).getTime();
  const start = new Date(drop.starts_at).getTime();
  if (!Number.isFinite(end)) return false;
  return (!Number.isFinite(start) || start <= now) && end > now;
}

/** Flash drops du vendor connecté (récents d'abord). */
export async function getVendorFlashDrops(
  vendorId: string,
  limit = 20
): Promise<FlashDrop[]> {
  if (!supabase || !vendorId) return [];

  const { data, error } = await supabase
    .from('flash_drops')
    .select(
      'id, vendor_id, place_id, title, description, starts_at, ends_at, is_active, pin_code, current_uses, max_uses, grains_reward, created_at, places(name, image_url, address, city)'
    )
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching vendor flash drops:', error);
    throw error;
  }

  return ((data ?? []) as RawFlashDrop[]).map(normalizeFlashDrop);
}

/** Compte les flash drops encore actifs du vendor. */
export async function countActiveVendorFlashDrops(
  vendorId: string
): Promise<number> {
  if (!supabase || !vendorId) return 0;
  const now = new Date().toISOString();

  const { count, error } = await supabase
    .from('flash_drops')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .gt('ends_at', now);

  if (error) {
    console.error('Error counting active flash drops:', error);
    return 0;
  }
  return count ?? 0;
}

/** Insert réel dans `flash_drops` (vendor_id = user auth). */
export async function createFlashDrop(
  input: CreateFlashDropInput
): Promise<FlashDrop> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const title = input.title.trim();
  if (!title) throw new Error('Le titre est requis');
  if (!input.place_id) throw new Error('Choisis un spot');

  const durationMinutes = input.durationMinutes ?? 60;
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

  const pin_code = generateFlashPin();

  const { data, error } = await supabase
    .from('flash_drops')
    .insert({
      vendor_id: user.id,
      place_id: input.place_id,
      title,
      description: input.description?.trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      is_active: true,
      pin_code,
      current_uses: 0,
      grains_reward: 10,
    })
    .select(
      'id, vendor_id, place_id, title, description, starts_at, ends_at, is_active, pin_code, current_uses, max_uses, grains_reward, created_at, places(name, image_url, address, city)'
    )
    .single();

  if (error) {
    console.error('Error creating flash drop:', error);
    throw error;
  }

  // Invalide le cache feed pour que l'accueil voie le flash immédiatement
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
