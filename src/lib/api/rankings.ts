import { supabase } from '@/lib/supabase/client';
import { cachedQuery } from '@/lib/cache/clientCache';
import { isSpecId, type SpecId } from '@/lib/specs';

export interface SpecRankingRow {
  place_id: string;
  name: string;
  image_url: string | null;
  city: string | null;
  score: number;
  yes_votes: number;
  rank: number;
  /** Rank 7 days ago; null when the café was not ranked then. */
  previous_rank: number | null;
}

export interface PlaceRank {
  spec: SpecId;
  rank: number;
  total: number;
}

/** Top cafés for one specificity (public). */
export async function getSpecRankings(spec: SpecId, limit = 10): Promise<SpecRankingRow[]> {
  return cachedQuery(`rankings:${spec}:${limit}`, async () => {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('get_spec_rankings', {
      p_spec: spec,
      p_limit: limit,
    });
    if (error) {
      console.error('Error fetching rankings:', error);
      throw error;
    }
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      place_id: String(row.place_id),
      name: String(row.name ?? 'Café'),
      image_url: (row.image_url as string | null) ?? null,
      city: (row.city as string | null) ?? null,
      score: Number(row.score ?? 0),
      yes_votes: Number(row.yes_votes ?? 0),
      rank: Number(row.rank),
      previous_rank: row.previous_rank == null ? null : Number(row.previous_rank),
    }));
  });
}

/** Ranks of one café, best first. */
export async function getPlaceRanks(placeId: string): Promise<PlaceRank[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_place_ranks', { p_place: placeId });
  if (error) {
    console.error('Error fetching place ranks:', error);
    throw error;
  }
  return ((data ?? []) as Record<string, unknown>[])
    .filter((row) => isSpecId(row.spec))
    .map((row) => ({
      spec: row.spec as SpecId,
      rank: Number(row.rank),
      total: Number(row.total),
    }))
    .sort((a, b) => a.rank - b.rank);
}
