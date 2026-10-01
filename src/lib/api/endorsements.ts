import { supabase } from '@/lib/supabase/client';

export type EndorsementCategory = 'wifi' | 'coffee' | 'comfort' | 'food';

export const ENDORSEMENT_FRESHNESS_MS = 30 * 24 * 60 * 60 * 1000;
/** Minimum recent votes to show a trophy badge. */
export const ENDORSEMENT_TROPHY_MIN_VOTES = 3;

export const endorsementCategories: {
  id: EndorsementCategory;
  label: string;
  emoji: string;
  trophyLabel: string;
}[] = [
  { id: 'wifi', label: 'Wi-Fi en béton', emoji: '💻', trophyLabel: 'Wi-Fi' },
  { id: 'coffee', label: 'Super Café', emoji: '☕', trophyLabel: 'Café' },
  { id: 'comfort', label: 'Confort max', emoji: '🛋️', trophyLabel: 'Confort' },
  { id: 'food', label: 'Pépite gourmande', emoji: '🥐', trophyLabel: 'Gourmand' },
];

export function endorsementTagLabel(id: EndorsementCategory): string {
  const row = endorsementCategories.find((c) => c.id === id);
  return row ? `${row.emoji} ${row.label}` : id;
}

export type PlaceRanking = {
  category: EndorsementCategory;
  count: number;
};

export type PlaceTrophy = {
  category: EndorsementCategory;
  count: number;
  badgeText: string;
};

function trophyFromRanking(r: PlaceRanking): PlaceTrophy {
  const meta = endorsementCategories.find((c) => c.id === r.category)!;
  return {
    category: r.category,
    count: r.count,
    badgeText: `🏆 N°1 ${meta.trophyLabel}`,
  };
}

function aggregateCounts(rows: { category: string }[]): PlaceRanking[] {
  const counts = new Map<EndorsementCategory, number>();
  for (const row of rows) {
    const cat = row.category as EndorsementCategory;
    if (!endorsementCategories.some((c) => c.id === cat)) continue;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

/** Rankings for one place (last 30 days). */
export async function getPlaceRankings(placeId: string): Promise<PlaceRanking[]> {
  try {
    if (!supabase) return [];
    const since = new Date(Date.now() - ENDORSEMENT_FRESHNESS_MS).toISOString();
    const { data, error } = await supabase
      .from('place_endorsements')
      .select('category')
      .eq('place_id', placeId)
      .gte('created_at', since);

    if (error) {
      console.error('Error fetching endorsements:', error);
      return [];
    }
    return aggregateCounts((data ?? []) as { category: string }[]);
  } catch (error) {
    console.error('Error in getPlaceRankings:', error);
    return [];
  }
}

/** Top trophy if leading category has > ENDORSEMENT_TROPHY_MIN_VOTES recent votes. */
export async function getPlaceTopTrophy(
  placeId: string
): Promise<PlaceTrophy | null> {
  const rankings = await getPlaceRankings(placeId);
  const top = rankings[0];
  if (!top || top.count <= ENDORSEMENT_TROPHY_MIN_VOTES) return null;
  return trophyFromRanking(top);
}

/** Batch trophies for feed / lists. */
export async function getTopTrophiesForPlaces(
  placeIds: string[]
): Promise<Record<string, PlaceTrophy>> {
  const out: Record<string, PlaceTrophy> = {};
  if (!placeIds.length || !supabase) return out;

  const since = new Date(Date.now() - ENDORSEMENT_FRESHNESS_MS).toISOString();
  const { data, error } = await supabase
    .from('place_endorsements')
    .select('place_id, category')
    .in('place_id', placeIds)
    .gte('created_at', since);

  if (error) {
    console.error('Error fetching batch endorsements:', error);
    return out;
  }

  const byPlace = new Map<string, { category: string }[]>();
  for (const row of (data ?? []) as { place_id: string; category: string }[]) {
    const list = byPlace.get(row.place_id) ?? [];
    list.push({ category: row.category });
    byPlace.set(row.place_id, list);
  }

  for (const [placeId, rows] of byPlace) {
    const rankings = aggregateCounts(rows);
    const top = rankings[0];
    if (top && top.count > ENDORSEMENT_TROPHY_MIN_VOTES) {
      out[placeId] = trophyFromRanking(top);
    }
  }
  return out;
}

export async function getUserEndorsementsForPlace(
  placeId: string
): Promise<EndorsementCategory[]> {
  try {
    if (!supabase) return [];
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('place_endorsements')
      .select('category')
      .eq('place_id', placeId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching user endorsements:', error);
      return [];
    }
    return ((data ?? []) as { category: string }[]).map(
      (r) => r.category as EndorsementCategory
    );
  } catch (error) {
    console.error('Error in getUserEndorsementsForPlace:', error);
    return [];
  }
}

/** Toggle-on only: insert endorsement (unique constraint prevents duplicates). */
export async function addEndorsement(
  placeId: string,
  category: EndorsementCategory
): Promise<void> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('place_endorsements').insert({
    place_id: placeId,
    user_id: user.id,
    category,
  });

  if (error) {
    // Already voted — treat as success for UX
    if (error.code === '23505') return;
    // Table not deployed yet (migration not applied on Supabase)
    if (error.code === 'PGRST205') {
      throw new Error('ENDORSEMENTS_TABLE_MISSING');
    }
    console.error('Error adding endorsement:', error);
    throw error;
  }
}

export function isEndorsementsUnavailableError(err: unknown): boolean {
  return err instanceof Error && err.message === 'ENDORSEMENTS_TABLE_MISSING';
}
