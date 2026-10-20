import { supabase } from '@/lib/supabase/client';
import {
  endorsementCategories,
  type EndorsementCategory,
} from '@/lib/api/endorsements';
import { CHECKIN_GRAINS_REWARD } from '@/lib/grains';

export type ContributionKind = 'check_in' | 'endorsement';

export type ContributionItem = {
  id: string;
  kind: ContributionKind;
  title: string;
  placeName: string;
  createdAt: string;
  gain: number | null;
  category?: EndorsementCategory;
};

type PlaceNameJoin =
  | { name: string | null }
  | { name: string | null }[]
  | null;

function placeName(places: PlaceNameJoin): string {
  const row = Array.isArray(places) ? places[0] : places;
  return row?.name?.trim() || 'Spot inconnu';
}

/** Recent check-ins and endorsements by the signed-in user. */
export async function getMyContributions(
  limit = 20
): Promise<ContributionItem[]> {
  try {
    if (!supabase) return [];
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const [checkInsRes, endorsementsRes] = await Promise.all([
      supabase
        .from('check_ins')
        .select('id, created_at, crowd_level, wifi_speed, places(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('place_endorsements')
        .select('id, created_at, category, places(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    if (checkInsRes.error) {
      console.error('Error fetching check-in contributions:', checkInsRes.error);
    }
    if (endorsementsRes.error) {
      console.error(
        'Error fetching endorsement contributions:',
        endorsementsRes.error
      );
    }

    const checkIns: ContributionItem[] = (
      (checkInsRes.data ?? []) as {
        id: string;
        created_at: string;
        wifi_speed: string;
        places: PlaceNameJoin;
      }[]
    ).map((row) => ({
      id: `check_in:${row.id}`,
      kind: 'check_in' as const,
      title:
        row.wifi_speed === 'good' ? 'Wi-Fi validé' : 'Ambiance partagée',
      placeName: placeName(row.places),
      createdAt: row.created_at,
      gain: CHECKIN_GRAINS_REWARD,
    }));

    const endorsements: ContributionItem[] = (
      (endorsementsRes.data ?? []) as {
        id: string;
        created_at: string;
        category: string;
        places: PlaceNameJoin;
      }[]
    ).map((row) => {
      const cat = row.category as EndorsementCategory;
      const meta = endorsementCategories.find((c) => c.id === cat);
      return {
        id: `endorsement:${row.id}`,
        kind: 'endorsement' as const,
        title: meta ? `${meta.label} validé` : 'Avis validé',
        placeName: placeName(row.places),
        createdAt: row.created_at,
        gain: null,
        category: cat,
      };
    });

    return [...checkIns, ...endorsements]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit);
  } catch (error) {
    console.error('Error in getMyContributions:', error);
    return [];
  }
}
