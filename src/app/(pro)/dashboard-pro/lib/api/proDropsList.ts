import { supabase } from '@/lib/supabase/client';
import {
  normalizeFlashDrop,
  type FlashDrop,
} from '@/app/(pro)/dashboard-pro/lib/api/flashDrops';
import { classifyFlashDrop } from '@/app/(pro)/dashboard-pro/lib/proDrops/classify';
import { getParticipantCounts } from '@/lib/api/drops';

/** Adds the participant count to event drops (kind = activity). */
export async function withParticipants(drops: FlashDrop[]): Promise<FlashDrop[]> {
  const ids = drops.filter((d) => d.kind === 'activity').map((d) => d.id);
  if (ids.length === 0) return drops;
  const counts = await getParticipantCounts(ids);
  return drops.map((d) =>
    d.kind === 'activity' ? { ...d, participants: counts[d.id] ?? 0 } : d
  );
}

const PLACE_DROP_SELECT =
  'id, vendor_id, place_id, title, description, starts_at, ends_at, is_active, pin_code, current_uses, max_uses, grains_reward, created_at, stopped_at, kind, event_category, conditions, discount_value, discount_unit, is_recurring';

const FINISHED_PAGE_SIZE = 20;

type RawRow = Record<string, unknown>;

async function selectPlaceDrops(
  placeId: string,
  select: string
): Promise<RawRow[]> {
  if (!supabase || !placeId) return [];

  const { data, error } = await supabase
    .from('flash_drops')
    .select(select)
    .eq('place_id', placeId)
    .order('starts_at', { ascending: false });

  if (error) {
    if (error.code === '42703') {
      const fallbackSelect =
        'id, vendor_id, place_id, title, description, starts_at, ends_at, is_active, pin_code, current_uses, max_uses, grains_reward, created_at';
      const fallback = await supabase
        .from('flash_drops')
        .select(fallbackSelect)
        .eq('place_id', placeId)
        .order('starts_at', { ascending: false });
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []) as unknown as RawRow[];
    }
    console.error('selectPlaceDrops:', error);
    throw error;
  }

  return (data ?? []) as unknown as RawRow[];
}

/** Drops actifs ou à venir pour un établissement. */
export async function getActiveAndScheduledDrops(
  placeId: string,
  nowMs: number = Date.now()
): Promise<{ live: FlashDrop[]; scheduled: FlashDrop[] }> {
  const rows = await selectPlaceDrops(placeId, PLACE_DROP_SELECT);
  const drops = await withParticipants(rows.map(normalizeFlashDrop));
  const live: FlashDrop[] = [];
  const scheduled: FlashDrop[] = [];

  for (const drop of drops) {
    const section = classifyFlashDrop(drop, nowMs);
    if (section === 'live') live.push(drop);
    else if (section === 'scheduled') scheduled.push(drop);
  }

  live.sort(
    (a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime()
  );
  scheduled.sort(
    (a, b) =>
      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  return { live, scheduled };
}

export async function countFinishedDrops(
  placeId: string,
  nowMs: number = Date.now()
): Promise<number> {
  const rows = await selectPlaceDrops(placeId, PLACE_DROP_SELECT);
  return rows
    .map(normalizeFlashDrop)
    .filter((d) => classifyFlashDrop(d, nowMs) === 'finished').length;
}

/** Page terminés (20 par page), tri fin décroissant. */
export async function getFinishedDropsPage(
  placeId: string,
  page: number,
  nowMs: number = Date.now()
): Promise<{ drops: FlashDrop[]; total: number; pageSize: number }> {
  const rows = await selectPlaceDrops(placeId, PLACE_DROP_SELECT);
  const finished = rows
    .map(normalizeFlashDrop)
    .filter((d) => classifyFlashDrop(d, nowMs) === 'finished')
    .sort(
      (a, b) =>
        new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime()
    );

  const pageSize = FINISHED_PAGE_SIZE;
  const total = finished.length;
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  const drops = finished.slice(start, start + pageSize);

  return { drops, total, pageSize };
}

export { FINISHED_PAGE_SIZE };
