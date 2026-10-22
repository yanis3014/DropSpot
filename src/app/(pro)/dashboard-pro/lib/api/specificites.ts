import { supabase } from '@/lib/supabase/client';
import {
  aggregateEndorsementsByCategory,
  type SpecCategoryAgg,
} from '@/app/(pro)/dashboard-pro/lib/specificites/aggregate';

/** All community endorsements for a place, aggregated by category. */
export async function listPlaceSpecAggregates(
  placeId: string
): Promise<SpecCategoryAgg[]> {
  if (!supabase || !placeId) return [];

  const { data, error } = await supabase
    .from('place_endorsements')
    .select('category, created_at')
    .eq('place_id', placeId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('listPlaceSpecAggregates:', error);
    throw error;
  }

  return aggregateEndorsementsByCategory(
    (data ?? []) as { category: string; created_at: string }[]
  );
}
