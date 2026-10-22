import { supabase } from '@/lib/supabase/client';
import {
  insertFlashDrop,
  normalizeFlashDrop,
  type FlashDrop,
} from '@/app/(pro)/dashboard-pro/lib/api/flashDrops';
import { DEFAULT_DROP_CONDITIONS } from '@/app/(pro)/dashboard-pro/lib/proDrops/dropForm';
import { getVendorTodayStats } from '@/app/(pro)/dashboard-pro/lib/api/validate';
import { withParticipants } from '@/app/(pro)/dashboard-pro/lib/api/proDropsList';
import type { PlaceChecklistInput } from '@/app/(pro)/dashboard-pro/lib/proHome/checklist';

export interface PlaceHomeMeta {
  verificationStatus: 'unclaimed' | 'pending' | 'verified' | string;
  checklist: PlaceChecklistInput;
}

export async function fetchPlaceHomeMeta(
  placeId: string
): Promise<PlaceHomeMeta | null> {
  if (!supabase) return null;

  const { data: place, error: placeError } = await supabase
    .from('places')
    .select('id, image_url, description, opening_hours, verification_status')
    .eq('id', placeId)
    .maybeSingle();

  if (placeError || !place) {
    console.error('fetchPlaceHomeMeta place:', placeError);
    return null;
  }

  let structuredHours = 0;
  const hoursRes = await supabase
    .from('place_opening_hours')
    .select('id', { count: 'exact', head: true })
    .eq('place_id', placeId);
  if (!hoursRes.error) {
    structuredHours = hoursRes.count ?? 0;
  }

  const { count: dropCount } = await supabase
    .from('flash_drops')
    .select('id', { count: 'exact', head: true })
    .eq('place_id', placeId);

  const { count: mediaVenueCount } = await supabase
    .from('place_media')
    .select('id', { count: 'exact', head: true })
    .eq('place_id', placeId)
    .eq('category', 'venue');

  const hasTextHours = Boolean(
    typeof place.opening_hours === 'string' && place.opening_hours.trim()
  );
  const hasStructuredHours = structuredHours > 0;

  return {
    verificationStatus: String(place.verification_status ?? 'unclaimed'),
    checklist: {
      hasCoverPhoto:
        Boolean(place.image_url?.trim()) || (mediaVenueCount ?? 0) > 0,
      hasOpeningHours: hasTextHours || hasStructuredHours,
      hasDescription: Boolean(
        typeof place.description === 'string' && place.description.trim()
      ),
      hasFirstDrop: (dropCount ?? 0) > 0,
    },
  };
}

export async function getLiveFlashDropsForPlace(
  placeId: string
): Promise<FlashDrop[]> {
  if (!supabase || !placeId) return [];
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('flash_drops')
    .select(
      'id, vendor_id, place_id, title, description, starts_at, ends_at, is_active, current_uses, max_uses, grains_reward, created_at, stopped_at, kind, event_category'
    )
    .eq('place_id', placeId)
    .eq('is_active', true)
    .gt('ends_at', now)
    .order('ends_at', { ascending: true });

  if (error) {
    if (error.code === '42703' && /stopped_at/.test(error.message ?? '')) {
      const fallback = await supabase
        .from('flash_drops')
        .select(
          'id, vendor_id, place_id, title, description, starts_at, ends_at, is_active, current_uses, max_uses, grains_reward, created_at'
        )
        .eq('place_id', placeId)
        .eq('is_active', true)
        .gt('ends_at', now)
        .order('ends_at', { ascending: true });
      if (fallback.error) throw fallback.error;
      return ((fallback.data ?? []) as Record<string, unknown>[]).map(
        normalizeFlashDrop
      );
    }
    console.error('getLiveFlashDropsForPlace:', error);
    throw error;
  }

  return withParticipants(
    ((data ?? []) as Record<string, unknown>[])
      .filter((row) => !row.stopped_at)
      .map(normalizeFlashDrop)
  );
}

export async function stopFlashDrop(
  dropId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'no_client' };
  const { data, error } = await supabase.rpc('stop_drop', { p_drop: dropId });
  if (error) return { ok: false, error: error.message };
  const row = data as { ok?: boolean; error?: string } | null;
  return { ok: Boolean(row?.ok), error: row?.error };
}

export async function duplicateFlashDrop(
  drop: FlashDrop
): Promise<FlashDrop> {
  const start = new Date(drop.starts_at).getTime();
  const end = new Date(drop.ends_at).getTime();
  const durationMinutes =
    Number.isFinite(start) && Number.isFinite(end) && end > start
      ? Math.round((end - start) / 60000)
      : 60;

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const kind = drop.kind ?? 'offer';

  return insertFlashDrop({
    place_id: drop.place_id,
    vendor_id: drop.vendor_id,
    title: drop.title,
    description: drop.description ?? null,
    event_category: kind === 'activity' ? (drop.event_category ?? null) : null,
    kind,
    discount_value:
      kind === 'discount' || kind === 'special_price'
        ? (drop.discount_value ?? 20)
        : null,
    discount_unit:
      kind === 'discount'
        ? (drop.discount_unit ?? 'percent')
        : kind === 'special_price'
          ? 'eur'
          : null,
    conditions: drop.conditions ?? DEFAULT_DROP_CONDITIONS,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    max_uses: drop.max_uses ?? null,
  });
}

export async function loadProHomeSnapshot(placeId: string) {
  const [stats, liveDrops, meta] = await Promise.all([
    getVendorTodayStats(placeId),
    getLiveFlashDropsForPlace(placeId),
    fetchPlaceHomeMeta(placeId),
  ]);
  return { stats, liveDrops, meta, fetchedAt: new Date() };
}
